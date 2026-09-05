import "server-only";

import {
  BEDROCK_MEME_STUDIO_MODEL_ID,
  BedrockMemeStudioError,
  generateBedrockMemeConcepts,
} from "@/lib/meme-studio-bedrock.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemeCountry, isMemeCountryCode, type MemeCountryCode } from "@/lib/meme-country";

/**
 * AI 밈 스튜디오 서버 로직.
 * 공개 스튜디오는 항상 결정적 템플릿만 사용한다. 비용이 발생하는 생성기는
 * 인증된 관리자 API에서만 별도 호출한다.
 */

export const MEME_TONES = ["wholesome", "sarcastic", "absurd", "hype"] as const;
export const MEME_FORMATS = ["image-macro", "reaction", "caption"] as const;

export type MemeTone = (typeof MEME_TONES)[number];
export type MemeFormat = (typeof MEME_FORMATS)[number];

export type MemeConcept = {
  country_code: MemeCountryCode;
  /** 카드 상단 한 줄 요약 */
  headline: string;
  /** 바로 복사해 쓸 수 있는 캡션 본문 */
  caption: string;
  local_caption: string;
  cultural_anchor: string;
  visual_brief: string;
  /** 이 캡션이 통하는 이유 한 줄 */
  why_it_works: string;
  /** 어떤 상황에서 쓰면 좋은지 */
  usage_context: string;
};

export type MemeStudioResult =
  | { mode: "ai"; provider: "bedrock"; concepts: MemeConcept[] }
  | { mode: "template"; concepts: MemeConcept[] };

type MemeStudioBudgetClient = {
  rpc(name: "reserve_bedrock_meme_studio_budget", args: {
    p_model_profile: string;
    p_estimated_cost_nano_usd: number;
  }): PromiseLike<{ error: unknown }>;
};

function isMemeConcept(value: unknown): value is MemeConcept {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.headline === "string" &&
    typeof record.country_code === "string" &&
    isMemeCountryCode(record.country_code) &&
    record.headline.trim().length > 0 &&
    typeof record.caption === "string" &&
    record.caption.trim().length > 0 &&
    typeof record.local_caption === "string" &&
    typeof record.cultural_anchor === "string" &&
    typeof record.visual_brief === "string" &&
    typeof record.why_it_works === "string" &&
    typeof record.usage_context === "string"
  );
}

function normalizeMemeConcept(concept: MemeConcept): MemeConcept {
  const normalize = (value: string) => value.replace(/[\u2013\u2014]/g, "-");
  return {
    country_code: concept.country_code,
    headline: normalize(concept.headline),
    caption: normalize(concept.caption),
    local_caption: normalize(concept.local_caption),
    cultural_anchor: normalize(concept.cultural_anchor),
    visual_brief: normalize(concept.visual_brief),
    why_it_works: normalize(concept.why_it_works),
    usage_context: normalize(concept.usage_context),
  };
}

type TemplateConcept = Pick<MemeConcept, "headline" | "caption" | "why_it_works" | "usage_context">;
type TemplateFn = (topic: string, format: MemeFormat) => TemplateConcept;

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
function buildTemplateConcepts(topic: string, tone: MemeTone, format: MemeFormat): TemplateConcept[] {
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

/**
 * 공개 스튜디오용 밈 컨셉 3개 생성. 외부 AI를 호출하지 않는다.
 */
export async function generateMemeConcepts(input: {
  topic: string;
  tone: MemeTone;
  format: MemeFormat;
  country?: MemeCountryCode;
}): Promise<MemeStudioResult> {
  const country = getMemeCountry(input.country ?? "KR") ?? getMemeCountry("KR")!;
  return {
    mode: "template",
    concepts: buildTemplateConcepts(input.topic, input.tone, input.format).map((concept) => normalizeMemeConcept({
      ...concept,
      country_code: country.code,
      local_caption: concept.caption,
      cultural_anchor: `${country.label} 현지 맥락은 게시 전에 확인해 주세요.`,
      visual_brief: "텍스트 중심의 단순한 자체 제작 카드",
    })),
  };
}

export async function generateAdminMemeConcepts(input: {
  topic: string;
  tone: MemeTone;
  format: MemeFormat;
  country: MemeCountryCode;
}): Promise<MemeStudioResult> {
  const budgetClient = createAdminClient() as unknown as MemeStudioBudgetClient;
  const result = await generateBedrockMemeConcepts(input, {
    reserveCost: async (reservedNanoUsd) => {
      const { error } = await budgetClient.rpc("reserve_bedrock_meme_studio_budget", {
        p_model_profile: BEDROCK_MEME_STUDIO_MODEL_ID,
        p_estimated_cost_nano_usd: reservedNanoUsd,
      });
      if (error) throw new Error("bedrock_budget_rejected");
    },
  });
  if (
    result.concepts.length !== 3 ||
    !result.concepts.every((concept) => isMemeConcept(concept) && concept.country_code === input.country)
  ) {
    throw new BedrockMemeStudioError("bedrock_meme_studio_invalid_response");
  }
  return {
    mode: "ai",
    provider: "bedrock",
    concepts: result.concepts.map(normalizeMemeConcept),
  };
}
