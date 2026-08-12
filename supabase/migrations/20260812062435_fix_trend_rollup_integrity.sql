begin;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'memecatch-daily-ranking',
  'memecatch-daily-trend-alerts',
  'memecatch-daily-saved-context-alerts'
);

create or replace function public.compute_trend_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_run_id bigint;
  v_eligible_count integer;
  v_incomplete_count integer;
  v_top jsonb;
begin
  insert into public.job_runs (job_name)
  values ('compute_trend_scores')
  returning id into v_run_id;

  insert into public.meme_trend_metrics (
    meme_id, date, views, comments, saves, reactions, reports
  )
  select
    m.id,
    v_today,
    coalesce(v.cnt, 0),
    coalesce(c.cnt, 0),
    coalesce(s.cnt, 0),
    coalesce(r.cnt, 0),
    coalesce(rp.cnt, 0)
  from public.memes m
  left join (
    select meme_id, count(*)::integer cnt
    from public.view_events
    where created_at > now() - interval '24 hours'
    group by meme_id
  ) v on v.meme_id = m.id
  left join (
    select meme_id, count(*)::integer cnt
    from public.discussions
    where created_at > now() - interval '24 hours'
    group by meme_id
  ) c on c.meme_id = m.id
  left join (
    select meme_id, count(*)::integer cnt
    from public.saved_memes
    where created_at > now() - interval '24 hours'
    group by meme_id
  ) s on s.meme_id = m.id
  left join (
    select meme_id, count(*)::integer cnt
    from public.meme_reactions
    where created_at > now() - interval '24 hours'
    group by meme_id
  ) r on r.meme_id = m.id
  left join (
    select target_id meme_id, count(*)::integer cnt
    from public.reports
    where target_type = 'meme'
      and created_at > now() - interval '24 hours'
    group by target_id
  ) rp on rp.meme_id = m.id
  where m.moderation_status in ('approved', 'limited')
  on conflict (meme_id, date) do update
  set
    views = excluded.views,
    comments = excluded.comments,
    saves = excluded.saves,
    reactions = excluded.reactions,
    reports = excluded.reports;

  with windows as (
    select
      m.id,
      coalesce(sum(mt.views) filter (where mt.date >= v_today - 6), 0) views_7d,
      coalesce(sum(mt.views) filter (where mt.date >= v_today - 29), 0) views_30d,
      coalesce(sum(mt.comments) filter (where mt.date >= v_today - 6), 0) comments_7d,
      coalesce(sum(mt.saves) filter (where mt.date >= v_today - 6), 0) saves_7d,
      coalesce(sum(mt.reactions) filter (where mt.date >= v_today - 6), 0) reactions_7d,
      coalesce(sum(mt.reports) filter (where mt.date >= v_today - 29), 0) reports_30d
    from public.memes m
    left join public.meme_trend_metrics mt
      on mt.meme_id = m.id
     and mt.date >= v_today - 29
    where m.moderation_status in ('approved', 'limited')
    group by m.id
  ),
  scored as (
    select
      m.id,
      public.is_meme_rank_eligible(m.id) eligible,
      coalesce(public.meme_ranking_completeness(m.id), 0) completeness,
      least(
        89::double precision,
        greatest(
          0::double precision,
          ln(1 + w.views_7d) * 12
          + ln(1 + w.views_30d) * 4
          + ln(1 + w.comments_7d) * 2
          + ln(1 + w.reactions_7d) * 1.5
          + ln(1 + w.saves_7d) * 1.5
          - ln(1 + w.reports_30d) * 8
          + case when m.published_at > now() - interval '48 hours' then 1 else 0 end
        )
      ) signal_score
    from public.memes m
    join windows w on w.id = m.id
    where m.moderation_status in ('approved', 'limited')
  )
  update public.memes m
  set trend_score = case
    when s.eligible and m.safety_level = 'green'
      then 300 + s.signal_score + s.completeness / 10.0
    when s.eligible and m.safety_level = 'yellow'
      then 200 + s.signal_score + s.completeness / 10.0
    when s.eligible
      then 100 + s.signal_score + s.completeness / 10.0
    else least(99::double precision, s.completeness / 2.0 + s.signal_score)
  end
  from scored s
  where s.id = m.id;

  update public.meme_trend_metrics mt
  set trend_score = m.trend_score
  from public.memes m
  where mt.meme_id = m.id
    and mt.date = v_today;

  update public.memes
  set lifecycle_status = 'cooling'
  where lifecycle_status in ('rising', 'active')
    and moderation_status in ('approved', 'limited')
    and not exists (
      select 1
      from public.meme_trend_metrics t
      where t.meme_id = memes.id
        and t.date > v_today - 30
        and (t.views + t.comments + t.reactions) > 0
    );

  update public.memes
  set lifecycle_status = 'rising'
  where moderation_status in ('approved', 'limited')
    and trend_score > 300
    and published_at > now() - interval '14 days'
    and lifecycle_status <> 'rising';

  delete from public.view_events
  where created_at < now() - interval '30 days';

  select
    count(*) filter (where public.is_meme_rank_eligible(m.id)),
    count(*) filter (where not public.is_meme_rank_eligible(m.id))
  into v_eligible_count, v_incomplete_count
  from public.memes m
  where m.moderation_status in ('approved', 'limited');

  select coalesce(jsonb_agg(row_to_json(top_rows) order by top_rows.rank), '[]'::jsonb)
  into v_top
  from (
    select
      row_number() over (order by m.trend_score desc, m.id desc) rank,
      m.id,
      m.title,
      m.safety_level,
      round(m.trend_score::numeric, 3) trend_score,
      public.meme_ranking_completeness(m.id) completeness,
      true as has_cover
    from public.memes m
    where m.moderation_status in ('approved', 'limited')
      and public.is_meme_rank_eligible(m.id)
    order by m.trend_score desc, m.id desc
    limit 10
  ) top_rows;

  update public.job_runs
  set
    finished_at = now(),
    ok = true,
    detail = jsonb_build_object(
      'algorithm', 'content_views_v3',
      'eligible_count', v_eligible_count,
      'incomplete_count', v_incomplete_count,
      'top', v_top
    )
  where id = v_run_id;
end
$$;

revoke execute on function public.compute_trend_scores() from public, anon, authenticated;
grant execute on function public.compute_trend_scores() to service_role;

commit;
