// Assemble an isolated trend-evidence activation candidate from the last
// verified production source plus only this feature's reviewed files.
// This script never deploys, reads secrets, or mutates a database/cloud service.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = "/Users/toris/projects/memecatch";
const output = join(root, "artifacts/release/20261013-trend-evidence", process.argv[2] ?? "source");
const baselineStatePath = join(root, "artifacts/release/20261012-structured-data/source-final4/release-state.json");
const baselineManifestPath = join(root, "artifacts/release/20261012-structured-data/source-final4/source-manifest.json");
const expected = Object.freeze({
  head: "26ff7783cb6e051418ef6246e9bfb484fef15d62",
  files: 72,
  releaseSha: "schema-62cce611d3e0",
  sourceManifestSha: "62cce611d3e09a32eeae6daf8340fc76d97de8ea0cc760eb5773c5ee23662135",
  source: "/private/tmp/memecatch-schema-source.xZVxjl",
  productionDeployment: "dpl_FY57rzndWB2SQhtnxczsCBwiqQnY",
});

const directOverlay = [
  ".env.example",
  "app/(default)/admin/trend-candidates/entry-form.test.tsx",
  "app/(default)/admin/trend-candidates/entry-form.tsx",
  "app/(default)/admin/trend-candidates/page.tsx",
  "app/(default)/admin/trend-candidates/review-form.test.tsx",
  "app/(default)/admin/trend-candidates/review-form.tsx",
  "app/(default)/admin/trend-candidates/signal-review-form.tsx",
  "app/(default)/page.tsx",
  "app/api/cron/trend-discovery/route.test.ts",
  "app/api/cron/trend-discovery/route.ts",
  "app/api/cron/trend-pulse/route.test.ts",
  "app/api/cron/trend-pulse/route.ts",
  "components/home/home-experience.tsx",
  "components/home/home-trend-discovery.tsx",
  "components/meme-external-trend-evidence.test.tsx",
  "components/meme-external-trend-evidence.tsx",
  "docs/operations/trend-evidence-pipeline.md",
  "docs/operations/trend-evidence-project-audit.md",
  "lib/actions/trend-candidate-entry.test.ts",
  "lib/actions/trend-candidate-entry.ts",
  "lib/actions/trend-candidates.test.ts",
  "lib/actions/trend-candidates.ts",
  "lib/database.types.ts",
  "lib/supabase/public-catalog-cache.test.ts",
  "lib/supabase/public-catalog-cache.ts",
  "lib/trend/assessment-runtime.server.test.ts",
  "lib/trend/assessment-runtime.server.ts",
  "lib/trend/candidate-discovery.test.ts",
  "lib/trend/candidate-discovery.ts",
  "lib/trend/database-contract.ts",
  "lib/trend/discovery-collector.test.ts",
  "lib/trend/discovery-collector.ts",
  "lib/trend/discovery-runtime.server.test.ts",
  "lib/trend/discovery-runtime.server.ts",
  "lib/trend/draft-completion.server.test.ts",
  "lib/trend/draft-completion.server.ts",
  "lib/trend/evidence-draft.test.ts",
  "lib/trend/evidence-draft.ts",
  "lib/trend/external-evidence.test.ts",
  "lib/trend/external-evidence.ts",
  "lib/trend/legacy-policy-gate.test.ts",
  "lib/trend/legacy-policy-gate.ts",
  "lib/trend/observation-assessment.test.ts",
  "lib/trend/observation-assessment.ts",
  "lib/trend/public-evidence.server.ts",
  "lib/trend/pulse.server.test.ts",
  "lib/trend/pulse.server.ts",
  "lib/trend/radar-platform-connectors.server.test.ts",
  "lib/trend/radar-platform-connectors.server.ts",
  "lib/trend/radar-pulse.server.test.ts",
  "lib/trend/radar-pulse.server.ts",
  "lib/trend/radar-repository.server.ts",
  "lib/trend/radar.ts",
  "scripts/trend-discovery-local.mjs",
  "scripts/trend-runtime-local.mjs",
  "scripts/trend-runtime-local.test.ts",
  "scripts/verify-local-trend-db.mjs",
  "supabase/migrations/20261013120000_trend_evidence_pipeline.sql",
  "supabase/migrations/20261013130000_trend_collection_runtime.sql",
  "supabase/migrations/20261013140000_trend_evidence_review_integrity.sql",
  "supabase/migrations/20261013150000_trend_evidence_scheduler.sql",
  "supabase/tests/trend_collection_runtime.sql",
  "supabase/tests/trend_evidence_review_integrity.sql",
  "supabase/trend_collection_runtime_contract.test.ts",
  "supabase/trend_evidence_pipeline_contract.test.ts",
  "supabase/trend_evidence_review_integrity.test.ts",
  "supabase/trend_evidence_scheduler_contract.test.ts",
  "vercel.json",
].sort();

