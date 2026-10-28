import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

// Real PostgreSQL, but a disposable, Unix-socket-only fixture database.
// Never reads application credentials or connects to Supabase/production.
test("operator media classification is atomic and never publishes media", () => {
  const directory = mkdtempSync(join(tmpdir(), "memecatch-classification-pg-"));
  const dataDirectory = join(directory, "data");
  const run = (command, args, input) => {
    const result = spawnSync(command, args, { input, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, `${command}: ${result.error?.message ?? result.stderr}`);
    return result.stdout;
  };
  run("initdb", ["-D", dataDirectory, "--auth=trust", "--no-locale"]);
  let started = false;
  try {
    run("pg_ctl", ["-D", dataDirectory, "-l", join(directory, "postgres.log"), "-o", `-c listen_addresses='' -k ${directory}`, "-w", "start"]);
    started = true;
    const migration = readFileSync(resolve("supabase/migrations/20261013215325_operator_meme_media_classification.sql"), "utf8");
    const houseMigration = readFileSync(resolve("supabase/migrations/20260830120000_house_original_provenance.sql"), "utf8");
    const houseGuard = houseMigration.match(/create or replace function public\.guard_house_original_memes\(\)[\s\S]*?\$function\$;/)?.[0];
    assert.ok(houseGuard, "reuse the actual house-original guard, not a replacement stub");
    const output = run("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-h", directory, "-d", "postgres"], `
begin;
create role authenticated;
create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.actor_id', true), '')::uuid
$$;
create function public.is_operator() returns boolean language sql stable as $$
  select current_setting('app.is_operator', true)::boolean
$$;
create type public.safety_level as enum ('green', 'yellow', 'gray', 'red');
create type public.media_type as enum ('image', 'video', 'audio', 'text', 'embed');
create type public.lifecycle_status as enum ('rising', 'active', 'cooling', 'archived');
create type public.meme_category as enum ('phrase', 'dance', 'song', 'image', 'comment', 'challenge');
create type public.meme_difficulty as enum ('beginner', 'normal', 'deep');
create type public.meme_sentiment as enum ('funny', 'ironic', 'controversial', 'negative', 'wholesome');
create table public.memes (
  id uuid primary key, title text, summary text, description text, origin text,
  usage_note text, caution text, aliases text[], lifecycle_status public.lifecycle_status,
  category public.meme_category, difficulty public.meme_difficulty,
  sentiment public.meme_sentiment, origin_year integer, usage_context jsonb,
  updated_at timestamptz, media_type public.media_type not null, safety_level public.safety_level,
  moderation_status text, origin_kind text default 'catalog', house_rights_attested_at timestamptz
);
create table public.admin_audit_log (actor_id uuid, action text, entity_type text, entity_id text, detail jsonb);
create table public.safety_review_queue (id uuid, meme_id uuid, proposed_level public.safety_level);
create table public.meme_contents (id integer, moderation_status text, availability text);
create table public.media_sources (id integer, public_status text, embeddable boolean);
insert into public.meme_contents values (1, 'pending', 'live');
insert into public.media_sources values (1, 'private', false);
create function public.enqueue_safety_review(uuid, public.safety_level, text, jsonb, uuid)
returns uuid language plpgsql as $$ begin
  insert into public.safety_review_queue values ('00000000-0000-0000-0000-000000000099', $1, $2);
  return '00000000-0000-0000-0000-000000000099';
end $$;
create function public.house_original_has_rights_evidence(uuid) returns boolean language sql as $$ select true $$;
${houseGuard}
create trigger trg_house_original_guard before update on public.memes
for each row execute function public.guard_house_original_memes();
${migration}
create function public.fixture_content(p_extra jsonb default '{}') returns jsonb language sql as $$
  select '{"title":"ETA 챌린지","summary":"춤 시연","description":"원래 설명","origin":"확인된 사례",
    "aliases":[],"usage_context":{},"lifecycle_status":"cooling","category":"dance",
    "difficulty":"normal","sentiment":"funny","origin_year":2023}'::jsonb || p_extra
$$;
create table public.fixture_assertions (label text);
create function public.fixture_assert(p_pass boolean, p_label text) returns void language plpgsql as $$ begin
  if p_pass is distinct from true then raise exception 'ASSERTION_FAILED: %', p_label; end if;
  insert into public.fixture_assertions values (p_label);
end $$;
insert into public.memes (id, title, summary, description, origin, aliases, usage_context,
  lifecycle_status, category, difficulty, sentiment, origin_year, media_type, safety_level, moderation_status)
values ('00000000-0000-0000-0000-000000000001', 'ETA 챌린지', '춤 시연', '원래 설명', '확인된 사례', '{}', '{}',
  'cooling', 'dance', 'normal', 'funny', 2023, 'image', 'green', 'approved');
grant usage on schema public, auth to authenticated, anon;
grant select on all tables in schema public to authenticated;
grant insert on public.fixture_assertions to authenticated;
set app.actor_id = '00000000-0000-0000-0000-000000000010';
set app.is_operator = 'true';
set role authenticated;
select public.fixture_assert(not public.update_meme_with_safety_review(
 '00000000-0000-0000-0000-000000000001', public.fixture_content('{"media_type":"video"}'), 'green'), 'classification alone does not queue safety');
select public.fixture_assert((select media_type = 'video' and safety_level = 'green' and
 lifecycle_status = 'cooling' and moderation_status = 'approved' from public.memes), 'parent classification preserves safety life and publication');
select public.fixture_assert((select detail->>'previous_media_type' = 'image' and detail->>'media_type' = 'video'
 and (detail->>'media_type_requested')::boolean from public.admin_audit_log), 'audits actual old and new media types');
select public.fixture_assert((select count(*) = 1 and bool_and(moderation_status = 'pending') from public.meme_contents), 'pending source never published');
select public.fixture_assert((select count(*) = 1 and bool_and(public_status = 'private' and not embeddable) from public.media_sources), 'private source unchanged');
select public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001', public.fixture_content(), 'green');
select public.fixture_assert((select media_type = 'video' from public.memes), 'old callers preserve media type when omitted');
do $$ declare value jsonb; begin
 foreach value in array array['null'::jsonb, '"bogus"'::jsonb, '""'::jsonb, '3'::jsonb, '{}'::jsonb, '[]'::jsonb] loop
  begin
   perform public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001', public.fixture_content(jsonb_build_object('media_type', value)), 'green');
   raise exception 'invalid media type accepted';
  exception when invalid_parameter_value then
   perform public.fixture_assert(sqlerrm = 'invalid_media_type', 'invalid media type rejected: ' || value::text);
  end;
 end loop;
end $$;
select public.fixture_assert((select count(*) = 2 from public.admin_audit_log), 'invalid inputs create no audit or mutation');
do $$ declare value text; begin
 foreach value in array array['image', 'text', 'embed', 'video', 'audio'] loop
  perform public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001',
   public.fixture_content(jsonb_build_object('media_type', value)), 'green');
  perform public.fixture_assert((select media_type::text = value from public.memes), 'valid enum round trip: ' || value);
 end loop;
end $$;
set app.is_operator = 'false';
do $$ begin
 begin
  perform public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001', public.fixture_content(), 'green');
  raise exception 'nonoperator accepted';
 exception when insufficient_privilege then perform public.fixture_assert(sqlerrm = 'operator_required', 'nonoperator denied'); end;
end $$;
reset role;
select set_config('app.is_operator', 'true', true);
select set_config('app.actor_id', '', true);
do $$ begin
 begin
  perform public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001', public.fixture_content(), 'green');
  raise exception 'anonymous actor accepted';
 exception when insufficient_privilege then perform public.fixture_assert(sqlerrm = 'operator_required', 'null actor denied'); end;
end $$;
select public.fixture_assert(not has_function_privilege('anon', 'public.update_meme_with_safety_review(uuid,jsonb,public.safety_level)', 'execute'), 'anon cannot execute');
select set_config('app.actor_id', '00000000-0000-0000-0000-000000000010', true);
set role authenticated;
select public.fixture_assert(public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001',
 public.fixture_content('{"media_type":"audio"}'), 'yellow'), 'safety change is queued through existing mechanism');
select public.fixture_assert((select safety_level = 'green' and media_type = 'audio' from public.memes)
 and (select count(*) = 1 from public.safety_review_queue), 'safety never changed directly');
reset role;
create function public.fixture_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture_audit_failure'; end $$;
create trigger fixture_audit_failure before insert on public.admin_audit_log for each row execute function public.fixture_audit_failure();
set role authenticated;
do $$ begin
 begin
  perform public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001', public.fixture_content('{"media_type":"text"}'), 'red');
  raise exception 'audit failure swallowed';
 exception when raise_exception then
  if sqlerrm <> 'fixture_audit_failure' then raise; end if;
 end;
 perform public.fixture_assert((select media_type = 'audio' from public.memes)
  and (select count(*) = 1 from public.safety_review_queue), 'audit failure rolls classification and queued review back');
end $$;
reset role;
drop trigger fixture_audit_failure on public.admin_audit_log;
-- Arrange an already-reviewed house-original baseline in this disposable fixture.
alter table public.memes disable trigger trg_house_original_guard;
update public.memes set origin_kind = 'house_original', moderation_status = 'approved', house_rights_attested_at = now();
alter table public.memes enable trigger trg_house_original_guard;
set role authenticated;
select public.update_meme_with_safety_review('00000000-0000-0000-0000-000000000001',
 public.fixture_content('{"media_type":"embed","description":"수정한 설명"}'), 'green');
select public.fixture_assert((select moderation_status = 'rights_checking' and house_rights_attested_at is null
 and media_type = 'embed' from public.memes), 'real house-original copy guard still requires rights re-review');
select 'CLASSIFICATION_RUNTIME_ASSERTIONS=' || count(*) from public.fixture_assertions;
rollback;
`);
    assert.match(output, /CLASSIFICATION_RUNTIME_ASSERTIONS=25/);
    console.log("25 SQL assertions passed; isolated fixture only; no external connections or production writes.");
  } finally {
    if (started) run("pg_ctl", ["-D", dataDirectory, "-m", "fast", "-w", "stop"]);
    console.log(`Stopped disposable local PostgreSQL; diagnostics retained at ${directory}`);
  }
});
