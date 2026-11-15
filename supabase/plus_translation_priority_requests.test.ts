import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "./migrations/20260809120000_plus_translation_priority_requests.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("Plus translation priority request migration contract", () => {
  it("defines a constrained, uniquely owned request queue with useful indexes", () => {
    expect(migration).toMatch(/create table if not exists public\.plus_translation_requests/i);
    expect(migration).toMatch(/id uuid primary key default gen_random_uuid\(\)/i);
    expect(migration).toMatch(/user_id uuid not null references public\.profiles\(id\)/i);
    expect(migration).toMatch(/meme_id uuid not null references public\.memes\(id\)/i);
    expect(migration).toMatch(/locale in \('en', 'ja', 'zh', 'zh-tw'\)/i);
    expect(migration).toMatch(/status in \('requested', 'in_review', 'completed', 'dismissed'\)/i);
    expect(migration).toMatch(/unique \(user_id, meme_id, locale\)/i);
    expect(migration).toMatch(/plus_translation_requests_queue_idx[\s\S]*where status in \('requested', 'in_review'\)/i);
    expect(migration).toMatch(/plus_translation_requests_user_pending_idx[\s\S]*where status in \('requested', 'in_review'\)/i);
  });

  it("keeps direct inserts closed while allowing only self and operator RLS access", () => {
    expect(migration).toMatch(/alter table public\.plus_translation_requests enable row level security/i);
    expect(migration).toMatch(/create policy plus_translation_requests_self_read[\s\S]*for select to authenticated[\s\S]*user_id = \(select auth\.uid\(\)\)[\s\S]*public\.has_active_plus\(\(select auth\.uid\(\)\)\)/i);
    expect(migration).toMatch(/create policy plus_translation_requests_operator_read[\s\S]*for select to authenticated[\s\S]*public\.is_operator\(\)/i);
    expect(migration).toMatch(/create policy plus_translation_requests_operator_update[\s\S]*for update to authenticated[\s\S]*using \(public\.is_operator\(\)\)[\s\S]*with check \(public\.is_operator\(\)\)/i);
    expect(migration).toMatch(/revoke all on table public\.plus_translation_requests from public, anon, authenticated/i);
    expect(migration).toMatch(/grant select, update on table public\.plus_translation_requests to authenticated/i);
    expect(migration).not.toMatch(/create policy plus_translation_requests[^;]*for insert/i);
    expect(migration).not.toMatch(/grant insert on table public\.plus_translation_requests/i);
  });

  it("gates request creation by auth, active Plus, saved ownership, public visibility, and locale", () => {
    expect(migration).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(migration).toMatch(/message = 'auth_required'/i);
    expect(migration).toMatch(/public\.has_active_plus\(v_uid\)[\s\S]*message = 'plus_required'/i);
    expect(migration).toMatch(/v_locale not in \('en', 'ja', 'zh', 'zh-tw'\)[\s\S]*message = 'invalid_locale'/i);
    expect(migration).toMatch(/from public\.memes m[\s\S]*m\.id = p_meme_id[\s\S]*m\.moderation_status in \('approved', 'limited'\)/i);
    expect(migration).toMatch(/from public\.saved_memes sm[\s\S]*sm\.user_id = v_uid[\s\S]*sm\.meme_id = p_meme_id/i);
    expect(migration).toMatch(/insert into public\.plus_translation_requests[\s\S]*values \([\s\S]*v_uid,[\s\S]*p_meme_id,[\s\S]*v_locale/i);
    expect(migration).not.toMatch(/p_user_id/i);
  });

  it("is idempotent for available and pending translations and bounds user demand", () => {
    expect(migration).toMatch(/mt\.status = 'reviewed'[\s\S]*mt\.source_updated_at = v_meme\.updated_at[\s\S]*'already_available'/i);
    expect(migration).toMatch(/v_existing\.status in \('requested', 'in_review'\)[\s\S]*'already_requested'/i);
    expect(migration).toMatch(/pg_advisory_xact_lock\(hashtextextended\('plus_translation:' \|\| v_uid::text, 0\)\)/i);
    expect(migration).toMatch(/r\.user_id = v_uid[\s\S]*r\.status in \('requested', 'in_review'\)[\s\S]*v_pending_count >= 20/i);
    expect(migration).toMatch(/message = 'too_many_translation_requests'/i);
    expect(migration).toMatch(/on conflict \(user_id, meme_id, locale\) do update[\s\S]*set status = 'requested'/i);
  });

  it("exposes an operator-only queue aggregated and ordered by demand", () => {
    expect(migration).toMatch(/function public\.list_translation_priority_queue\([\s\S]*p_limit integer default 50/i);
    expect(migration).toMatch(/if not public\.is_operator\(\)[\s\S]*message = 'operator_required'/i);
    expect(migration).toMatch(/count\(\*\) as request_count[\s\S]*max\(r\.created_at\) as latest_requested_at/i);
    expect(migration).toMatch(/where r\.status in \('requested', 'in_review'\)[\s\S]*group by r\.meme_id, r\.locale/i);
    expect(migration).toMatch(/join public\.memes m on m\.id = d\.meme_id[\s\S]*left join public\.meme_translations mt/i);
    expect(migration).toMatch(/order by d\.request_count desc, d\.latest_requested_at desc/i);
    expect(migration).toMatch(/limit p_limit/i);
  });

  it("lets only operators claim every matching requested row", () => {
    expect(migration).toMatch(/function public\.claim_translation_priority_request\(\s*p_meme_id uuid,\s*p_locale text\s*\)/i);
    expect(migration).toMatch(/if not public\.is_operator\(\)[\s\S]*message = 'operator_required'/i);
    expect(migration).toMatch(/update public\.plus_translation_requests r[\s\S]*set status = 'in_review'[\s\S]*r\.meme_id = p_meme_id[\s\S]*r\.locale = v_locale[\s\S]*r\.status = 'requested'/i);
  });

  it("completes current reviewed demand and idempotently alerts active Plus requesters", () => {
    expect(migration).toMatch(/new\.status <> 'reviewed'[\s\S]*new\.source_updated_at = m\.updated_at/i);
    expect(migration).toMatch(/insert into public\.meme_public_change_events[\s\S]*'translation_reviewed'[\s\S]*on conflict do nothing/i);
    expect(migration).toMatch(/from public\.meme_public_change_events e[\s\S]*e\.kind = 'translation_reviewed'[\s\S]*e\.source_updated_at = new\.updated_at/i);
    expect(migration).toMatch(/update public\.plus_translation_requests r[\s\S]*set status = 'completed',[\s\S]*completed_at = now\(\)[\s\S]*r\.status in \('requested', 'in_review'\)/i);
    expect(migration).toMatch(/insert into public\.plus_saved_context_alerts \(user_id, event_id\)[\s\S]*public\.has_active_plus\(c\.user_id\)[\s\S]*on conflict \(user_id, event_id\) do nothing/i);
    expect(migration).toMatch(/after insert or update of status, source_updated_at, updated_at[\s\S]*on public\.meme_translations/i);
  });

  it("pins function search paths and explicitly revokes and grants RPC execution", () => {
    expect(migration.match(/set search_path = pg_catalog/gi)).toHaveLength(5);
    expect(migration).toMatch(/revoke all on function public\.request_plus_translation\(uuid, text\)[\s\S]*from public, anon[\s\S]*grant execute on function public\.request_plus_translation\(uuid, text\)[\s\S]*to authenticated/i);
    expect(migration).toMatch(/revoke all on function public\.list_translation_priority_queue\(integer\)[\s\S]*from public, anon[\s\S]*grant execute on function public\.list_translation_priority_queue\(integer\)[\s\S]*to authenticated/i);
    expect(migration).toMatch(/revoke all on function public\.claim_translation_priority_request\(uuid, text\)[\s\S]*from public, anon[\s\S]*grant execute on function public\.claim_translation_priority_request\(uuid, text\)[\s\S]*to authenticated/i);
    expect(migration).toMatch(/revoke all on function public\.complete_plus_translation_requests\(\)[\s\S]*from public, anon, authenticated/i);
  });
});
