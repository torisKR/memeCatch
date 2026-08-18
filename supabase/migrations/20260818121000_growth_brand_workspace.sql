create table public.brand_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  brand_name text not null check (btrim(brand_name) <> '' and char_length(brand_name) <= 80),
  brand_context text not null check (btrim(brand_context) <> '' and char_length(brand_context) <= 2000),
  brand_tone text not null check (btrim(brand_tone) <> '' and char_length(brand_tone) <= 500),
  forbidden_expressions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_workspaces_id_owner_key unique (id, owner_id),
  constraint brand_workspaces_forbidden_expressions_check check (
    cardinality(forbidden_expressions) <= 50
    and array_position(forbidden_expressions, '') is null
  )
);

create table public.brand_fit_evaluations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brand_workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  meme_name text not null check (btrim(meme_name) <> '' and char_length(meme_name) <= 120),
  proposed_copy text not null check (btrim(proposed_copy) <> '' and char_length(proposed_copy) <= 2000),
  fit_score smallint not null check (fit_score between 0 and 100),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  rationale text not null check (btrim(rationale) <> '' and char_length(rationale) <= 2000),
  created_at timestamptz not null default now(),
  constraint brand_fit_evaluations_id_owner_key unique (id, owner_id),
  constraint brand_fit_evaluations_workspace_owner_fkey
    foreign key (workspace_id, owner_id)
    references public.brand_workspaces(id, owner_id)
    on delete cascade
);

create index brand_fit_evaluations_owner_created_idx
  on public.brand_fit_evaluations(owner_id, created_at desc);

create table public.brand_approval_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brand_workspaces(id) on delete restrict,
  evaluation_id uuid not null unique references public.brand_fit_evaluations(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  constraint brand_approval_records_workspace_owner_fkey
    foreign key (workspace_id, owner_id)
    references public.brand_workspaces(id, owner_id)
    on delete restrict,
  constraint brand_approval_records_evaluation_owner_fkey
    foreign key (evaluation_id, owner_id)
    references public.brand_fit_evaluations(id, owner_id)
    on delete restrict
);

create index brand_approval_records_owner_created_idx
  on public.brand_approval_records(owner_id, created_at desc);

alter table public.brand_workspaces enable row level security;
alter table public.brand_fit_evaluations enable row level security;
alter table public.brand_approval_records enable row level security;

revoke all on table public.brand_workspaces, public.brand_fit_evaluations,
  public.brand_approval_records from public, anon, authenticated;
grant select on table public.brand_workspaces, public.brand_fit_evaluations,
  public.brand_approval_records to authenticated;

create policy brand_workspaces_owner_read on public.brand_workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.has_active_plus((select auth.uid())));
create policy brand_fit_evaluations_owner_read on public.brand_fit_evaluations
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.has_active_plus((select auth.uid())));
create policy brand_approval_records_owner_read on public.brand_approval_records
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.has_active_plus((select auth.uid())));

create or replace function public.save_brand_workspace(
  p_brand_name text,
  p_brand_context text,
  p_brand_tone text,
  p_forbidden_expressions text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_forbidden text[];
begin
  if v_uid is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if not public.has_active_plus(v_uid) then raise exception using errcode = '42501', message = 'plus_required'; end if;

  select coalesce(array_agg(value order by first_pos), '{}')
    into v_forbidden
    from (
      select min(position) as first_pos, btrim(expression) as value
        from unnest(coalesce(p_forbidden_expressions, '{}')) with ordinality as item(expression, position)
       where btrim(expression) <> '' and char_length(btrim(expression)) <= 100
       group by btrim(expression)
    ) normalized;

  if cardinality(v_forbidden) > 50 then
    raise exception using errcode = '22023', message = 'too_many_forbidden_expressions';
  end if;

  insert into public.brand_workspaces(owner_id, brand_name, brand_context, brand_tone, forbidden_expressions)
  values (v_uid, btrim(p_brand_name), btrim(p_brand_context), btrim(p_brand_tone), v_forbidden)
  on conflict (owner_id) do update
    set brand_name = excluded.brand_name,
        brand_context = excluded.brand_context,
        brand_tone = excluded.brand_tone,
        forbidden_expressions = excluded.forbidden_expressions,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.save_brand_fit_evaluation(
  p_meme_name text,
  p_proposed_copy text,
  p_fit_score smallint,
  p_risk_level text,
  p_rationale text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if not public.has_active_plus(v_uid) then raise exception using errcode = '42501', message = 'plus_required'; end if;
  select id into v_workspace_id from public.brand_workspaces where owner_id = v_uid;
  if v_workspace_id is null then raise exception using errcode = '22023', message = 'workspace_required'; end if;

  insert into public.brand_fit_evaluations(
    workspace_id, owner_id, meme_name, proposed_copy, fit_score, risk_level, rationale
  ) values (
    v_workspace_id, v_uid, btrim(p_meme_name), btrim(p_proposed_copy),
    p_fit_score, p_risk_level, btrim(p_rationale)
  ) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.record_brand_approval(
  p_evaluation_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if not public.has_active_plus(v_uid) then raise exception using errcode = '42501', message = 'plus_required'; end if;
  select workspace_id into v_workspace_id
    from public.brand_fit_evaluations
   where id = p_evaluation_id and owner_id = v_uid;
  if v_workspace_id is null then raise exception using errcode = '22023', message = 'evaluation_not_found'; end if;

  insert into public.brand_approval_records(workspace_id, evaluation_id, owner_id, decision, note)
  values (v_workspace_id, p_evaluation_id, v_uid, p_decision, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'decision_already_recorded';
end;
$function$;

create or replace function public.get_brand_workspace_bundle()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select case
    when auth.uid() is null or not public.has_active_plus(auth.uid()) then null
    else jsonb_build_object(
      'workspace', to_jsonb(w),
      'evaluations', coalesce((
        select jsonb_agg(
          to_jsonb(e) || jsonb_build_object('approval', to_jsonb(a))
          order by e.created_at desc
        )
          from public.brand_fit_evaluations e
          left join public.brand_approval_records a on a.evaluation_id = e.id
         where e.workspace_id = w.id and e.owner_id = auth.uid()
      ), '[]'::jsonb)
    )
  end
  from public.brand_workspaces w
  where w.owner_id = auth.uid();
$function$;

create or replace function public.prevent_brand_approval_mutation()
returns trigger language plpgsql set search_path = pg_catalog
as $function$
begin
  raise exception using errcode = '55000', message = 'brand_approval_records_are_immutable';
end;
$function$;

create trigger brand_approval_records_immutable
before update or delete on public.brand_approval_records
for each row execute function public.prevent_brand_approval_mutation();

revoke all on function public.save_brand_workspace(text, text, text, text[]),
  public.save_brand_fit_evaluation(text, text, smallint, text, text),
  public.record_brand_approval(uuid, text, text),
  public.get_brand_workspace_bundle() from public, anon, authenticated;
grant execute on function public.save_brand_workspace(text, text, text, text[]),
  public.save_brand_fit_evaluation(text, text, smallint, text, text),
  public.record_brand_approval(uuid, text, text),
  public.get_brand_workspace_bundle() to authenticated;
