import "server-only";

import {
  DEFAULT_MPE_MODEL,
  getMpeVisionModel,
  isOpenRouterConfigured,
  OPENROUTER_BUDGET_RESERVATION_FAILED,
  OPENROUTER_DAILY_BUDGET_EXHAUSTED,
  requestOpenRouterStructured,
} from "@/lib/mpe/openrouter.server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * AI 밈 스튜디오 서버 로직.
 * 무료 Ox Alpha와 운영 일일 예산 예약만 사용한다. AI 미설정, 예산 소진,
 * 일시 실패에는 결정적 템플릿으로 폴백해 사용자가 항상 결과를 받게 한다.
 */

export const MEME_TONES = ["wholesome", "sarcastic", "absurd", "hype"] as const;
export const MEME_FORMATS = ["image-macro", "reaction", "caption"] as const;

export type MemeTone = (typeof MEME_TONES)[number];
export type MemeFormat = (typeof MEME_FORMATS)[number];

export type MemeConcept = {
  /** 카드 상단 한 줄 요약 */
  headline: string;
  /** 바로 복사해 쓸 수 있는 캡션 본문 */
  caption: string;
  /** 이 캡션이 통하는 이유 한 줄 */
  why_it_works: string;
  /** 어떤 상황에서 쓰면 좋은지 */
  usage_context: string;
};

const CONCEPTS_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          headline: { type: "string" },
          caption: { type: "string" },
          why_it_works: { type: "string" },
          usage_context: { type: "string" },
        },
        required: ["headline", "caption", "why_it_works", "usage_context"],
        additionalProperties: false,
      },
    },
  },
  required: ["concepts"],
  additionalProperties: false,
} as const;

const AI_INSTRUCTIONS = [
  "You are a Korean meme copywriter for MemeCatch, a global meme dictionary.",
  "Given a topic, tone, and format, write exactly 3 distinct, ready-to-post Korean meme captions.",
  "The requested format must visibly change the output: image-macro uses short top/bottom copy, reaction uses a reaction line, caption uses a post caption.",
  "Rules:",
  "- Keep each caption under 220 characters and safe for public feeds (no slurs, no targeted harassment).",
  "- Reference widely recognizable internet humor patterns; do not invent fake statistics or quotes.",
  "- 'why_it_works' must explain the comedic mechanism in one sentence.",
  "- 'usage_context' must name where/when to post it (e.g., group chat, quote-tweet, story).",
].join(" ");

type MemeStudioBudgetClient = {
  rpc(name: "reserve_meme_studio_daily_ai_request", args: {
    p_provider: "openrouter";
    p_model: string;
  }): PromiseLike<{ error: unknown }>;
};

function reservationErrorValues(error: unknown): string[] {
  if (typeof error !== "object" || error === null) return [];
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details]
    .filter((value): value is string => typeof value === "string");
}

async function reserveMemeStudioAiRequest(client: MemeStudioBudgetClient) {
  const { error } = await client.rpc("reserve_meme_studio_daily_ai_request", {
    p_provider: "openrouter",
    p_model: getMpeVisionModel(),
  });
  if (!error) return;

  const values = reservationErrorValues(error);
  if (values.includes("meme_studio_daily_ai_budget_exhausted")) {
    throw new Error(OPENROUTER_DAILY_BUDGET_EXHAUSTED);
  }
  if (values.includes("PGRST202")
      || values.some((value) => /reserve_meme_studio_daily_ai_request/i.test(value))) {
    console.error("meme_studio_ai_quota_rpc_missing");
    throw new Error(OPENROUTER_BUDGET_RESERVATION_FAILED);
  }

  console.error("meme_studio_ai_quota_reservation_failed");
  throw new Error(OPENROUTER_BUDGET_RESERVATION_FAILED);
}

function isExpectedStudioAiFallback(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message === OPENROUTER_DAILY_BUDGET_EXHAUSTED
    || message === OPENROUTER_BUDGET_RESERVATION_FAILED
    || /^openrouter_structured_failed:(?:network_error|408|409|425|429|5\d\d)(?:\s|$)/.test(message);
}

function studioAiFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return message.match(/^openrouter_structured_(?:failed:(?:network_error|\d{3})|invalid|empty)/)?.[0]
    ?? "unexpected";
}

