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

function error(code: string, message: string): WebMcpResult<never> {
  return { ok: false, error: { code, message, retryable: false } };
}

function navigateResult(navigate: (path: string) => void, path: string) {
  navigate(path);
  return { ok: true, data: { navigatedTo: path } } satisfies WebMcpResult<{ navigatedTo: string }>;
}

export function createPublicWebMcpTools(navigate: (path: string) => void): WebMcpTool[] {
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
