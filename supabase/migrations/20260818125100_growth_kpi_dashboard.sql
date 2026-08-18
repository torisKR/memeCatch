begin;

create or replace function public.growth_kpi_unavailable(p_reason text)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'available', false,
    'value', null,
    'numerator', 0,
    'denominator', 0,
    'reason', p_reason
  )
$$;

create or replace function public.growth_kpi_ratio(
  p_coverage_complete boolean,
  p_numerator integer,
  p_denominator integer,
  p_incomplete_reason text
) returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when not coalesce(p_coverage_complete, false)
      then public.growth_kpi_unavailable(p_incomplete_reason)
    when coalesce(p_denominator, 0) = 0
      then public.growth_kpi_unavailable('no_denominator')
    else jsonb_build_object(
      'available', true,
      'value', round((p_numerator::numeric * 100) / p_denominator, 1),
      'numerator', p_numerator,
      'denominator', p_denominator,
      'reason', null
    )
  end
$$;

create or replace function public.growth_kpi_average(
  p_coverage_complete boolean,
  p_numerator integer,
  p_denominator integer,
  p_incomplete_reason text
) returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when not coalesce(p_coverage_complete, false)
      then public.growth_kpi_unavailable(p_incomplete_reason)
    when coalesce(p_denominator, 0) = 0
      then public.growth_kpi_unavailable('no_denominator')
    else jsonb_build_object(
      'available', true,
      'value', round(p_numerator::numeric / p_denominator, 1),
      'numerator', p_numerator,
      'denominator', p_denominator,
      'reason', null
    )
  end
$$;

