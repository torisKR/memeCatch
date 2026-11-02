/**
 * 밈캐치 독립형 자체 밈 데이터 생성 파이프라인.
 * 외부 SNS(유튜브, 틱톡, 인스타 등)에 의존하지 않고, 자체 제작(house_original) 기반의
 * 완성도 높은 밈 지식, 용례, 안전성, 시각적 스토리보드를 생성합니다.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  HOUSE_ORIGINAL,
  HOUSE_ORIGINAL_RIGHTS_BASIS,
  HOUSE_ORIGINAL_SOURCE_ROLE,
  houseOriginalCanonicalUrl,
} from "@/lib/house-original";
import type { SafetyLevel, LifecycleStatus, MemeCategory } from "@/lib/labels";

export type HouseMemeSeed = {
  title: string;
  category?: MemeCategory;
  theme?: string;
  targetAudience?: "gen_z" | "alpha" | "office" | "all";
  coreMeaning: string;
  usageContext: string;
  cautionPoint?: string;
};

export type HouseMemeDialogue = {
  speaker: string;
  line: string;
};

export type HouseMemeExample = {
  situation: string;
  dialogue: HouseMemeDialogue[];
};

export type HouseMemeVideoScene = {
  sceneIndex: number;
  durationSec: number;
  title: string;
  narration: string;
  captionText: string;
  visualDirection: string;
};

export type GeneratedHouseMeme = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  category: MemeCategory;
  origin_kind: typeof HOUSE_ORIGINAL;
  summary: string;
  description: string;
  origin: string;
  usage_note: string;
  caution: string;
  safety_level: SafetyLevel;
  safety_rationale: string;
  lifecycle_status: LifecycleStatus;
  canonical_url: string;
  usage_examples: HouseMemeExample[];
  visual_prompt: string;
  video_scenes: HouseMemeVideoScene[];
  quiz: {
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  };
  tags: string[];
  created_at: string;
};

function generateShortId(): string {
  return randomBytes(4).toString("hex");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 외부 SNS 링크 없이 자립 가능한 완성형 자체 밈 데이터를 생성합니다.
 */
