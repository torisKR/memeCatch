-- 탐색 필터는 모든 URL 대신 플랫폼별 공개 밈 수 네 행만 전송한다.
-- SECURITY INVOKER: 호출자의 기존 RLS를 유지하고, 운영자도 공개 상태만 집계한다.
create or replace function public.get_social_platform_counts()
returns table(platform text, meme_count bigint)
language sql stable security invoker
set search_path = public, pg_temp
as $$
  with content_refs as (
    select c.meme_id, lower(coalesce(c.platform, '') || ' ' || coalesce(c.url, '')) as value
    from public.meme_contents c
    join public.memes m on m.id = c.meme_id
    where c.moderation_status = 'approved'
      and c.availability not in ('dead', 'region_blocked')
      and m.moderation_status in ('approved', 'limited')
  ), classified as (
    select meme_id, case
      when strpos(value, 'youtube shorts') > 0
        or strpos(value, 'youtube.com/shorts/') > 0
        or strpos(value, 'youtu.be/shorts/') > 0 then 'youtube_shorts'
      when strpos(value, 'youtube') > 0 or strpos(value, 'youtu.be') > 0 then 'youtube'
      when strpos(value, 'tiktok') > 0 or strpos(value, '틱톡') > 0 then 'tiktok'
      when strpos(value, 'instagram') > 0 or strpos(value, '인스타') > 0 then 'instagram'
    end as platform
    from content_refs
  ), platforms as (
    select unnest(array['youtube', 'youtube_shorts', 'tiktok', 'instagram']) as platform
  )
  select p.platform, count(distinct c.meme_id)
  from platforms p left join classified c on c.platform = p.platform
  group by p.platform;
$$;

revoke all on function public.get_social_platform_counts() from public;
grant execute on function public.get_social_platform_counts() to anon, authenticated, service_role;
comment on function public.get_social_platform_counts() is
  '공개·승인·사용 가능한 콘텐츠의 플랫폼별 distinct 밈 수. 원본 URL을 반환하지 않음.';
