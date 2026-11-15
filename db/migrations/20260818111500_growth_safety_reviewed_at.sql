begin;

alter table public.memes
  add column if not exists safety_reviewed_at timestamptz;

update public.memes as meme
   set safety_reviewed_at = history.reviewed_at
  from (
    select event.meme_id, max(event.created_at) as reviewed_at
      from public.meme_public_change_events as event
     where event.kind = 'safety_update'
     group by event.meme_id
  ) as history
 where meme.id = history.meme_id
   and meme.safety_reviewed_at is null;

create or replace function public.touch_meme_safety_reviewed_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.safety_level is distinct from old.safety_level
     or new.usage_context is distinct from old.usage_context
     or new.usage_note is distinct from old.usage_note
     or new.caution is distinct from old.caution then
    new.safety_reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists memes_touch_safety_reviewed_at on public.memes;
create trigger memes_touch_safety_reviewed_at
before update of safety_level, usage_context, usage_note, caution on public.memes
for each row execute function public.touch_meme_safety_reviewed_at();

commit;
