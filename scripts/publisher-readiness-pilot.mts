/** Read-only, bounded triage. No source fetching, human approval or DB writes. */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyPublisherReadiness,
  type PublisherReadinessRow,
} from "../lib/publisher-readiness.ts";

export const PILOT_LIMIT = 20;
export const PRIORITY_SHORT_IDS = ["89b37mrx", "2au7br9f"] as const;
const SELECT = "id,short_id,slug,title,summary,description,origin,usage_note,caution,usage_examples,moderation_status,published_at,updated_at,safety_level,safety_reviewed_at,house_rights_attested_at,meme_sources(*),meme_contents(*),meme_tags_map(tag_id)";

export function pilotTarget(raw: string, source: "local" | "production"): URL {
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("A bare Supabase origin is required");
  }
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  const production = url.protocol === "https:" && !url.port
    && /^[a-z0-9-]+\.supabase\.(co|in)$/.test(url.hostname);
  if (source === "local" ? !local : !production) throw new Error("Target does not match the explicit source");
  return url;
}

export function buildPublisherPilot(rows: readonly PublisherReadinessRow[], source: "local" | "production", now = new Date()) {
  const seen = new Set<string>();
  const publicRows = rows.filter((row) => {
    if (!["approved", "limited"].includes(row.moderation_status) || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, PILOT_LIMIT);
  const items = publicRows.map((row) => classifyPublisherReadiness(row, now));
  return {
    version: 1,
    checkedAt: now.toISOString(),
    source,
    requested: PILOT_LIMIT,
    inspected: items.length,
    coverage: items.length === PILOT_LIMIT ? "requested-sample" : "partial-sample",
    humanReviewCompleted: false,
    sourcePlaybackVerified: false,
    accountApprovalVerified: false,
    writesPerformed: false,
    missingPriorityShortIds: PRIORITY_SHORT_IDS.filter((id) => !items.some((item) => item.shortId === id)),
    issueCounts: Object.fromEntries([...new Set(items.flatMap((item) => item.issueCodes))]
      .map((code) => [code, items.filter((item) => item.issueCodes.includes(code)).length])),
    items: items.map((item) => ({
      shortId: item.shortId, title: item.title, path: item.publicHref,
      moderation: item.moderationStatus, issueCodes: item.issueCodes,
      rights: item.rights.status, media: item.media.status,
      sourceFreshness: item.sourceFreshness.status, safety: item.safety.status,
      humanReview: item.review.status, fingerprint: item.fingerprint,
    })),
  };
}

export async function readPublisherPilot(base: URL, anonKey: string, request: typeof fetch = fetch) {
  if (!anonKey || anonKey.startsWith("sb_secret_")) throw new Error("A public anon key is required");
  if (anonKey.split(".").length === 3) {
    let claims;
    try { claims = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString()); }
    catch { throw new Error("Invalid public credential"); }
    if (claims.role !== "anon") throw new Error("Only the anon role is permitted");
  } else if (!anonKey.startsWith("sb_publishable_")) throw new Error("Unknown public credential type");

  async function get(priority: boolean): Promise<PublisherReadinessRow[]> {
    const url = new URL("/rest/v1/memes", base);
    url.search = new URLSearchParams({ select: SELECT,
      moderation_status: "in.(approved,limited)", limit: String(PILOT_LIMIT),
      order: "published_at.desc.nullslast,id.asc",
      ...(priority ? { short_id: `in.(${PRIORITY_SHORT_IDS.join(",")})` } : {}),
    }).toString();
    const response = await request(url, {
      method: "GET", signal: AbortSignal.timeout(15_000),
      headers: { apikey: anonKey, ...(anonKey.startsWith("sb_publishable_") ? {} : { Authorization: `Bearer ${anonKey}` }) },
    });
    if (!response.ok) throw new Error(`Public pilot read failed (HTTP ${response.status})`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Public pilot response was not a list");
    return rows as PublisherReadinessRow[];
  }
  return [...await get(true), ...await get(false)];
}

async function main() {
  const args = process.argv.slice(2);
  const source = args[0];
  if (!["--local-read", "--public-read"].includes(source) || args.length !== 3 || args[1] !== "--out") {
    throw new Error("Usage: node scripts/publisher-readiness-pilot.mts --local-read|--public-read --out <new-report.json>");
  }
  const kind = source === "--local-read" ? "local" : "production";
  const base = pilotTarget(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", kind);
  const rows = await readPublisherPilot(base, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const report = buildPublisherPilot(rows, kind);
  const out = resolve(args[2]);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ report: out, inspected: report.inspected, coverage: report.coverage,
    issueCounts: report.issueCounts, humanReviewCompleted: false, writesPerformed: false }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("Publisher pilot failed; no content, approval or ad settings were changed. Check target, public credential and output path.");
    process.exitCode = 1;
  });
}
