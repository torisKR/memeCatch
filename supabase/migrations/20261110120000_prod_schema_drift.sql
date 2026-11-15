-- Unrecorded production drift rebuilt with the 2026-10-29 catchup:
-- affiliate_products accepts seasonal, and community meme promotions
-- (table, battle functions) match the production catalog.
-- prod-only schema drift (migrations applied to Supabase without recorded statements)
begin;
alter table public.affiliate_products drop constraint if exists affiliate_products_source_type_check;
alter table public.affiliate_products add constraint affiliate_products_source_type_check CHECK ((source_type = ANY (ARRAY['hotdeal'::text, 'recommend'::text, 'seasonal'::text])));
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: community_meme_promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_meme_promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period_type text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    post_id uuid NOT NULL,
    rank integer NOT NULL,
    like_count integer NOT NULL,
    total_posts integer NOT NULL,
    submission_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT community_meme_promotions_like_count_check CHECK ((like_count >= 0)),
    CONSTRAINT community_meme_promotions_period_type_check CHECK ((period_type = ANY (ARRAY['day'::text, 'week'::text, 'month'::text]))),
    CONSTRAINT community_meme_promotions_rank_check CHECK ((rank >= 1)),
    CONSTRAINT community_meme_promotions_total_posts_check CHECK ((total_posts >= 1))
);


--
-- Name: community_meme_promotions community_meme_promotions_period_type_period_start_post_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_meme_promotions
    ADD CONSTRAINT community_meme_promotions_period_type_period_start_post_id_key UNIQUE (period_type, period_start, post_id);


--
-- Name: community_meme_promotions community_meme_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_meme_promotions
    ADD CONSTRAINT community_meme_promotions_pkey PRIMARY KEY (id);


--
-- Name: idx_community_meme_promotions_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_community_meme_promotions_post ON public.community_meme_promotions USING btree (post_id);


--
-- Name: community_meme_promotions community_meme_promotions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_meme_promotions
    ADD CONSTRAINT community_meme_promotions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: community_meme_promotions community_meme_promotions_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_meme_promotions
    ADD CONSTRAINT community_meme_promotions_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.meme_submissions(id) ON DELETE SET NULL;


--
-- Name: community_meme_promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.community_meme_promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: community_meme_promotions community_meme_promotions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY community_meme_promotions_read ON public.community_meme_promotions FOR SELECT USING (true);


--
-- Name: TABLE community_meme_promotions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.community_meme_promotions TO anon;
GRANT ALL ON TABLE public.community_meme_promotions TO authenticated;
GRANT ALL ON TABLE public.community_meme_promotions TO service_role;


--
-- PostgreSQL database dump complete
--