const generatedOverlay = [
  "app/(default)/memes/[key]/page.test.ts",
  "app/(default)/memes/[key]/page.tsx",
  "components/admin/admin-nav.test.tsx",
  "components/admin/admin-nav.tsx",
].sort();

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safePath(base, path) {
  if (!path || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`Unsafe release path: ${path}`);
  }
  const target = resolve(base, path);
  const prefix = resolve(base) + sep;
  if (!target.startsWith(prefix)) throw new Error(`Release path escaped root: ${path}`);
  return target;
}

async function copyRegularFile(fromBase, toBase, path) {
  const from = safePath(fromBase, path);
  const stat = await lstat(from);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Release input is not a regular file: ${path}`);
  const to = safePath(toBase, path);
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to);
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected exactly one release patch anchor: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

async function patchBaselineFile(sourceRoot, path, patches) {
  const target = safePath(sourceRoot, path);
  let contents = await readFile(target, "utf8");
  for (const patch of patches) contents = replaceOnce(contents, patch.before, patch.after, `${path}:${patch.label}`);
  await writeFile(target, contents);
}

const baselineState = JSON.parse(await readFile(baselineStatePath, "utf8"));
const baselineManifest = JSON.parse(await readFile(baselineManifestPath, "utf8"));
for (const key of ["head", "files", "releaseSha", "sourceManifestSha", "source"]) {
  if (baselineState[key] !== expected[key]) throw new Error(`Pinned baseline mismatch for ${key}`);
}
if (!Array.isArray(baselineManifest) || baselineManifest.length !== expected.files) {
  throw new Error("Pinned baseline manifest count mismatch");
}
if (sha256(JSON.stringify(baselineManifest)) !== expected.sourceManifestSha) {
  throw new Error("Pinned baseline manifest hash mismatch");
}
const seenBaseline = new Set();
for (const entry of baselineManifest) {
  if (!entry || typeof entry.path !== "string" || typeof entry.sha256 !== "string" || seenBaseline.has(entry.path)) {
    throw new Error("Pinned baseline manifest contains an invalid or duplicate entry");
  }
  seenBaseline.add(entry.path);
  const bytes = await readFile(safePath(expected.source, entry.path));
  if (sha256(bytes) !== entry.sha256) throw new Error(`Frozen baseline modified: ${entry.path}`);
}

const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (head !== expected.head) throw new Error("Git baseline moved; re-evaluate isolation");
const source = await mkdtemp("/private/tmp/memecatch-trend-source.");
const archive = execFileSync("git", ["archive", head], { cwd: root, maxBuffer: 100_000_000 });
execFileSync("tar", ["-x", "-f", "-", "-C", source], { input: archive });
for (const entry of baselineManifest) await copyRegularFile(expected.source, source, entry.path);

for (const path of directOverlay.filter((path) => ![
  ".env.example",
  "lib/supabase/public-catalog-cache.test.ts",
  "lib/supabase/public-catalog-cache.ts",
].includes(path))) {
  await copyRegularFile(root, source, path);
}

await patchBaselineFile(source, ".env.example", [{
  label: "bounded trend runtime variables",
  before: "# ─── Radar 외부 신호 (선택, 전부 서버 전용) ──────────────────────\n",
  after: "# ─── Radar 외부 신호 (선택, 전부 서버 전용) ──────────────────────\n# 기본 비활성. 운영 DB 마이그레이션과 출처별 정책 검수 후에만 true로 전환합니다.\nRADAR_DISCOVERY_ENABLED=false\n# 기존 CRON_SECRET과 분리된 trend-discovery 전용 bearer. 운영 Vault에도 같은 값을 등록합니다.\nTREND_CRON_SECRET=\n# 1인 운영 초기 상한. 성과 보장치가 아니며 후보/AI 초안이 이 값을 채우지 않아도 됩니다.\nRADAR_DISCOVERY_DAILY_CANDIDATE_LIMIT=150\nRADAR_AI_DRAFT_DAILY_LIMIT=20\nRADAR_AI_DRAFT_ENABLED=false\n# YouTube search quota 확인 후 설정. 두 lane 합산 호출은 하루 100회를 넘지 않습니다.\nRADAR_YOUTUBE_DAILY_CALL_LIMIT=90\n# 신규 표현 탐색과 기존 후보 추적의 호출 예산을 분리합니다.\nRADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN=20\nRADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN=30\n",
}]);

await patchBaselineFile(source, "components/admin/admin-nav.tsx", [
  {
    label: "trend review nav entry",
    before: '  { href: "/admin/mpe", label: "MPE 검수", icon: InboxIcon },\n',
    after: '  { href: "/admin/mpe", label: "MPE 검수", icon: InboxIcon },\n  { href: "/admin/trend-candidates", label: "외부 확산 후보", icon: RadarIcon },\n',
  },
  {
    label: "radar icon",
    before: 'function UsersIcon({ className }: { className?: string }) {\n',
    after: 'function RadarIcon({ className }: { className?: string }) {\n  return (\n    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>\n      <circle cx="12" cy="12" r="8" />\n      <circle cx="12" cy="12" r="3" />\n      <path d="M12 4v8l5 3" strokeLinecap="round" strokeLinejoin="round" />\n    </svg>\n  );\n}\n\nfunction UsersIcon({ className }: { className?: string }) {\n',
  },
]);

await patchBaselineFile(source, "components/admin/admin-nav.test.tsx", [{
  label: "trend review nav test",
  before: "\n});\n",
  after: '\n\n  it("links to the external spread review queue and marks it active", () => {\n    navigation.pathname = "/admin/trend-candidates";\n    const html = renderToStaticMarkup(<AdminNav />);\n    expect(html).toContain("외부 확산 후보");\n    expect(html).toMatch(/<a href="\\/admin\\/trend-candidates" aria-current="page"/);\n  });\n});\n',
}]);

await patchBaselineFile(source, "app/(default)/memes/[key]/page.tsx", [
  {
    label: "trend detail imports",
    before: 'import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";\n',
    after: 'import { canonicalMemeRedirectPath } from "@/lib/canonical-meme-path";\nimport { MemeExternalTrendEvidence } from "@/components/meme-external-trend-evidence";\nimport { getPublicMemeTrendSummary } from "@/lib/trend/public-evidence.server";\n',
  },
  {
    label: "trend detail lookup",
    before: "  const [related, reactionCounts, marketPassport, availableTranslationLocales] = await Promise.all([\n",
    after: "  const [related, reactionCounts, marketPassport, availableTranslationLocales, externalTrendEvidence] = await Promise.all([\n",
  },
  {
    label: "trend detail lookup promise",
    before: "    getAvailableTranslationLocales(meme.id),\n  ]);\n",
    after: "    getAvailableTranslationLocales(meme.id),\n    getPublicMemeTrendSummary(meme.id),\n  ]);\n",
  },
  {
    label: "trend detail panel",
    before: "          <SafetyRationale\n",
    after: "          <MemeExternalTrendEvidence evidence={externalTrendEvidence} />\n\n          <SafetyRationale\n",
  },
]);

await patchBaselineFile(source, "app/(default)/memes/[key]/page.test.ts", [{
  label: "trend detail contract test",
  before: "\n});\n",
  after: '\n\n  it("shows only the reviewed public external-spread projection", () => {\n    expect(source).toContain("getPublicMemeTrendSummary(meme.id)");\n    expect(source).toContain("<MemeExternalTrendEvidence evidence={externalTrendEvidence} />");\n  });\n});\n',
}]);

await patchBaselineFile(source, "lib/supabase/public-catalog-cache.ts", [
  {
    label: "trend cache projections",
    before: "]);\nconst publicStatuses = \"in.(approved,limited)\";\n",
    after: ']);\nconst trendSummaryProjection = "meme_id,external_state,reason,evidence_scope,independent_use_count,external_score,confidence,evidence_links,last_verified_at,stale_after";\nconst trendMemeProjection = "id,short_id,slug,title,summary,moderation_status";\nconst publicStatuses = "in.(approved,limited)";\n',
  },
  {
    label: "bounded trend cache reads",
    before: '    const eligible = url.origin === origin && url.href.length <= 4096\n      && method === "GET" && (list || search)\n      && projections.has(projection)\n      && url.searchParams.getAll("moderation_status").length === 1\n      && url.searchParams.get("moderation_status") === publicStatuses\n',
    after: '    const publicCatalogRead = (list || search)\n      && projections.has(projection)\n      && url.searchParams.getAll("moderation_status").length === 1\n      && url.searchParams.get("moderation_status") === publicStatuses;\n    const trendSummaryRead = url.pathname === "/rest/v1/public_meme_trend_summaries"\n      && projection === trendSummaryProjection\n      && (\n        /^eq\\.[0-9a-f-]{36}$/iu.test(url.searchParams.get("meme_id") ?? "")\n        || boundedLimit(url.searchParams.get("limit"))\n      );\n    const trendMemeRead = url.pathname === "/rest/v1/memes"\n      && projection === trendMemeProjection\n      && url.searchParams.get("moderation_status") === "eq.approved"\n      && /^in\\.\\([0-9a-f,-]{36,295}\\)$/iu.test(url.searchParams.get("id") ?? "");\n    const eligible = url.origin === origin && url.href.length <= 4096\n      && method === "GET" && (publicCatalogRead || trendSummaryRead || trendMemeRead)\n',
  },
]);

await patchBaselineFile(source, "lib/supabase/public-catalog-cache.test.ts", [{
  label: "trend cache contract test",
  before: "\n  it.each([\n",
  after: '\n  it("caches only the bounded public trend projection and its approved meme lookup", async () => {\n    const fetch = vi.fn().mockImplementation(async () => new Response("[]", { headers: { "content-type": "application/json" } }));\n    vi.stubGlobal("fetch", fetch);\n    const supabase = createSupabaseClient("https://test.supabase.co", "anon-key", {\n      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },\n      global: { fetch: createPublicCatalogFetch("https://test.supabase.co", "anon-key") },\n    });\n    const memeId = "11111111-1111-4111-8111-111111111111";\n    await supabase\n      .from("public_meme_trend_summaries")\n      .select("meme_id, external_state, reason, evidence_scope, independent_use_count, external_score, confidence, evidence_links, last_verified_at, stale_after")\n      .eq("meme_id", memeId)\n      .maybeSingle();\n    await supabase\n      .from("memes")\n      .select("id, short_id, slug, title, summary, moderation_status")\n      .in("id", [memeId])\n      .eq("moderation_status", "approved");\n\n    expect(fetch).toHaveBeenCalledTimes(2);\n    for (const [, options] of fetch.mock.calls) {\n      expect(options).toMatchObject({\n        method: "GET",\n        cache: "force-cache",\n        next: { revalidate: 60, tags: [PUBLIC_CATALOG_CACHE_TAG] },\n      });\n    }\n  });\n\n  it.each([\n',
}]);

// Project linking metadata is local and intentionally omitted from the build payload.
await mkdir(join(source, ".vercel"), { recursive: true });
await copyRegularFile(root, source, ".vercel/project.json");
await symlink(join(root, "node_modules"), join(source, "node_modules"), "dir");

const files = [...new Set([
  ...baselineManifest.map((entry) => entry.path),
  ...directOverlay,
  ...generatedOverlay,
])].sort();
const manifest = [];
for (const path of files) manifest.push({ path, sha256: sha256(await readFile(safePath(source, path))) });
const sourceManifestSha = sha256(JSON.stringify(manifest));
const releaseSha = `trend-${sourceManifestSha.slice(0, 12)}`;

const excludedBuildRoots = new Set([
  ".codegraph", ".vercel", ".next", "node_modules", ".local", ".claude", ".worktrees",
  ".omx", ".omo", ".codex", ".agents", ".aws", ".pnpm-store", ".playwright-mcp",
  ".playwright-cli", ".firecrawl", ".gjc", ".gstack", "terraform", "artifacts", "output",
]);
function includeInBuild(path) {
  const rel = relative(source, path);
  if (!rel) return true;
  const parts = rel.split(sep);
  if (excludedBuildRoots.has(parts[0])) return false;
  const name = parts.at(-1);
  if (name.startsWith(".env") || name === ".mcp.local.json" || name.endsWith(".tsbuildinfo")) return false;
  return true;
}
const build = await mkdtemp("/private/tmp/memecatch-trend-build.");
await cp(source, build, { recursive: true, filter: includeInBuild });
await symlink(join(root, "node_modules"), join(build, "node_modules"), "dir");

const forbidden = files.filter((path) =>
  path === ".env" || (path.startsWith(".env.") && path !== ".env.example") || path.startsWith("artifacts/") ||
  path.startsWith(".local/") || path.startsWith(".vercel/") || /(^|\/)secrets?(\/|$)/iu.test(path),
);
if (forbidden.length) throw new Error(`Forbidden deployment payload paths: ${forbidden.join(", ")}`);
for (const [label, tree] of [["source", source], ["build", build]]) {
  if (relative("/private/tmp", tree).startsWith("..")) throw new Error(`${label} tree must remain under /private/tmp`);
}

await mkdir(output, { recursive: true });
const state = {
  head,
  source,
  build,
  files: files.length,
  overlayFiles: directOverlay.length + generatedOverlay.length,
  generatedOverlapFiles: generatedOverlay.length,
  sourceManifestSha,
  releaseSha,
  baselineReleaseSha: expected.releaseSha,
  baselineSourceManifestSha: expected.sourceManifestSha,
  baselineFilesVerified: baselineManifest.length,
  baselineProductionDeployment: expected.productionDeployment,
  productionMutations: 0,
  secretsRead: 0,
  excludedFeatureOverlays: ["video-production", "bulk-content-ingestion", "unrelated-home-ui"],
};
await writeFile(join(output, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
await writeFile(join(output, "changed-files.txt"), `${[...directOverlay, ...generatedOverlay].sort().join("\n")}\n`, { flag: "wx" });
await writeFile(join(output, "release-state.json"), `${JSON.stringify(state, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(state));
