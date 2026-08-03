/**
 * 데이터 품질 검사기 (읽기 전용).
 *
 *   node scripts/quality-check.mts             — 사람이 읽는 요약 + 리포트 파일 갱신
 *   node scripts/quality-check.mts --json      — JSON도 stdout으로
 *   node scripts/quality-check.mts --fail-on=high   — high 이상 위반 시 exit 1
 *
 * 설계 원칙 (LOOP.md「자동 검수 도구」):
 *   - GET만 보낸다. 쓰기 경로가 코드에 없다.
 *   - 충실도 판정은 lib/content-depth.ts를 그대로 재사용한다. sitemap·robots와
 *     같은 함수를 쓰므로 "색인에서 빠진 문서 수"와 리포트 수치가 갈리지 않는다.
 *   - PostgREST 헬퍼는 scripts/source-pipeline-rest.mjs를 재사용한다.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { restAll } from "./source-pipeline-rest.mjs";
import { contentDepth } from "../lib/content-depth.ts";
import {
  UNAVAILABLE_STATUSES,
  isRenderableContent,
} from "../lib/content-availability.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = resolve(ROOT, "docs/renewal/DATA_QUALITY_REPORT.json");

/** 공개(=200으로 렌더되는) 상태. app/sitemap.ts의 PUBLIC_STATUSES와 같아야 한다. */
const PUBLIC_STATUSES = ["approved", "limited"] as const;

/** 표본 ID는 리포트에 이만큼만 남긴다(운영자가 바로 열어볼 최소량). */
const SAMPLE_LIMIT = 10;

type Severity = "critical" | "high" | "medium";

type Row = {
  id: string;
  short_id: string;
  title: string;
  aliases: string[] | null;
  summary: string | null;
  description: string | null;
  origin: string | null;
  usage_note: string | null;
  caution: string | null;
  usage_context: Record<string, string> | null;
  usage_examples: unknown;
  origin_year: number | null;
  moderation_status: string;
  updated_at: string;
  meme_sources: { source_url: string | null; copyright_status: string }[];
  meme_contents: {
    availability: string;
    moderation_status: string;
    is_representative: boolean;
    thumbnail_url: string | null;
  }[];
  meme_tags_map: { tag_id: string }[];
};

type Check = {
  id: string;
  severity: Severity;
  title: string;
  count: number;
  ratio: number;
  samples: string[];
};

const SELECT = [
  "id,short_id,title,aliases,summary,description,origin,usage_note,caution",
  "usage_context,usage_examples,origin_year,moderation_status,updated_at",
  "meme_sources(source_url,copyright_status)",
  "meme_contents(availability,moderation_status,is_representative,thumbnail_url)",
  "meme_tags_map(tag_id)",
].join(",");

