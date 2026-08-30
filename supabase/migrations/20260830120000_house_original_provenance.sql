-- CatchMeme house-original provenance (자체 제작)
--
--   pending  --human: is this actually ours?-->  fact_checking
--     |                                              |
--     x INSERT approved/limited blocked              v
--                                               rights_checking
--                                                    |
--                         publish_house_original RPC (operator, in-transaction evidence)
--                                                    |
--                                          approved or limited
--                                                    |
--                    origin/copy/media edit or rights revoke --> rights_checking
--
-- v1 evidence lives on meme_sources (CatchMeme canonical URL + source_role=original
-- + rights_basis=creator_permission) plus memes.house_rights_attested_at.
-- Do not attach via meme_media: that table requires media_sources.source_id and
-- defaults review_state=pending (20260723120000_source_pipeline.sql).
-- logAudit is an app-side service-role insert AFTER status update; this RPC
-- must not require a uid row in admin_audit_log.

alter table public.memes
  add column if not exists origin_kind text not null default 'catalog',
  add column if not exists house_rights_attested_at timestamptz;

alter table public.memes
  drop constraint if exists memes_origin_kind_check;

alter table public.memes
  add constraint memes_origin_kind_check
  check (origin_kind in ('catalog', 'house_original'));

comment on column public.memes.origin_kind is
  'catalog = internet meme documented by CatchMeme; house_original = CatchMeme-authored.';
comment on column public.memes.house_rights_attested_at is
  'Operator attestation timestamp required to publish a house original. Null until publish_house_original.';

create index if not exists memes_house_original_idx
  on public.memes (origin_kind)
  where origin_kind = 'house_original';

-- Public source ledger extras for house-original rights evidence.
-- Catalog rows stay null (not usage_example) so house originals cannot inherit a silent default.
alter table public.meme_sources
  add column if not exists source_role text,
  add column if not exists rights_basis text;

alter table public.meme_sources
  drop constraint if exists meme_sources_source_role_check,
  drop constraint if exists meme_sources_rights_basis_check;

alter table public.meme_sources
  add constraint meme_sources_source_role_check
  check (source_role is null or source_role in (
    'original',
    'official_reupload',
    'earliest_known',
    'secondary_reference',
    'usage_example'
  )),
  add constraint meme_sources_rights_basis_check
  check (rights_basis is null or rights_basis in (
    'official_embed',
    'creator_permission',
    'creative_commons',
    'public_data',
    'link_only',
    'unknown',
    'blocked'
  ));

-- Allow published house originals to return to rights_checking on copy/rights revoke.
create or replace function public.check_moderation_transition() returns trigger
language plpgsql as $$
begin
  if old.moderation_status = new.moderation_status then return new; end if;
  if not (
    (old.moderation_status = 'pending' and new.moderation_status in ('fact_checking','rejected')) or
    (old.moderation_status = 'fact_checking' and new.moderation_status in ('rights_checking','rejected','pending')) or
    (old.moderation_status = 'rights_checking' and new.moderation_status in ('approved','limited','rejected','fact_checking')) or
    (old.moderation_status = 'limited' and new.moderation_status in ('approved','rejected','fact_checking','rights_checking')) or
    (old.moderation_status = 'approved' and new.moderation_status in ('limited','fact_checking','rights_checking'))
  ) then
    raise exception 'invalid moderation transition: % -> %', old.moderation_status, new.moderation_status;
  end if;
  if new.moderation_status in ('approved','limited') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

create or replace function public.house_original_has_rights_evidence(p_meme_id uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.meme_sources s
     where s.meme_id = p_meme_id
       and s.source_role = 'original'
       and s.rights_basis = 'creator_permission'
       and s.source_url is not null
       and btrim(s.source_url) <> ''
       and s.source_url ~* '^https?://'
  );
$$;

revoke all on function public.house_original_has_rights_evidence(uuid)
  from public, anon, authenticated;
grant execute on function public.house_original_has_rights_evidence(uuid)
  to service_role;

