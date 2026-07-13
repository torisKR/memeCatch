-- Security hardening for the validated Codex Security findings.
-- Keep public aggregate views available while removing raw identity exposure.

-- Only the trusted scheduler/service role may run global maintenance.
revoke execute on function public.compute_trend_scores() from public, anon, authenticated;
grant execute on function public.compute_trend_scores() to service_role;

-- Serialize the count-and-write quota boundary for each user and operation.
create or replace function public.check_rate_limit(p_table text, p_limit int, p_minutes int) returns void
language plpgsql security definer set search_path = public as $$
declare
  cnt int;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'login_required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor::text || ':' || p_table, 0)
  );

  if p_table = 'discussions' then
    select count(*) into cnt from discussions
    where user_id = actor and created_at > now() - make_interval(mins => p_minutes);
  elsif p_table = 'meme_submissions' then
    select count(*) into cnt from meme_submissions
    where submitter_id = actor and created_at > now() - make_interval(mins => p_minutes);
  elsif p_table = 'reports' then
    select count(*) into cnt from reports
    where reporter_id = actor and created_at > now() - make_interval(mins => p_minutes);
  elsif p_table = 'community_posts' then
    select count(*) into cnt from community_posts
    where user_id = actor and created_at > now() - make_interval(mins => p_minutes);
  elsif p_table = 'community_comments' then
    select count(*) into cnt from community_comments
    where user_id = actor and created_at > now() - make_interval(mins => p_minutes);
  else
    cnt := 0;
  end if;

  if cnt >= p_limit then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
end $$;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;

-- Raw reaction/vote rows are private; aggregate views remain public.
drop policy if exists reactions_read on public.meme_reactions;
create policy reactions_self_read on public.meme_reactions for select
  using (user_id = (select auth.uid()) or is_operator());

drop policy if exists gen_votes_read on public.generation_votes;
create policy gen_votes_self_read on public.generation_votes for select
  using (user_id = (select auth.uid()) or is_operator());

drop policy if exists disc_reactions_read on public.discussion_reactions;
create policy disc_reactions_self_read on public.discussion_reactions for select
  using (user_id = (select auth.uid()) or is_operator());

alter view public.meme_reaction_counts set (security_invoker = false);
alter view public.generation_vote_stats set (security_invoker = false);

-- A hidden community post must hide its comments as well, except to the
-- post/comment owner and operators who need moderation access.
drop policy if exists community_comments_read on public.community_comments;
create policy community_comments_read on public.community_comments for select
  using (
    user_id = (select auth.uid())
    or is_operator()
    or exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (p.status = 'visible' or p.user_id = (select auth.uid()))
    )
  );

-- Public pages use the denormalized like_count; exact liker rows are private.
drop policy if exists community_post_likes_read on public.community_post_likes;
create policy community_post_likes_self_read on public.community_post_likes for select
  using (user_id = (select auth.uid()) or is_operator());

-- Authoritative RPC bounds. Wrappers keep their friendly messages, but direct
-- authenticated RPC callers now receive the same limits at the final boundary.
create or replace function public.submit_meme(
  p_name text, p_seen_at text, p_url text, p_description text,
  p_guess text, p_tags text[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dup uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if p_name is null or char_length(p_name) not between 1 and 100
     or coalesce(char_length(p_seen_at), 0) > 200
     or coalesce(char_length(p_url), 0) > 500
     or coalesce(char_length(p_description), 0) > 2000
     or coalesce(char_length(p_guess), 0) > 1000
     or coalesce(array_length(p_tags, 1), 0) > 10
     or coalesce((select sum(char_length(tag)) from unnest(coalesce(p_tags, '{}')) tag), 0) > 300 then
    raise exception 'invalid_input';
  end if;
  perform check_rate_limit('meme_submissions', 5, 60);
  if p_url is not null and p_url <> '' and p_url !~* '^https?://' then
    raise exception 'invalid_url';
  end if;
  select id into v_dup from memes where title = p_name or p_name = any(aliases) limit 1;
  insert into meme_submissions (submitter_id, name, seen_at, source_url, description, guess_reason, tags, dup_of)
  values (auth.uid(), p_name, p_seen_at, p_url, p_description, p_guess, coalesce(p_tags, '{}'), v_dup)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.submit_meme(text, text, text, text, text, text[]) from public, anon;
grant execute on function public.submit_meme(text, text, text, text, text, text[]) to authenticated;

create or replace function public.submit_meme_v2(
  p_name text, p_seen_at text, p_url text, p_description text,
  p_guess text, p_tags text[], p_attachment_path text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dup uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if p_name is null or char_length(p_name) not between 1 and 100
     or coalesce(char_length(p_seen_at), 0) > 200
     or coalesce(char_length(p_url), 0) > 500
     or coalesce(char_length(p_description), 0) > 2000
     or coalesce(char_length(p_guess), 0) > 1000
     or coalesce(char_length(p_attachment_path), 0) > 300
     or coalesce(array_length(p_tags, 1), 0) > 10
     or coalesce((select sum(char_length(tag)) from unnest(coalesce(p_tags, '{}')) tag), 0) > 300 then
    raise exception 'invalid_input';
  end if;
  perform check_rate_limit('meme_submissions', 5, 60);
  if p_url is not null and p_url <> '' and p_url !~* '^https?://' then
    raise exception 'invalid_url';
  end if;
  if p_attachment_path is not null
     and p_attachment_path not like ('meme-uploads/' || auth.uid()::text || '/%') then
    raise exception 'invalid_attachment_path';
  end if;
  select id into v_dup from memes where title = p_name or p_name = any(aliases) limit 1;
  insert into meme_submissions
    (submitter_id, name, seen_at, source_url, description, guess_reason, tags, dup_of, attachment_path)
  values
    (auth.uid(), p_name, p_seen_at, p_url, p_description, p_guess, coalesce(p_tags, '{}'), v_dup, p_attachment_path)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.submit_meme_v2(text, text, text, text, text, text[], text) from public, anon;
grant execute on function public.submit_meme_v2(text, text, text, text, text, text[], text) to authenticated;