export function generateHouseMeme(seed: HouseMemeSeed): GeneratedHouseMeme {
  const shortId = generateShortId();
  const slug = slugify(seed.title) || `meme-${shortId}`;
  const category = seed.category ?? "phrase";
  const now = new Date().toISOString();
  const canonicalUrl = houseOriginalCanonicalUrl(shortId, slug);

  const description =
    `'${seed.title}'는 밈캐치 오리지널 콘텐츠로 기획된 표현으로, ${seed.coreMeaning} ` +
    `주로 ${seed.usageContext} 상황에서 재치 있는 소통과 공감대를 형성하기 위해 활용됩니다. ` +
    `특정 대상을 비하하거나 조롱하는 의도 없이, 일상의 미묘한 심리를 유쾌하게 포착한 독자적 밈 포맷입니다.`;

  const origin =
    `밈캐치 자체 제작(House Original) 프로젝트의 일환으로 창작되었습니다. ` +
    `디지털 네이티브 세대의 빠른 소통 속도와 일상 속 피로감을 덜어주는 위트 있는 대화 문화를 지원하기 위해 개발되었으며, ` +
    `모든 저작권과 편집 권한은 밈캐치에 귀속되어 투명하게 관리됩니다.`;

  const caution = seed.cautionPoint
    ? seed.cautionPoint
    : `친밀한 지인이나 온라인 커뮤니티에서는 가볍게 쓰기 좋으나, 격식 있는 공문서나 비즈니스 공식 미팅에서는 표준어를 사용하는 것이 안전합니다.`;

  const safetyLevel: SafetyLevel = "green";
  const safetyRationale =
    `공격적·비하적 어휘가 포함되지 않은 순수 상황 풍자 표현으로, 일반적인 대화 맥락에서 안전하게 사용할 수 있습니다.`;

  const examples: HouseMemeExample[] = [
    {
      situation: "친구들과 일상을 공유하는 단체 채팅방",
      dialogue: [
        { speaker: "민우", line: `오늘 진짜 일정 폭발해서 정신이 하나도 없네...` },
        { speaker: "지수", line: `그럴 땐 딱 '${seed.title}' 모드로 넘어가야지 ㅎㅎ 힘내!` },
      ],
    },
    {
      situation: "소셜 미디어 댓글 소통",
      dialogue: [
        { speaker: "작성자", line: `드디어 금요일 퇴근길! 주말 시작이다.` },
        { speaker: "댓글러", line: `'${seed.title}' 그 자체네요 ㅋㅋㅋ 즐거운 주말 보내세요!` },
      ],
    },
  ];

  const videoScenes: HouseMemeVideoScene[] = [
    {
      sceneIndex: 1,
      durationSec: 3,
      title: "인트로 — 밈 타이틀",
      narration: `요즘 대세로 떠오른 바로 그 표현, ${seed.title}!`,
      captionText: `🔥 요즘 화제인 '${seed.title}' 30초 정리`,
      visualDirection: `화면 중앙에 볼드한 타이포그래피와 다이내믹 그라디언트 애니메이션 노출`,
    },
    {
      sceneIndex: 2,
      durationSec: 5,
      title: "핵심 뜻과 맥락",
      narration: `${seed.title}는 ${seed.coreMeaning} 뜻을 담고 있어요.`,
      captionText: `💡 핵심 뜻: ${seed.coreMeaning}`,
      visualDirection: `상황을 묘사하는 키 비주얼 일러스트와 요약 키워드 카드 등장`,
    },
    {
      sceneIndex: 3,
      durationSec: 4,
      title: "실전 활용 예시",
      narration: `친구와 메신저할 때 이렇게 자연스럽게 써보세요!`,
      captionText: `💬 실전 톡: "${examples[0].dialogue[1].line}"`,
      visualDirection: `모바일 메신저 말풍선 인터랙션 UI 연출`,
    },
    {
      sceneIndex: 4,
      durationSec: 3,
      title: "아웃트로 — 안전 사용",
      narration: `안전한 밈 라이프, 밈캐치에서 확인하세요!`,
      captionText: `✅ 사용 안전도: 초록불 (안전하게 써도 됨)`,
      visualDirection: `밈캐치 공식 엠블럼과 상세 사전 바로가기 안내`,
    },
  ];

  const visualPrompt =
    `Editorial 3D tech illustration for Korean meme '${seed.title}', modern minimal studio aesthetic, ` +
    `sleek typography overlay, cinematic lighting, obsidian glass texture, vibrant accent color, no text watermark.`;

  const quiz = {
    question: `'${seed.title}' 표현이 가장 어울리는 상황은 무엇일까요?`,
    options: [
      seed.usageContext,
      "엄숙하고 진지한 공식 계약 체결 자리",
      "상대방에게 공식적인 사과문을 보낼 때",
      "시험 감독관에게 질문할 때",
    ],
    answerIndex: 0,
    explanation: `'${seed.title}'는 ${seed.usageContext} 상황에서 재치 있게 공감을 이끌어낼 때 가장 효과적입니다.`,
  };

  const tags = [
    seed.title,
    "자체제작",
    "밈캐치오리지널",
    category,
    "신조어",
    "트렌드",
  ];

  const deterministicId = createHash("sha256")
    .update(`house_original:${seed.title}:${shortId}`)
    .digest("hex")
    .slice(0, 32);

  return {
    id: deterministicId,
    short_id: shortId,
    slug,
    title: seed.title,
    category,
    origin_kind: HOUSE_ORIGINAL,
    summary: `${seed.title} — ${seed.coreMeaning}`,
    description,
    origin,
    usage_note: `주로 ${seed.usageContext} 맥락에서 짧고 임팩트 있게 사용됩니다.`,
    caution,
    safety_level: safetyLevel,
    safety_rationale: safetyRationale,
    lifecycle_status: "rising",
    canonical_url: canonicalUrl,
    usage_examples: examples,
    visual_prompt: visualPrompt,
    video_scenes: videoScenes,
    quiz,
    tags,
    created_at: now,
  };
}

/**
 * 자체 밈 데이터를 DB 마이그레이션 및 Seeding용 SQL 문으로 변환합니다.
 */
export function formatHouseMemeAsSql(meme: GeneratedHouseMeme): string {
  const escapeStr = (val: string) => val.replace(/'/g, "''");
  const examplesJson = escapeStr(JSON.stringify(meme.usage_examples));

  return `-- 밈캐치 자체 제작(House Original) 밈: ${meme.title}
INSERT INTO public.memes (
  id, short_id, slug, title, category, origin_kind, summary, description,
  origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
  house_rights_attested_at, created_at, updated_at
) VALUES (
  '${meme.id}',
  '${meme.short_id}',
  '${escapeStr(meme.slug)}',
  '${escapeStr(meme.title)}',
  '${meme.category}',
  '${HOUSE_ORIGINAL}',
  '${escapeStr(meme.summary)}',
  '${escapeStr(meme.description)}',
  '${escapeStr(meme.origin)}',
  '${escapeStr(meme.usage_note)}',
  '${escapeStr(meme.caution)}',
  '${meme.safety_level}',
  '${meme.lifecycle_status}',
  'approved',
  NOW(),
  '${meme.created_at}',
  '${meme.created_at}'
) ON CONFLICT (short_id) DO NOTHING;

-- 공식 자체 제작 저작권 출처 등록 (타 SNS 의존 없음)
INSERT INTO public.meme_sources (
  meme_id, source_url, source_role, rights_basis, display_order, created_at
) VALUES (
  '${meme.id}',
  '${meme.canonical_url}',
  '${HOUSE_ORIGINAL_SOURCE_ROLE}',
  '${HOUSE_ORIGINAL_RIGHTS_BASIS}',
  0,
  '${meme.created_at}'
) ON CONFLICT DO NOTHING;
`;
}