CREATE OR REPLACE FUNCTION public.community_period_start(p_period text, p_at timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_local timestamp := p_at at time zone 'Asia/Seoul';
begin
  if p_period = 'day' then
    return date_trunc('day', v_local) at time zone 'Asia/Seoul';
  elsif p_period = 'week' then
    return date_trunc('week', v_local) at time zone 'Asia/Seoul';
  elsif p_period = 'month' then
    return date_trunc('month', v_local) at time zone 'Asia/Seoul';
  end if;
  raise exception 'invalid_period' using errcode = '22023';
end $function$
;

CREATE OR REPLACE FUNCTION public.community_period_end(p_period text, p_at timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := public.community_period_start(p_period, p_at);
  v_local timestamp := v_start at time zone 'Asia/Seoul';
begin
  if p_period = 'day' then
    return (v_local + interval '1 day') at time zone 'Asia/Seoul';
  elsif p_period = 'week' then
    return (v_local + interval '7 days') at time zone 'Asia/Seoul';
  end if;
  return (v_local + interval '1 month') at time zone 'Asia/Seoul';
end $function$
;

CREATE OR REPLACE FUNCTION public.community_promotion_count(p_total integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case when coalesce(p_total, 0) <= 0 then 0 else ceil(p_total * 0.01)::integer end
$function$
;

CREATE OR REPLACE FUNCTION public.community_meme_battle(p_period text, p_limit integer DEFAULT 10)
 RETURNS TABLE(post_id uuid, title text, like_count integer, comment_count integer, meme_id uuid, created_at timestamp with time zone, rank integer, total_posts integer, promotion_count integer, is_promotion_candidate boolean, period_start timestamp with time zone, period_end timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with bounds as (
    select public.community_period_start(p_period) as s, public.community_period_end(p_period) as e
  ), ranked as (
    select cp.id, cp.title, cp.like_count, cp.comment_count, cp.meme_id, cp.created_at,
      row_number() over (order by cp.like_count desc, cp.created_at asc, cp.id asc)::integer as rn,
      count(*) over ()::integer as n
    from public.community_posts cp, bounds b
    where cp.status = 'visible' and cp.created_at >= b.s and cp.created_at < b.e
  )
  select r.id, r.title, r.like_count, r.comment_count, r.meme_id, r.created_at, r.rn, r.n,
    public.community_promotion_count(r.n),
    (r.rn <= public.community_promotion_count(r.n) and r.like_count > 0),
    b.s, b.e
  from ranked r, bounds b
  order by r.rn
  limit least(greatest(coalesce(p_limit, 10), 0), 50)
$function$
;

CREATE OR REPLACE FUNCTION public.promote_community_top_memes(p_period text, p_at timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := public.community_period_start(p_period, p_at);
  v_end timestamptz := public.community_period_end(p_period, p_at);
  v_label text := case p_period when 'day' then '오늘의 밈' when 'week' then '이번 주 밈' else '이번 달 밈' end;
  v_count integer := 0;
  v_row record;
  v_submission uuid;
begin
  -- 로그인 사용자는 운영자만. 스케줄러(pg_cron)는 auth.uid()가 없다.
  if auth.uid() is not null and not public.is_operator() then
    raise exception 'operator_required' using errcode = '42501';
  end if;
  if v_end > now() then
    raise exception 'period_not_finished' using errcode = '22023';
  end if;

  for v_row in
    with ranked as (
      select cp.id, cp.user_id, cp.title, cp.body, cp.meme_id, cp.like_count,
        row_number() over (order by cp.like_count desc, cp.created_at asc, cp.id asc)::integer as rn,
        count(*) over ()::integer as n
      from public.community_posts cp
      where cp.status = 'visible' and cp.created_at >= v_start and cp.created_at < v_end
    )
    select r.* from ranked r
    where r.rn <= public.community_promotion_count(r.n) and r.like_count > 0
      and not exists (
        select 1 from public.community_meme_promotions p
        where p.period_type = p_period and p.period_start = v_start and p.post_id = r.id
      )
    order by r.rn
  loop
    insert into public.meme_submissions (submitter_id, name, description, tags, status)
    values (
      v_row.user_id,
      left(v_row.title, 100),
      left(v_row.body, 2000),
      array['커뮤니티 밈대결', v_label],
      'pending'
    )
    returning id into v_submission;

    insert into public.community_meme_promotions
      (period_type, period_start, post_id, rank, like_count, total_posts, submission_id)
    values (p_period, v_start, v_row.id, v_row.rn, v_row.like_count, v_row.n, v_submission);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $function$
;

-- ACL create_community_post {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ACL create_community_comment {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ACL community_period_end {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ACL community_promotion_count {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ACL community_meme_battle {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ACL community_period_start {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- ACL promote_community_top_memes {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- CRON memecatch-community-battle-day 5 15 * * * select public.promote_community_top_memes('day', now() - interval '10 minutes');
-- CRON memecatch-community-battle-week 10 15 * * 0 select public.promote_community_top_memes('week', now() - interval '15 minutes');
-- CRON memecatch-community-battle-month 15 15 * * * select public.promote_community_top_memes('month', now() - interval '20 minutes')
revoke execute on function public.promote_community_top_memes(text, timestamp with time zone) from public, anon;
commit;
