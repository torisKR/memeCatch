-- 오늘(KST) 많이 본 밈 TOP N
-- view_events를 오늘(Asia/Seoul 자정 이후)로 잘라 meme_id별 집계 → 조회수 desc 상위 p_limit.
-- 오늘 조회 밈이 p_limit 미만이면 부족분을 trend_score desc로 채움(중복 제외).
-- 공개 상태(approved/limited)만. view_events는 RLS 기본 거부라 security definer로 집계만 노출.
create or replace function get_daily_top_memes(p_limit int default 10)
returns setof memes
language sql stable security definer set search_path = public as $$
  with today_views as (
    select meme_id, count(*)::int as cnt
    from view_events
    -- increment_view의 KST 일 단위 dedup과 동일한 경계식
    where created_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
    group by meme_id
  ),
  ranked as (
    select m.id,
           row_number() over (
             order by (coalesce(tv.cnt, 0) > 0) desc,  -- 오늘 조회된 밈 우선
                      coalesce(tv.cnt, 0) desc,        -- 조회수 desc
                      m.trend_score desc,              -- 부족분/동점: trend_score desc
                      m.id desc                        -- 안정 정렬
           ) as rn
    from memes m
    left join today_views tv on tv.meme_id = m.id
    where m.moderation_status in ('approved','limited')
  )
  select m.*
  from ranked r
  join memes m on m.id = r.id
  where r.rn <= least(greatest(coalesce(p_limit, 10), 0), 50)
  order by r.rn
$$;
grant execute on function get_daily_top_memes(int) to anon, authenticated;