create or replace function public.get_growth_kpi_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_baseline public.growth_funnel_baselines%rowtype;
  v_activation_denominator integer := 0;
  v_activation_numerator integer := 0;
  v_account_denominator integer := 0;
  v_account_numerator integer := 0;
  v_conversion_denominator integer := 0;
  v_conversion_numerator integer := 0;
  v_payment_denominator integer := 0;
  v_payment_numerator integer := 0;
  v_renewal_denominator integer := 0;
  v_renewal_numerator integer := 0;
  v_usage_denominator integer := 0;
  v_usage_numerator integer := 0;
  v_long_coverage boolean := false;
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;

  select baseline.* into v_baseline
    from public.growth_funnel_baselines as baseline
   order by baseline.period_end desc, baseline.captured_at desc
   limit 1;

  if v_baseline.id is null then
    return jsonb_build_object(
      'periodStart', null,
      'periodEnd', null,
      'coverageStart', null,
      'baselineComplete', false,
      'metrics', jsonb_build_object(
        'activation', public.growth_kpi_unavailable('baseline_missing'),
        'account', public.growth_kpi_unavailable('baseline_missing'),
        'conversion', public.growth_kpi_unavailable('baseline_missing'),
        'payment', public.growth_kpi_unavailable('baseline_missing'),
        'renewal', public.growth_kpi_unavailable('baseline_missing'),
        'usage', public.growth_kpi_unavailable('baseline_missing')
      )
    );
  end if;

  if v_baseline.is_complete then
    with views as (
      select distinct coalesce(event.session_id::text, event.user_id::text) as actor
        from public.growth_events as event
       where event.event_name = 'meme_view'
         and event.occurred_at >= v_baseline.period_start
         and event.occurred_at < v_baseline.period_end
         and coalesce(event.session_id::text, event.user_id::text) is not null
    ), actions as (
      select distinct coalesce(event.session_id::text, event.user_id::text) as actor
        from public.growth_events as event
       where event.event_name in ('follow_click', 'copy')
         and event.occurred_at >= v_baseline.period_start
         and event.occurred_at < v_baseline.period_end
         and coalesce(event.session_id::text, event.user_id::text) is not null
    )
    select count(*)::integer,
           count(*) filter (where actions.actor is not null)::integer
      into v_activation_denominator, v_activation_numerator
      from views left join actions using (actor);

    with intents as (
      select event.session_id, min(event.occurred_at) as intended_at,
             bool_or(event.user_id is not null) as already_authenticated
        from public.growth_events as event
       where event.event_name = 'follow_click'
         and event.occurred_at >= v_baseline.period_start
         and event.occurred_at < v_baseline.period_end
         and event.session_id is not null
       group by event.session_id
    )
    select count(*)::integer,
           count(*) filter (where intent.already_authenticated or exists (
             select 1 from public.growth_events as authenticated
              where authenticated.session_id = intent.session_id
                and authenticated.user_id is not null
                and authenticated.occurred_at >= intent.intended_at
                and authenticated.occurred_at < v_baseline.period_end
           ))::integer
      into v_account_denominator, v_account_numerator
      from intents as intent;

    with paywalls as (
      select distinct event.session_id
        from public.growth_events as event
       where event.event_name = 'paywall_view'
         and event.occurred_at >= v_baseline.period_start
         and event.occurred_at < v_baseline.period_end
         and event.session_id is not null
    ), checkouts as (
      select distinct event.session_id
        from public.growth_events as event
       where event.event_name = 'checkout_start'
         and event.occurred_at >= v_baseline.period_start
         and event.occurred_at < v_baseline.period_end
         and event.session_id is not null
    )
    select count(*)::integer,
           count(*) filter (where checkouts.session_id is not null)::integer
      into v_conversion_denominator, v_conversion_numerator
      from paywalls left join checkouts using (session_id);

    with checkouts as (
      select distinct event.order_id
        from public.growth_events as event
       where event.event_name = 'checkout_start'
         and event.occurred_at >= v_baseline.period_start
         and event.occurred_at < v_baseline.period_end
         and event.order_id is not null
    ), payments as (
      select distinct event.order_id
        from public.growth_events as event
       where event.event_name = 'payment_confirmed'
         and event.occurred_at >= v_baseline.period_start
         and event.occurred_at < v_baseline.period_end
         and event.order_id is not null
    )
    select count(*)::integer,
           count(*) filter (where payments.order_id is not null)::integer
      into v_payment_denominator, v_payment_numerator
      from checkouts left join payments using (order_id);
  end if;

  v_long_coverage := v_baseline.is_complete
    and v_baseline.coverage_start is not null
    and v_baseline.coverage_start <= v_baseline.period_end - interval '60 days';

  if v_long_coverage then
    with first_payments as (
      select event.user_id, min(event.occurred_at) as first_paid_at
        from public.growth_events as event
       where event.event_name = 'payment_confirmed'
         and event.user_id is not null
         and event.occurred_at < v_baseline.period_end
       group by event.user_id
    ), cohort as (
      select * from first_payments
       where first_paid_at >= v_baseline.period_end - interval '60 days'
         and first_paid_at < v_baseline.period_end - interval '30 days'
    )
    select count(*)::integer,
           count(*) filter (where exists (
             select 1 from public.growth_events as renewal
              where renewal.event_name = 'renewal'
                and renewal.user_id = cohort.user_id
                and renewal.occurred_at > cohort.first_paid_at
                and renewal.occurred_at <= cohort.first_paid_at + interval '35 days'
           ))::integer
      into v_renewal_denominator, v_renewal_numerator
      from cohort;

    with eligible_paid as (
      select distinct payment.user_id
        from public.growth_events as payment
       where payment.event_name = 'payment_confirmed'
         and payment.user_id is not null
         and payment.occurred_at <= v_baseline.period_end - interval '30 days'
         and exists (
           select 1 from public.billing_subscriptions as subscription
            where subscription.user_id = payment.user_id
              and subscription.status = 'active'
              and subscription.current_period_end >= v_baseline.period_end
         )
    )
    select count(*)::integer,
           coalesce(sum((
             select count(*) from public.growth_events as copy
              where copy.event_name = 'copy'
                and copy.user_id = paid.user_id
                and copy.occurred_at >= v_baseline.period_end - interval '30 days'
                and copy.occurred_at < v_baseline.period_end
           )), 0)::integer
      into v_usage_denominator, v_usage_numerator
      from eligible_paid as paid;
  end if;

  return jsonb_build_object(
    'periodStart', v_baseline.period_start,
    'periodEnd', v_baseline.period_end,
    'coverageStart', v_baseline.coverage_start,
    'baselineComplete', v_baseline.is_complete,
    'metrics', jsonb_build_object(
      'activation', public.growth_kpi_ratio(v_baseline.is_complete, v_activation_numerator, v_activation_denominator, 'baseline_incomplete'),
      'account', public.growth_kpi_ratio(v_baseline.is_complete, v_account_numerator, v_account_denominator, 'baseline_incomplete'),
      'conversion', public.growth_kpi_ratio(v_baseline.is_complete, v_conversion_numerator, v_conversion_denominator, 'baseline_incomplete'),
      'payment', public.growth_kpi_ratio(v_baseline.is_complete, v_payment_numerator, v_payment_denominator, 'baseline_incomplete'),
      'renewal', public.growth_kpi_ratio(v_long_coverage, v_renewal_numerator, v_renewal_denominator, 'long_coverage_incomplete'),
      'usage', public.growth_kpi_average(v_long_coverage, v_usage_numerator, v_usage_denominator, 'long_coverage_incomplete')
    )
  );
end;
$$;

revoke all on function public.growth_kpi_unavailable(text) from public, anon, authenticated;
revoke all on function public.growth_kpi_ratio(boolean, integer, integer, text) from public, anon, authenticated;
revoke all on function public.growth_kpi_average(boolean, integer, integer, text) from public, anon, authenticated;
revoke all on function public.get_growth_kpi_dashboard() from public, anon, authenticated;
grant execute on function public.get_growth_kpi_dashboard() to authenticated;

commit;
