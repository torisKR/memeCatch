-- 레인 4: 사용자 밈 콘텐츠 직접 업로드
-- 1) storage 버킷 meme-uploads (public read, 5MB, 이미지 4종)
-- 2) storage.objects RLS 정책 (공개 읽기 / 자기 폴더에만 업로드 / 자기 폴더만 삭제)
-- 3) submit_meme_v2 RPC (기존 submit_meme + attachment_path)

-- 1) 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meme-uploads',
  'meme-uploads',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
-- 2) storage.objects 정책
drop policy if exists "meme_uploads_public_read" on storage.objects;
create policy "meme_uploads_public_read" on storage.objects
  for select
  using (bucket_id = 'meme-uploads');
drop policy if exists "meme_uploads_auth_insert" on storage.objects;
create policy "meme_uploads_auth_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meme-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- 자기 폴더({auth.uid()}/...)에 올린 파일만 삭제 가능
drop policy if exists "meme_uploads_owner_delete" on storage.objects;
create policy "meme_uploads_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meme-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- 3) submit_meme_v2 — 기존 submit_meme와 동일 검증 + attachment_path 저장
--    attachment_path는 'meme-uploads/{auth.uid()}/' 프리픽스만 허용
create or replace function submit_meme_v2(
  p_name text,
  p_seen_at text,
  p_url text,
  p_description text,
  p_guess text,
  p_tags text[],
  p_attachment_path text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_dup uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  perform check_rate_limit('meme_submissions', 5, 60);
  if p_url is not null and p_url !~* '^https?://' then raise exception 'invalid_url'; end if;
  if p_attachment_path is not null
     and p_attachment_path not like ('meme-uploads/' || auth.uid()::text || '/%') then
    raise exception 'invalid_attachment_path';
  end if;
  select id into v_dup from memes where title = p_name or p_name = any(aliases) limit 1;
  insert into meme_submissions
    (submitter_id, name, seen_at, source_url, description, guess_reason, tags, dup_of, attachment_path)
  values
    (auth.uid(), p_name, p_seen_at, p_url, p_description, p_guess, coalesce(p_tags,'{}'), v_dup, p_attachment_path)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function submit_meme_v2(text, text, text, text, text, text[], text) to authenticated;