function isMemeConcept(value: unknown): value is MemeConcept {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.headline === "string" &&
    record.headline.trim().length > 0 &&
    typeof record.caption === "string" &&
    record.caption.trim().length > 0 &&
    typeof record.why_it_works === "string" &&
    typeof record.usage_context === "string"
  );
}

function normalizeMemeConcept(concept: MemeConcept): MemeConcept {
  const normalize = (value: string) => value.replace(/[\u2013\u2014]/g, "-");
  return {
    headline: normalize(concept.headline),
    caption: normalize(concept.caption),
    why_it_works: normalize(concept.why_it_works),
    usage_context: normalize(concept.usage_context),
  };
}

type TemplateFn = (topic: string, format: MemeFormat) => MemeConcept;

const TONE_TEMPLATES: Record<MemeTone, TemplateFn[]> = {
  wholesome: [
    (topic) => ({
      headline: "다정한 생존 자랑",
      caption: `${topic}? 이 시국에? 시도했다는 것만으로도 정말 잘했어.`,
      why_it_works: "팍팍한 현실을 끼워 넣어 진심 어린 응원을 부담스럽지 않게 만든다.",
      usage_context: "친구가 올린 소소한 성취 글에 답글로 쓰기 좋다.",
    }),
    (topic) => ({
      headline: "조용히 응원하는 조연",
      caption: `아무도 안 물어봤지만, 나는 조용히 ${topic} 배우는 모두를 응원 중.`,
      why_it_works: "아무도 안 물어봤다는 형식이 과한 열정을 자각하는 유머로 바꾼다.",
      usage_context: "스토리나 커뮤니티에서 응원 메시지를 보낼 때 좋다.",
    }),
    (topic) => ({
      headline: "따뜻한 반전",
      caption: `${topic} 놀리러 왔는데 솔직히 말하면, 다들 정말 잘하고 있어.`,
      why_it_works: "빈정거릴 듯 시작했다가 진심으로 응원하는 반전이 따뜻한 웃음을 만든다.",
      usage_context: "긴 대화의 마무리나 일요일 재정비 글에 어울린다.",
    }),
  ],
  sarcastic: [
    (topic) => ({
      headline: "사내 공지 말투",
      caption: `기쁜 소식입니다. 이제 ${topic}이 제 성격 전부가 됐습니다. 인사팀에도 알렸습니다.`,
      why_it_works: "격식 있는 사내 공지 말투로 과몰입 자체를 웃음거리로 만든다.",
      usage_context: "새로운 관심사에 빠졌다고 인용 게시할 때 좋다.",
    }),
    (topic) => ({
      headline: "마지못한 전문가",
      caption: `제가 규칙을 만든 건 아니고요, 그냥 ${topic}을 너무 많이 알아 버린 대가를 치르는 중입니다.`,
      why_it_works: "책임은 피하면서도 별난 지식을 슬쩍 자랑하는 모순이 웃음을 만든다.",
      usage_context: "단체 채팅에서 같은 설정을 세 번째 설명한 뒤 쓰기 좋다.",
    }),
    (topic) => ({
      headline: "무표정 상태 보고",
      caption: `${topic}이 잠깐의 유행인 척한 지 47일째.`,
      why_it_works: "가짜 날짜 세기가 부정을 반복되는 농담으로 바꾼다.",
      usage_context: "매일 올리는 기록이나 프로필 근처의 짧은 농담에 어울린다.",
    }),
  ],
  absurd: [
    (topic) => ({
      headline: "정신없는 예언",
      caption: `고대인들은 ${topic}을 경고했다. 우리는 끝내 듣지 않았다.`,
      why_it_works: "평범한 대상을 신화처럼 무겁게 다루는 대비가 황당한 웃음을 만든다.",
      usage_context: "피드를 내리다 갑자기 던지는 혼돈의 게시물에 어울린다.",
    }),
    (topic) => ({
      headline: "저주받은 후기",
      caption: `${topic}: 별점 5점. 또 당해도 좋습니다.`,
      why_it_works: "후기 사이트 문법을 대혼란에 적용해 황당함을 바로 이해하게 만든다.",
      usage_context: "관련 영상의 댓글란에 쓰기 좋다.",
    }),
    (topic) => ({
      headline: "음모론 속삭임",
      caption: `자기야 일어나, 새 ${topic} 설정이 공개됐는데 어쩐지 더 심각해졌어.`,
      why_it_works: "사소한 업데이트를 세상을 뒤흔드는 속보처럼 다뤄 웃음을 만든다.",
      usage_context: "팬덤의 황당한 새 소식을 인용 게시할 때 좋다.",
    }),
  ],
  hype: [
    (topic) => ({
      headline: "경기장 아나운서",
      caption: `여러분, 드디어 ${topic.toUpperCase()}이 등장했습니다!`,
      why_it_works: "힘찬 중계 말투가 작은 소식도 주인공의 등장처럼 느끼게 한다.",
      usage_context: "출시일, 승리 인증, 스포츠 반응 글에 어울린다.",
    }),
    (topic) => ({
      headline: "올해의 순간",
      caption: `지금 이 순간, ${topic}이 공식적으로 올해의 장면이 됐고 우리는 그 안에 살고 있다.`,
      why_it_works: "현장 시점과 최상급 표현을 결합해 유행의 중심에 있다는 느낌을 준다.",
      usage_context: "인기 음원과 함께 올리는 스토리에 어울린다.",
    }),
    (topic) => ({
      headline: "유행 예언 인증",
      caption: `이건 캡처해 둬. ${topic}이 뜨기 전에 먼저 알아봤으니까.`,
      why_it_works: "미리 알았다는 선언이 나중에 돌아볼 수 있는 유쾌한 증거가 된다.",
      usage_context: "마침내 유행이 커졌을 때 인용 게시하기 좋다.",
    }),
  ],
};

