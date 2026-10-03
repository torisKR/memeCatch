export type WebMcpResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };

export const WEBMCP_NAV_SECTIONS = {
  home: "/",
  explore: "/explore",
  search: "/search",
  daily: "/daily",
  rankings: "/rankings",
  timeline: "/timeline",
  news: "/news",
} as const;

const oneOf = <T extends readonly string[]>(value: unknown, allowed: T): value is T[number] =>
  typeof value === "string" && allowed.includes(value);

function error(code: string, message: string, retryable = false): WebMcpResult<never> {
  return { ok: false, error: { code, message, retryable } };
}

function referenceResult(value: unknown, limit: number): MemeReferenceResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if ((record.mode !== "hybrid" && record.mode !== "keyword") || !Array.isArray(record.items)
    || record.items.length > limit || (record.reason !== undefined
      && !oneOf(record.reason, ["disabled", "model_unavailable", "index_empty", "rpc_unavailable"]))) return null;
  const items: MemeReference[] = [];
  for (const item of record.items) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id.trim()
      || typeof row.short_id !== "string" || !/^[A-Za-z0-9]{1,32}$/.test(row.short_id)
      || typeof row.slug !== "string" || !row.slug.trim()
      || typeof row.title !== "string" || !row.title.trim() || typeof row.summary !== "string") return null;
    items.push({ id: row.id, short_id: row.short_id, slug: row.slug, title: row.title, summary: row.summary });
  }
  return { mode: record.mode, ...(record.reason === undefined ? {} : { reason: record.reason as MemeReferenceResult["reason"] }), items };
}

async function searchReferences(
  input: Record<string, unknown>, executionSignal: AbortSignal, lifecycleSignal?: AbortSignal,
): Promise<WebMcpResult<MemeReferenceResult>> {
  if (executionSignal.aborted || lifecycleSignal?.aborted) return error("cancelled", "요청이 취소됐어요.");
  if (Object.keys(input).some((key) => key !== "query" && key !== "limit")) return error("invalid_input", "검색어와 결과 개수만 입력해 주세요.");
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (query.length < 2 || query.length > 120) return error("invalid_query", "검색어는 2~120자로 입력해 주세요.");
  const limit = input.limit === undefined ? 12 : input.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20) return error("invalid_limit", "결과 개수는 1~20의 정수로 입력해 주세요.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  executionSignal.addEventListener("abort", cancel, { once: true });
  lifecycleSignal?.addEventListener("abort", cancel, { once: true });
  try {
    const response = await fetch("/api/memes/semantic-search", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, limit }), cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (controller.signal.aborted) return error("cancelled", "요청이 취소됐어요.");
    if (!response.ok) {
      if (response.status === 429) return error("rate_limited", "검색 요청이 많아요. 잠시 후 다시 시도해 주세요.", true);
      if (response.status === 403) return error("forbidden", "이 페이지에서는 검색 요청을 사용할 수 없어요.");
      if (response.status === 400) return error("invalid_query", "검색어와 결과 개수를 확인해 주세요.");
      return error("search_unavailable", "참고 밈 검색을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.", response.status >= 500);
    }
    const value: unknown = await response.json().catch(() => undefined);
    if (controller.signal.aborted) return error("cancelled", "요청이 취소됐어요.");
    const data = referenceResult(value, limit);
    return data ? { ok: true, data } : error("invalid_response", "검색 결과 형식이 올바르지 않아요.");
  } catch {
    return controller.signal.aborted
      ? error("cancelled", "요청이 취소됐어요.")
      : error("search_unavailable", "참고 밈 검색을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.", true);
  } finally {
    executionSignal.removeEventListener("abort", cancel);
    lifecycleSignal?.removeEventListener("abort", cancel);
  }
}

function navigateResult(navigate: (path: string) => void, path: string) {
  navigate(path);
  return { ok: true, data: { navigatedTo: path } } satisfies WebMcpResult<{ navigatedTo: string }>;
}