-- INSERT / origin_kind flip / publish-without-evidence / copy-edit revert.
-- Named trg_house_original_* so it runs before trg_meme_moderation (h < m).
create or replace function public.guard_house_original_memes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'INSERT' then
    if new.origin_kind = 'house_original' then
      if new.moderation_status is distinct from 'pending' then
        raise exception using errcode = '22023',
          message = 'house_original_insert_not_pending';
      end if;
      if new.house_rights_attested_at is not null then
        raise exception using errcode = '22023',
          message = 'house_original_insert_not_pending';
      end if;
    end if;
    return new;
  end if;

  if new.origin_kind is distinct from old.origin_kind then
    raise exception using errcode = '22023',
      message = 'house_original_origin_kind_immutable';
  end if;

  if old.origin_kind = 'house_original'
     and old.moderation_status in ('approved', 'limited')
     and (
       new.title is distinct from old.title
       or new.summary is distinct from old.summary
       or new.description is distinct from old.description
       or new.origin is distinct from old.origin
       or new.usage_note is distinct from old.usage_note
       or new.caution is distinct from old.caution
     ) then
    new.moderation_status := 'rights_checking';
    new.house_rights_attested_at := null;
  end if;

  if new.origin_kind = 'house_original'
     and new.moderation_status in ('approved', 'limited')
     and new.moderation_status is distinct from old.moderation_status then
    if new.house_rights_attested_at is null then
      raise exception using errcode = '22023',
        message = 'house_rights_attestation_required';
    end if;
    if not public.house_original_has_rights_evidence(new.id) then
      raise exception using errcode = '22023',
        message = 'house_original_rights_required';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_house_original_guard on public.memes;
create trigger trg_house_original_guard
before insert or update on public.memes
for each row execute function public.guard_house_original_memes();

revoke all on function public.guard_house_original_memes()
  from public, anon, authenticated;

-- Rights-revoke and media edits: any source/content change on a published
-- house original returns it to rights_checking (evidence is re-checked).
create or replace function public.revert_house_original_on_related_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_meme_id uuid;
begin
  v_meme_id := coalesce(new.meme_id, old.meme_id);
  update public.memes
     set moderation_status = 'rights_checking',
         house_rights_attested_at = null,
         updated_at = now()
   where id = v_meme_id
     and origin_kind = 'house_original'
     and moderation_status in ('approved', 'limited');
  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_house_original_source_revert on public.meme_sources;
create trigger trg_house_original_source_revert
after insert or update or delete on public.meme_sources
for each row execute function public.revert_house_original_on_related_change();

drop trigger if exists trg_house_original_content_revert on public.meme_contents;
create trigger trg_house_original_content_revert
after insert or update or delete on public.meme_contents
for each row execute function public.revert_house_original_on_related_change();

revoke all on function public.revert_house_original_on_related_change()
  from public, anon, authenticated;

-- One operator RPC: checks evidence in-transaction, then status update.
-- Does not write admin_audit_log (app logAudit runs afterwards).
create or replace function public.publish_house_original(
  p_meme_id uuid,
  p_to public.moderation_status,
  p_attested boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.memes%rowtype;
begin
  if not public.is_operator() then
    raise exception using errcode = '42501', message = 'operator_required';
  end if;
  if p_to not in ('approved', 'limited') then
    raise exception using errcode = '22023',
      message = 'house_original_publish_target_invalid';
  end if;
  if p_attested is not true then
    raise exception using errcode = '22023',
      message = 'house_rights_attestation_required';
  end if;

  select * into v_row
    from public.memes
   where id = p_meme_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'meme_not_found';
  end if;
  if v_row.origin_kind is distinct from 'house_original' then
    raise exception using errcode = '22023', message = 'house_original_required';
  end if;
  if v_row.moderation_status = p_to then
    return true;
  end if;
  if not public.house_original_has_rights_evidence(p_meme_id) then
    raise exception using errcode = '22023',
      message = 'house_original_rights_required';
  end if;

  update public.memes
     set house_rights_attested_at = now(),
         moderation_status = p_to,
         updated_at = now()
   where id = p_meme_id;

  return true;
end;
$function$;

revoke all on function public.publish_house_original(
  uuid, public.moderation_status, boolean
) from public, anon;
grant execute on function public.publish_house_original(
  uuid, public.moderation_status, boolean
) to authenticated;
grant execute on function public.publish_house_original(
  uuid, public.moderation_status, boolean
) to service_role;
