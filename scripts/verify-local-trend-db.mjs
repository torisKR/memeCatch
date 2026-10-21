import fs from "node:fs";
import { spawnSync } from "node:child_process";

const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
function sql(input, file) {
  const args = [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1"];
  if (file) args.push("-f", file);
  const result = spawnSync("psql", args, { input, encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0 || /(?:^|\n)\s*not ok \d+/u.test(result.stdout ?? "")) {
    process.exit(result.status || 1);
  }
}

// Refresh only the new, undeployed function definitions after local iteration.
// Never reset the database or drop application tables/data.
if (process.argv.includes("--refresh-functions") || process.argv.includes("--refresh-functions-only")) {
  sql(`begin;
    alter table public.radar_collection_runs
      add column if not exists observation_scope text not null default '',
      add column if not exists policy_config_fingerprint text
        check (policy_config_fingerprint is null or policy_config_fingerprint ~ '^[a-f0-9]{64}$');
    do $local_refresh$
    begin
      if not exists (select 1 from pg_constraint where conrelid = 'public.external_signals'::regclass and conname = 'external_signals_runtime_raw_retention_max_30d') then
        alter table public.external_signals add constraint external_signals_runtime_raw_retention_max_30d
          check (raw_expires_at <= collected_at + interval '30 days') not valid;
      end if;
      if not exists (select 1 from pg_constraint where conrelid = 'public.radar_metric_snapshots'::regclass and conname = 'radar_metric_snapshots_runtime_retention_max_30d') then
        alter table public.radar_metric_snapshots add constraint radar_metric_snapshots_runtime_retention_max_30d
          check (retention_until <= collected_at + interval '30 days') not valid;
      end if;
    end;
    $local_refresh$;
    commit;`);
  for (const file of [
    "supabase/migrations/20261013130000_trend_collection_runtime.sql",
    "supabase/migrations/20261013140000_trend_evidence_review_integrity.sql",
  ]) {
    const source = fs.readFileSync(file, "utf8");
    const statements = source.match(/create or replace function[\s\S]*?\$function\$;/gu) ?? [];
    const grants = source.match(/grant execute on function[^;]+;/gu) ?? [];
    const triggers = source.match(/drop trigger if exists[\s\S]*?for each row execute function[^;]+;/gu) ?? [];
    const policyStart = source.indexOf("drop policy if exists public_meme_trend_summaries_public_read");
    const policyEnd = source.indexOf("drop function", policyStart);
    const publicPolicy = policyStart < 0 ? "" : source.slice(policyStart, policyEnd);
    // SQL strings may contain semicolons. Do not split INSERT statements on them.
    const seedStart = source.indexOf("insert into public.radar_source_policies");
    const seeds = seedStart < 0 || process.argv.includes("--refresh-functions-only")
      ? "" : source.slice(seedStart, source.lastIndexOf("commit;"));
    sql(`begin;\n${statements.join("\n")}\n${grants.join("\n")}\n${triggers.join("\n")}\n${publicPolicy}\n${seeds}\ncommit;`);
  }
}
for (const file of [
  "supabase/tests/trend_collection_runtime.sql",
  "supabase/tests/trend_evidence_review_integrity.sql",
]) sql(undefined, file);