export function createPublicWebMcpTools(navigate: (path: string) => void, lifecycleSignal?: AbortSignal): WebMcpTool[] {
  return [
    {
      name: "memecatch.navigate",
      title: "밈캐치 페이지 이동",
      description: "밈캐치의 공개 홈, 탐색, 검색, 일간, 랭킹, 연표, 소식 페이지로 이동합니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { section: { type: "string", enum: Object.keys(WEBMCP_NAV_SECTIONS) } },
        required: ["section"],
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: false },
      execute: async ({ section }) => {
        if (!oneOf(section, Object.keys(WEBMCP_NAV_SECTIONS) as Array<keyof typeof WEBMCP_NAV_SECTIONS>)) {
          return error("invalid_section", "지원하는 공개 페이지를 선택해 주세요.");
        }
        return navigateResult(navigate, WEBMCP_NAV_SECTIONS[section]);
      },
    },
    {
      name: "memecatch.search",
      title: "밈 검색",
      description: "밈 이름, 별칭, 초성 검색 결과 페이지로 이동합니다. 검색어는 1~160자여야 합니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { query: { type: "string", minLength: 1, maxLength: 160 } },
        required: ["query"],
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: true },
      execute: async ({ query }) => {
        if (typeof query !== "string" || !query.trim() || query.trim().length > 160) {
          return error("invalid_query", "검색어는 1~160자로 입력해 주세요.");
        }
        return navigateResult(navigate, `/search?q=${encodeURIComponent(query.trim())}`);
      },
    },
    {
      name: "memecatch.search_references",
      title: "상황·의미로 참고 밈 검색",
      description: "상황이나 의미에 맞는 공개 밈을 검색하고 JSON 결과를 반환합니다. 의미 검색이 준비되지 않으면 이름·별칭 검색 결과를 반환합니다. 참고 자료이며 재사용 권한은 별도로 확인해야 합니다.",
      inputSchema: {
        type: "object", additionalProperties: false,
        properties: {
          query: { type: "string", minLength: 2, maxLength: 120 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 12 },
        },
        required: ["query"],
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: true },
      execute: async (input, { signal }) => searchReferences(input, signal, lifecycleSignal),
    },
    {
      name: "memecatch.filter_memes",
      title: "밈 탐색 필터",
      description: "카테고리, 난이도, 생명주기, 미디어, 연대, 플랫폼, 정렬을 적용한 탐색 페이지로 이동합니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", maxLength: 160 },
          category: { type: "string", enum: ["ai-meme", "meme_term", "challenge_dance", "song", "drama_scene", "meme_video"] },
          difficulty: { type: "string", enum: ["beginner", "normal", "deep"] },
          lifecycle: { type: "string", enum: ["rising", "active", "cooling", "archived"] },
          media: { type: "string", enum: ["image", "video", "audio", "text", "embed"] },
          year: { type: "string", enum: ["2020s", "2010s", "2000s"] },
          platform: { type: "string", enum: ["youtube", "youtube_shorts", "tiktok", "instagram"] },
          sort: { type: "string", enum: ["trending", "recent", "popular", "controversial"] },
        },
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: true },
      execute: async (input) => {
        const allowed: Record<string, readonly string[]> = {
          category: ["ai-meme", "meme_term", "challenge_dance", "song", "drama_scene", "meme_video"],
          difficulty: ["beginner", "normal", "deep"],
          lifecycle: ["rising", "active", "cooling", "archived"],
          media: ["image", "video", "audio", "text", "embed"],
          year: ["2020s", "2010s", "2000s"],
          platform: ["youtube", "youtube_shorts", "tiktok", "instagram"],
          sort: ["trending", "recent", "popular", "controversial"],
        };
        const params = new URLSearchParams();
        if (typeof input.query === "string" && input.query.trim()) {
          if (input.query.trim().length > 160) return error("invalid_query", "검색어는 160자 이하여야 해요.");
          params.set("q", input.query.trim());
        }
        for (const [key, values] of Object.entries(allowed)) {
          const value = input[key];
          if (value === undefined) continue;
          if (!oneOf(value, values)) return error(`invalid_${key}`, `${key} 필터 값이 올바르지 않아요.`);
          params.set(key, value);
        }
        const query = params.toString();
        return navigateResult(navigate, query ? `/explore?${query}` : "/explore");
      },
    },
    {
      name: "memecatch.open_meme",
      title: "밈 상세 열기",
      description: "검색이나 탐색 결과에서 얻은 밈 URL key(short_id-slug)를 사용해 상세 페이지로 이동합니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { key: { type: "string", pattern: "^[A-Za-z0-9가-힣_-]{2,240}$" } },
        required: ["key"],
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: false },
      execute: async ({ key }) => {
        if (typeof key !== "string" || !/^[A-Za-z0-9가-힣_-]{2,240}$/.test(key)) {
          return error("invalid_meme_key", "밈 상세 key 형식이 올바르지 않아요.");
        }
        return navigateResult(navigate, `/memes/${encodeURIComponent(key)}`);
      },
    },
  ];
}

export async function registerWebMcpTools(
  modelContext: WebMcpModelContext,
  tools: WebMcpTool[],
  signal: AbortSignal,
) {
  for (const tool of tools) {
    if (signal.aborted) return;
    await modelContext.registerTool(tool, { signal });
  }
}
import type { MemeReference, MemeReferenceResult } from "@/lib/meme-vectors";
