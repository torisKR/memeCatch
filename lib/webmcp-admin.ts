import type {
  CatalogDuplicateResult,
  CatalogRegistrationResult,
} from "@/lib/actions/admin-catalog";
import type { CatalogRegistrationInput } from "@/lib/catalog-registration";
import type { WebMcpResult } from "@/lib/webmcp";

type AdminWebMcpDependencies = {
  navigate: (path: string) => void;
  checkDuplicates: (input: { title: string; sourceUrls: string[] }) => Promise<CatalogDuplicateResult>;
  registerCatalog: (input: CatalogRegistrationInput) => Promise<CatalogRegistrationResult>;
  transitionStatus: (input: {
    memeId: string;
    to: "fact_checking" | "rights_checking";
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$";
const UUID_RE = new RegExp(UUID_PATTERN);

function invalid(code: string, message: string): WebMcpResult<never> {
  return { ok: false, error: { code, message, retryable: false } };
}

function navigateResult(navigate: (path: string) => void, path: string) {
  navigate(path);
  return { ok: true, data: { navigatedTo: path } } satisfies WebMcpResult<{ navigatedTo: string }>;
}

const sourceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    url: { type: "string", format: "uri", maxLength: 2048 },
    platform: {
      type: "string",
      enum: ["youtube", "youtube_shorts", "tiktok", "instagram", "broadcast_archive", "public_archive", "web"],
    },
    title: { type: "string", maxLength: 300 },
    creatorName: { type: "string", maxLength: 200 },
    sourceRole: {
      type: "string",
      enum: ["original", "official_reupload", "earliest_known", "secondary_reference", "usage_example"],
    },
    rightsBasis: {
      type: "string",
      enum: ["official_embed", "creator_permission", "creative_commons", "public_data", "link_only", "unknown", "blocked"],
    },
    reviewNote: { type: "string", maxLength: 500 },
  },
  required: ["url", "platform", "sourceRole", "rightsBasis"],
} as const;

export function createAdminWebMcpTools(deps: AdminWebMcpDependencies): WebMcpTool[] {
  return [
    {
      name: "memecatch.admin.check_catalog_duplicates",
      title: "외부 밈 중복 검사",
      description: "운영자 권한으로 제목과 정규화된 원문 URL이 기존 비공개·공개 밈과 겹치는지 검사합니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 1, maxLength: 160 },
          sourceUrls: { type: "array", minItems: 1, maxItems: 8, uniqueItems: true, items: { type: "string", format: "uri" } },
        },
        required: ["title", "sourceUrls"],
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: true },
      execute: async ({ title, sourceUrls }, { signal }) => {
        if (signal.aborted) return invalid("cancelled", "요청이 취소됐어요.");
        if (typeof title !== "string" || !Array.isArray(sourceUrls) || !sourceUrls.every((url) => typeof url === "string")) {
          return invalid("invalid_input", "제목과 출처 URL 목록을 확인해 주세요.");
        }
        return deps.checkDuplicates({ title, sourceUrls });
      },
    },
    {
      name: "memecatch.admin.register_catalog_meme",
      title: "외부 밈 대기 등록",
      description:
        "외부 밈을 catalog/pending으로만 원자적 등록합니다. registrationKey는 재시도에 동일하게 사용해야 하며, 이 도구는 공개 게시하지 않습니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          registrationKey: { type: "string", pattern: UUID_PATTERN, description: "클라이언트가 생성하고 재시도 때 재사용할 UUID" },
          title: { type: "string", minLength: 1, maxLength: 160 },
          aliases: { type: "array", maxItems: 20, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 120 } },
          summary: { type: "string", minLength: 1, maxLength: 300 },
          description: { type: "string", minLength: 1, maxLength: 5000 },
          origin: { type: "string", minLength: 1, maxLength: 3000 },
          sourceWorkYear: { type: ["integer", "null"], minimum: 1980, maximum: 2100 },
          memeFirstSeenYear: { type: ["integer", "null"], minimum: 1980, maximum: 2100 },
          koreaViralYear: { type: ["integer", "null"], minimum: 1980, maximum: 2100 },
          yearPrecision: { type: "string", enum: ["exact", "year", "approximate", "decade", "unknown"] },
          tags: { type: "array", minItems: 1, maxItems: 15, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 60 } },
          safetyLevel: { type: "string", enum: ["green", "yellow", "gray", "red"] },
          category: { type: "string", enum: ["phrase", "dance", "song", "image", "comment", "challenge"] },
          difficulty: { type: "string", enum: ["beginner", "normal", "deep"] },
          sentiment: { type: "string", enum: ["funny", "ironic", "controversial", "negative", "wholesome"] },
          usageContext: {
            type: "object",
            additionalProperties: false,
            properties: {
              work: { type: "string", enum: ["green", "yellow", "gray", "red"] },
              friends: { type: "string", enum: ["green", "yellow", "gray", "red"] },
              family: { type: "string", enum: ["green", "yellow", "gray", "red"] },
              sns: { type: "string", enum: ["green", "yellow", "gray", "red"] },
            },
            required: ["work", "friends", "family", "sns"],
          },
          sources: { type: "array", minItems: 2, maxItems: 8, items: sourceSchema },
        },
        required: [
          "registrationKey", "title", "aliases", "summary", "description", "origin",
          "yearPrecision", "tags", "safetyLevel", "category", "difficulty", "sentiment",
          "usageContext", "sources",
        ],
      },
      annotations: { readOnlyHint: false, consequentialHint: false, untrustedContentHint: true },
      execute: async (input, { signal }) => {
        if (signal.aborted) return invalid("cancelled", "등록 요청이 취소됐어요.");
        return deps.registerCatalog(input as CatalogRegistrationInput);
      },
    },
    {
      name: "memecatch.admin.open_meme_editor",
      title: "밈 편집 화면 열기",
      description: "운영자용 밈 편집 화면을 엽니다. 이 도구 자체는 저장하지 않습니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { memeId: { type: "string", pattern: UUID_PATTERN } },
        required: ["memeId"],
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: false },
      execute: async ({ memeId }) => {
        if (typeof memeId !== "string" || !UUID_RE.test(memeId)) return invalid("invalid_meme_id", "밈 ID 형식이 올바르지 않아요.");
        return navigateResult(deps.navigate, `/admin/memes/${memeId}`);
      },
    },
    {
      name: "memecatch.admin.open_review_queue",
      title: "검수 대기열 열기",
      description: "밈 상태 또는 출처 권리 검수를 위한 관리자 대기열을 엽니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { queue: { type: "string", enum: ["memes", "sources"] } },
        required: ["queue"],
      },
      annotations: { readOnlyHint: true, consequentialHint: false, untrustedContentHint: false },
      execute: async ({ queue }) => {
        if (queue !== "memes" && queue !== "sources") return invalid("invalid_queue", "지원하는 검수 대기열을 선택해 주세요.");
        return navigateResult(deps.navigate, queue === "memes" ? "/admin/memes" : "/admin/sources");
      },
    },
    {
      name: "memecatch.admin.advance_catalog_review",
      title: "외부 밈 검수 단계 진행",
      description:
        "운영자 권한으로 대기 항목을 사실확인 또는 권리확인 단계로만 전환합니다. 승인·제한 공개·반려·삭제는 지원하지 않으며 관리자 UI의 명시적 확인 경계를 사용해야 합니다.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          memeId: { type: "string", pattern: UUID_PATTERN },
          to: { type: "string", enum: ["fact_checking", "rights_checking"] },
        },
        required: ["memeId", "to"],
      },
      annotations: { readOnlyHint: false, consequentialHint: false, untrustedContentHint: false },
      execute: async ({ memeId, to }, { signal }) => {
        if (signal.aborted) return invalid("cancelled", "검수 전환 요청이 취소됐어요.");
        if (typeof memeId !== "string" || !UUID_RE.test(memeId)) return invalid("invalid_meme_id", "밈 ID 형식이 올바르지 않아요.");
        if (to !== "fact_checking" && to !== "rights_checking") {
          return invalid("unsupported_transition", "WebMCP에서는 사실확인·권리확인 단계만 진행할 수 있어요.");
        }
        const result = await deps.transitionStatus({ memeId, to });
        return result.ok
          ? ({ ok: true, data: { memeId, moderationStatus: to } } satisfies WebMcpResult<{ memeId: string; moderationStatus: string }>)
          : ({ ok: false, error: { code: "transition_failed", message: result.error, retryable: false } } satisfies WebMcpResult<never>);
      },
    },
  ];
}