/** .env.local이 없는 워크스테이션도 있어 후보 파일을 순서대로 본다(첫 매치 사용). */
function loadEnvFromFiles(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of [".env.local", ".env.production", ".env.development"]) {
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) break;
    let raw: string;
    try {
      raw = readFileSync(resolve(ROOT, name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/**
 * anon 키로만 읽는다. 두 가지 이유가 있다.
 *   1) 최소 권한 — 이 도구는 어떤 쓰기도 하지 않으므로 service_role이 필요 없다.
 *   2) 검사 대상이 "공개된 화면"이라 RLS를 통과한 뒤의 데이터를 보는 게 정확하다.
 *      approved/limited 밈과 그 출처·콘텐츠·태그는 공개 읽기 정책이 열려 있다.
 */
function createReadOnlyClient(env: NodeJS.ProcessEnv) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 누락 (.env.local·.env.production)",
    );
  }
  return async function rest(path: string) {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new Error(`GET ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return res.json();
  };
}

/** 공백·문장부호를 지우고 소문자화 — "사실상 같은 제목"을 한 키로 모은다. */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 상세 페이지가 실제로 렌더하는 대표 콘텐츠(page.tsx의 liveContents와 같은 판정). */
function hasRenderableRepresentative(row: Row): boolean {
  return row.meme_contents.some((c) => c.is_representative && isRenderableContent(c));
}

function sourceUrls(row: Row): string[] {
  return row.meme_sources.map((s) => text(s.source_url)).filter(Boolean);
}

/** 4개 상황 신호가 전부 같은 값 — 기계적 기본값이 남아 있다는 신호. */
function isUniformUsageContext(ctx: Record<string, string> | null): boolean {
  if (!ctx) return false;
  const values = Object.values(ctx).filter(Boolean);
  if (values.length < 2) return false;
  return new Set(values).size === 1;
}

/**
 * 화면에 그대로 노출되면 안 되는 문구.
 * 조사 placeholder는 「을(를)」처럼 괄호 대안형이 본문에 남은 경우만 잡는다.
 */
const PLACEHOLDER =
  /을\(를\)|를\(을\)|이\(가\)|은\(는\)|와\(과\)|TODO|TBD|lorem ipsum|\{\{|placeholder/i;

function hasPlaceholder(row: Row): boolean {
  return [row.summary, row.description, row.origin, row.usage_note, row.caution].some(
    (v) => PLACEHOLDER.test(text(v)),
  );
}

export function buildChecks(rows: Row[]): Check[] {
  const total = rows.length || 1;
  const mk = (id: string, severity: Severity, title: string, hits: Row[]): Check => ({
    id,
    severity,
    title,
    count: hits.length,
    ratio: Number((hits.length / total).toFixed(4)),
    samples: hits.slice(0, SAMPLE_LIMIT).map((r) => r.short_id),
  });

  // 정규화 제목이 겹치는 그룹 — 검색·랭킹에 같은 밈이 두 번 노출된다.
  const byNormTitle = new Map<string, Row[]>();
  for (const r of rows) {
    const key = normalizeTitle(r.title);
    byNormTitle.set(key, [...(byNormTitle.get(key) ?? []), r]);
  }
  const dupRows = [...byNormTitle.values()].filter((g) => g.length > 1).flat();

  // 다른 문서의 정식 제목을 alias로 들고 있는 문서 — 검색 결과가 서로를 가린다.
  const titleIndex = new Map(rows.map((r) => [normalizeTitle(r.title), r.id]));
  const aliasCollisions = rows.filter((r) =>
    (r.aliases ?? []).some((a) => {
      const other = titleIndex.get(normalizeTitle(a));
      return other !== undefined && other !== r.id;
    }),
  );

  return [
    mk(
      "DQ-C1-published-without-source",
      "critical",
      "공개 문서인데 근거 출처 URL이 하나도 없음",
      rows.filter((r) => sourceUrls(r).length === 0),
    ),
    mk(
      "DQ-C2-dead-representative",
      "critical",
      "대표 콘텐츠가 dead/region_blocked인데 계속 공개 중",
      rows.filter((r) =>
        r.meme_contents.some(
          (c) =>
            c.is_representative &&
            UNAVAILABLE_STATUSES.some((s) => s === c.availability),
        ),
      ),
    ),
    mk(
      "DQ-C3-duplicate-canonical-title",
      "critical",
      "정규화 후 제목이 겹치는 공개 문서(중복 노출)",
      dupRows,
    ),
    mk(
      "DQ-C4-alias-title-collision",
      "critical",
      "다른 공개 문서의 정식 제목을 alias로 보유",
      aliasCollisions,
    ),
    mk(
      "DQ-H1-thin-document",
      "high",
      "충실도 미달(색인 제외 + 정리 중 배너 노출) 문서",
      rows.filter((r) => contentDepth(r).isThin),
    ),
    mk(
      "DQ-H2-uniform-usage-context",
      "high",
      "상황별 사용 신호가 전부 동일(기계적 기본값 의심)",
      rows.filter((r) => isUniformUsageContext(r.usage_context)),
    ),
    mk(
      "DQ-H3-no-representative-content",
      "high",
      "렌더 가능한 대표 콘텐츠 없음",
      rows.filter((r) => !hasRenderableRepresentative(r)),
    ),
    mk(
      "DQ-H4-rights-unknown",
      "high",
      "출처의 권리 근거가 unknown인 채로 공개",
      rows.filter((r) => r.meme_sources.some((s) => s.copyright_status === "unknown")),
    ),
    mk(
      "DQ-M1-origin-year-missing",
      "medium",
      "발생 연도 없음",
      rows.filter((r) => r.origin_year === null),
    ),
    mk(
      "DQ-M2-no-tags",
      "medium",
      "태그 없음(탐색·관련 밈 품질 저하)",
      rows.filter((r) => r.meme_tags_map.length === 0),
    ),
    mk(
      "DQ-M3-placeholder-text",
      "medium",
      "공개 본문에 템플릿·조사 placeholder 잔존",
      rows.filter(hasPlaceholder),
    ),
  ];
}

export function buildReport(rows: Row[]) {
  const checks = buildChecks(rows);
  const depths = rows.map((r) => contentDepth(r));
  const substantial = depths.filter((d) => d.isSubstantial).length;
  const divisor = rows.length || 1;

  return {
    generatedAt: new Date().toISOString(),
    scope: { moderationStatus: [...PUBLIC_STATUSES], documents: rows.length },
    depth: {
      // lib/content-depth.ts 기준 — sitemap·robots 판정과 같은 값이다.
      substantial,
      thin: rows.length - substantial,
      substantialRatio: Number((substantial / divisor).toFixed(4)),
      avgScore: Number((depths.reduce((s, d) => s + d.score, 0) / divisor).toFixed(2)),
      avgProseChars: Math.round(
        depths.reduce((s, d) => s + d.proseChars, 0) / divisor,
      ),
    },
    checks,
  };
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium"];

async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes("--json");
  const failOn = (args.find((a) => a.startsWith("--fail-on="))?.split("=")[1] ??
    "critical") as Severity | "none";

  const rest = createReadOnlyClient(loadEnvFromFiles());
  const statusFilter = `in.(${PUBLIC_STATUSES.join(",")})`;
  const rows = (await restAll(
    rest,
    `memes?select=${SELECT}&moderation_status=${statusFilter}`,
    { pageSize: 500 },
  )) as Row[];

  const report = buildReport(rows);

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  if (jsonOnly) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const { depth, scope } = report;
    console.log(
      `공개 문서 ${scope.documents}건 · 충실 ${depth.substantial}건 (${(depth.substantialRatio * 100).toFixed(1)}%)`,
    );
    console.log(
      `평균 충실도 ${depth.avgScore}/13 · 평균 고유 산문 ${depth.avgProseChars}자\n`,
    );
    for (const sev of SEVERITY_ORDER) {
      for (const c of report.checks.filter((x) => x.severity === sev)) {
        const pct = (c.ratio * 100).toFixed(1).padStart(5);
        const flag = c.count === 0 ? "OK  " : sev.slice(0, 4).toUpperCase();
        console.log(
          `${flag} ${pct}%  ${String(c.count).padStart(5)}  ${c.id} — ${c.title}`,
        );
      }
    }
    console.log(`\n리포트: ${REPORT_PATH}`);
  }

  if (failOn === "none") return;
  const blocking = SEVERITY_ORDER.slice(0, SEVERITY_ORDER.indexOf(failOn) + 1);
  const violated = report.checks.filter(
    (c) => blocking.includes(c.severity) && c.count > 0,
  );
  if (violated.length > 0) {
    console.error(`\n실패: ${violated.length}개 검사가 ${failOn} 이상 위반`);
    process.exitCode = 1;
  }
}

// 테스트가 순수 함수(buildChecks/buildReport)만 import할 수 있도록,
// 네트워크를 타는 main은 이 파일을 직접 실행했을 때만 돈다.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}

export type { Row, Check, Severity };
