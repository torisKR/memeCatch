import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const postgresBin = existsSync("/opt/homebrew/opt/postgresql@17/bin/initdb")
  ? "/opt/homebrew/opt/postgresql@17/bin"
  : null;
const postgresCommand = (name) => postgresBin ? join(postgresBin, name) : name;

// Real PostgreSQL, but a disposable, Unix-socket-only fixture database.
// Never reads application credentials or connects to Supabase/production.
test("the anonymous public projection exposes only verified public productions", () => {
  const directory = mkdtempSync(join(tmpdir(), "memecatch-produced-video-pg-"));
  const dataDirectory = join(directory, "data");
  const run = (command, args, input) => {
    const result = spawnSync(command, args, { input, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, `${command}: ${result.error?.message ?? result.stderr}`);
    return result.stdout;
  };

  run(postgresCommand("initdb"), ["-D", dataDirectory, "--auth=trust", "--no-locale"]);
  let started = false;
  try {
    run(postgresCommand("pg_ctl"), [
      "-D", dataDirectory,
      "-l", join(directory, "postgres.log"),
      "-o", `-c listen_addresses='' -k ${directory}`,
      "-w", "start",
    ]);
    started = true;

    const migration = readFileSync(
      resolve("supabase/migrations/20261012230000_video_production_pipeline.sql"),
      "utf8",
    );
    const visibilityMigration = readFileSync(
      resolve("supabase/migrations/20261018095034_public_produced_video_visibility.sql"),
      "utf8",
    );
    const rightsValidator = migration.match(
      /create or replace function public\.video_assets_rights_valid\(p_assets jsonb\)[\s\S]*?grant execute on function public\.video_assets_rights_valid\(jsonb\) to anon, authenticated, service_role;/,
    )?.[0];
    const baselinePublicView = migration.match(
      /create view public\.public_meme_produced_videos[\s\S]*?grant select on table public\.public_meme_produced_videos to anon, authenticated;/,
    )?.[0];
    const publicOnlyView = visibilityMigration.match(
      /create or replace view public\.public_meme_produced_videos[\s\S]*?grant select on table public\.public_meme_produced_videos to anon, authenticated;/,
    )?.[0];
    assert.ok(rightsValidator, "reuse the migration's actual rights validator and grants");
    assert.ok(baselinePublicView, "reuse the baseline migration's actual public projection and grants");
    assert.ok(publicOnlyView, "reuse the forward migration's actual public-only projection and grants");

    const validAssets = JSON.stringify([
      {
        id: "voice-1", kind: "voice", acquisition_method: "self_created",
        owner: "MemeCatch", evidence: "fixture", allow_edit: true,
        allow_youtube: true, allow_commercial: true, territories: ["worldwide"],
        reviewed_by: "operator", reviewed_at: "2026-10-18T00:00:00Z",
      },
      {
        id: "font-1", kind: "font", acquisition_method: "self_created",
        owner: "MemeCatch", evidence: "fixture", allow_edit: true,
        allow_youtube: true, allow_commercial: true, territories: ["worldwide"],
        reviewed_by: "operator", reviewed_at: "2026-10-18T00:00:00Z",
      },
      {
        id: "graphic-1", kind: "graphic", acquisition_method: "self_created",
        owner: "MemeCatch", evidence: "fixture", allow_edit: true,
        allow_youtube: true, allow_commercial: true, territories: ["worldwide"],
        reviewed_by: "operator", reviewed_at: "2026-10-18T00:00:00Z",
      },
    ]).replaceAll("'", "''");

    const output = run(postgresCommand("psql"), [
      "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", directory, "-d", "postgres",
    ], `
begin;
create role anon;
create role authenticated;
create role service_role;

create table public.video_productions (
  id uuid primary key,
  meme_id uuid not null,
  artifact_hash text,
  approved_artifact_hash text,
  status text not null,
  assets_json jsonb not null
);
create table public.youtube_publications (
  id uuid primary key,
  production_id uuid not null,
  youtube_video_id text,
  content_id uuid,
  artifact_hash text,
  approved_publication_hash text,
  approved_visibility text,
  privacy_status text,
  processing_status text,
  status text,
  embeddable boolean,
  embed_smoke_verified boolean,
  embed_smoke_verified_hash text,
  site_linked_at timestamptz
);
create table public.meme_contents (
  id uuid primary key,
  production_id uuid,
  caption text,
  availability text,
  moderation_status text
);
create table public.video_production_jobs (
  id uuid primary key,
  publication_id uuid,
  production_id uuid,
  input_hash text,
  kind text,
  status text,
  output_json jsonb,
  completed_at timestamptz,
  updated_at timestamptz
);
create table public.video_production_reselection_blocks (meme_id uuid primary key);

${rightsValidator}

insert into public.video_productions
  (id, meme_id, artifact_hash, approved_artifact_hash, status, assets_json)
values
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', repeat('d', 64), repeat('d', 64), 'approved', '${validAssets}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', repeat('d', 64), repeat('d', 64), 'approved', '${validAssets}'::jsonb),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', repeat('d', 64), repeat('d', 64), 'approved', '${validAssets}'::jsonb),
  ('10000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', repeat('d', 64), repeat('d', 64), 'approved', '${validAssets}'::jsonb),
  ('10000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', repeat('d', 64), repeat('d', 64), 'rendered', '${validAssets}'::jsonb),
  ('10000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', repeat('d', 64), repeat('d', 64), 'approved', '${validAssets}'::jsonb),
  ('10000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000007', repeat('d', 64), repeat('d', 64), 'approved', '${validAssets}'::jsonb),
  ('10000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000008', repeat('d', 64), repeat('d', 64), 'approved', '[]'::jsonb);

insert into public.meme_contents (id, production_id, caption, availability, moderation_status)
select ('20000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
       ('10000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
       'fixture ' || number, 'live', case when number = 6 then 'pending' else 'approved' end
  from generate_series(1, 8) as number;

insert into public.youtube_publications (
  id, production_id, youtube_video_id, content_id, artifact_hash,
  approved_publication_hash, approved_visibility, privacy_status,
  processing_status, status, embeddable, embed_smoke_verified,
  embed_smoke_verified_hash, site_linked_at
)
select ('50000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
       ('10000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
       'video-' || number,
       ('20000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
       case when number = 4 then repeat('e', 64) else repeat('d', 64) end,
       case when number = 4 then repeat('e', 64) else repeat('d', 64) end,
       case when number = 2 then 'unlisted' else 'public' end,
       case when number = 2 then 'unlisted' when number = 3 then 'private' else 'public' end,
       'succeeded', 'site_linked', true, true,
       case when number = 4 then repeat('e', 64) else repeat('d', 64) end,
       now()
  from generate_series(1, 8) as number;

insert into public.video_production_jobs
  (id, publication_id, production_id, input_hash, kind, status, output_json, completed_at, updated_at)
values
  ('40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', repeat('d', 64), 'sync', 'completed',
   '{"youtubeVideoId":"video-1","embedVerified":true,"processingStatus":"succeeded","privacyStatus":"public","embeddable":true}'::jsonb, now(), now()),
  ('40000000-0000-4000-8000-000000000071', '50000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', repeat('d', 64), 'sync', 'completed',
   '{"youtubeVideoId":"video-7","embedVerified":true,"processingStatus":"succeeded","privacyStatus":"public","embeddable":true}'::jsonb, now() - interval '1 minute', now() - interval '1 minute'),
  ('40000000-0000-4000-8000-000000000072', '50000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', repeat('d', 64), 'monitor', 'completed',
   '{"youtubeVideoId":"video-7","embedVerified":false,"processingStatus":"succeeded","privacyStatus":"public","embeddable":true}'::jsonb, now(), now());

${baselinePublicView}

set local role anon;
select 'BASELINE_UNLISTED_VISIBLE=' || (exists (
  select 1 from public.public_meme_produced_videos
   where production_id = '10000000-0000-4000-8000-000000000002'
))::text;
reset role;

${publicOnlyView}
${publicOnlyView}

set local role anon;
select jsonb_build_object(
  'public_positive', exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000001'
       and public_embed_verified
  ),
  'unlisted_hidden', not exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000002'
  ),
  'private_hidden', not exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000003'
  ),
  'wrong_hash_hidden', not exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000004'
  ),
  'unapproved_production_hidden', not exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000005'
  ),
  'rejected_child_hidden', not exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000006'
  ),
  'latest_false_proof_remains_false', exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000007'
       and public_embed_verified is false
  ),
  'invalid_rights_hidden', not exists (
    select 1 from public.public_meme_produced_videos
     where production_id = '10000000-0000-4000-8000-000000000008'
  ),
  'anonymous_can_execute_current_rights_validator',
    has_function_privilege(current_user, 'public.video_assets_rights_valid(jsonb)', 'execute'),
  'anonymous_current_rights_validator_accepts_fixture',
    public.video_assets_rights_valid('${validAssets}'::jsonb)
)::text;
rollback;
`);

    assert.match(output, /BASELINE_UNLISTED_VISIBLE=true/);
    const evidenceLine = output.trim().split("\n").findLast((line) => line.startsWith("{"));
    assert.ok(evidenceLine, `missing JSON evidence in psql output: ${output}`);
    const evidence = JSON.parse(evidenceLine);
    assert.deepEqual(evidence, {
      public_positive: true,
      unlisted_hidden: true,
      private_hidden: true,
      wrong_hash_hidden: true,
      unapproved_production_hidden: true,
      rejected_child_hidden: true,
      latest_false_proof_remains_false: true,
      invalid_rights_hidden: true,
      anonymous_can_execute_current_rights_validator: true,
      anonymous_current_rights_validator_accepts_fixture: true,
    });
    console.log("11 visibility checks passed; baseline plus idempotent forward migration and actual rights validator.");
  } finally {
    if (started) {
      run(postgresCommand("pg_ctl"), ["-D", dataDirectory, "-m", "fast", "-w", "stop"]);
    }
    console.log(`Stopped disposable local PostgreSQL; diagnostics retained at ${directory}`);
  }
});