/** 토픽 길이로 시작 인덱스를 돌려 같은 입력이면 같은 결과, 다른 입력이면 다른 조합. */
function buildTemplateConcepts(topic: string, tone: MemeTone, format: MemeFormat): MemeConcept[] {
  const templates = TONE_TEMPLATES[tone];
  const start = topic.length % templates.length;
  const ordered = [...templates.slice(start), ...templates.slice(0, start)];
  return ordered.map((build) => {
    const concept = build(topic, format);
    if (format === "image-macro") {
      return {
        ...concept,
        headline: `이미지 매크로 · ${concept.headline}`,
        caption: `${topic.toUpperCase()}\n${concept.caption}`,
        usage_context: `이미지 상·하단 문구 · ${concept.usage_context}`,
      };
    }
    if (format === "reaction") {
      return {
        ...concept,
        headline: `리액션 · ${concept.headline}`,
        caption: `내 반응: ${concept.caption}`,
        usage_context: `리액션 이미지/영상 · ${concept.usage_context}`,
      };
    }
    return {
      ...concept,
      headline: `게시물 캡션 · ${concept.headline}`,
      usage_context: `게시물 본문 · ${concept.usage_context}`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 공개 진입점                                                         */
/* ------------------------------------------------------------------ */

export function isMemeStudioAiEnabled(): boolean {
  if (!isOpenRouterConfigured()) return false;
  try {
    return getMpeVisionModel() === DEFAULT_MPE_MODEL;
  } catch {
    return false;
  }
}

/**
 * 밈 컨셉 3개 생성. AI를 우선하고 실패하면 템플릿으로 폴백한다.
 * 반환 mode로 호출부(API 라우트 → 클라이언트)가 폴백 안내를 표시할 수 있다.
 */
export async function generateMemeConcepts(input: {
  topic: string;
  tone: MemeTone;
  format: MemeFormat;
}): Promise<{ mode: "ai" | "template"; concepts: MemeConcept[] }> {
  if (isMemeStudioAiEnabled()) {
    try {
      const budgetClient = createAdminClient() as unknown as MemeStudioBudgetClient;
      const result = await requestOpenRouterStructured<{ concepts?: unknown }>({
        name: "meme_concepts",
        schema: CONCEPTS_SCHEMA,
        instructions: AI_INSTRUCTIONS,
        input: JSON.stringify(input),
        maxOutputTokens: 2048,
        reserveRequest: () => reserveMemeStudioAiRequest(budgetClient),
      });
      const rawConcepts = (result.concepts ?? []) as unknown[];
      const concepts = rawConcepts.filter(isMemeConcept).slice(0, 3).map(normalizeMemeConcept);
      if (concepts.length === 3) return { mode: "ai", concepts };
    } catch (error) {
      if (!isExpectedStudioAiFallback(error)) {
        console.error("meme_studio_ai_generation_failed", studioAiFailureCode(error));
      }
    }
  }
  return {
    mode: "template",
    concepts: buildTemplateConcepts(input.topic, input.tone, input.format).map(normalizeMemeConcept),
  };
}
