import { buildQuestions, type QuizPoolMeme, type QuizQuestion } from "@/lib/quiz";
import type { MemeCategory, SafetyLevel } from "@/lib/labels";
import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";

export const GLOBAL_DAILY_LOCALES = ["ko", "en", "ja", "zh", "zh-tw"] as const;
export type GlobalDailyLocale = (typeof GLOBAL_DAILY_LOCALES)[number];

export const GLOBAL_DAILY_CANDIDATE_COUNT = 12;
export const GLOBAL_DAILY_QUESTION_COUNT = 3;
export const GLOBAL_DAILY_TIME_ZONE = "Asia/Seoul";

export type GlobalDailyBaseMeme = ContentDepthInput & {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  category: MemeCategory;
  origin_year: number | null;
  safety_level: SafetyLevel;
  lifecycle_status: "rising" | "active" | "cooling" | "archived";
  moderation_status: "approved" | "limited";
  updated_at: string;
};

export type GlobalDailyTranslation = {
  meme_id: string;
  locale: string;
  status: string;
  localized_slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  source_updated_at: string;
};

export type GlobalDailyLocaleContent = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  source_updated_at: string;
};

export type GlobalDailyCandidate = {
  id: string;
  shortId: string;
  category: MemeCategory;
  originYear: number | null;
  safetyLevel: SafetyLevel;
  lifecycleStatus: GlobalDailyBaseMeme["lifecycle_status"];
  updatedAt: string;
  locales: Record<GlobalDailyLocale, GlobalDailyLocaleContent>;
};

export type GlobalDailyOneCutCandidate = {
  memeId: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  locale: GlobalDailyLocale;
  safetyLevel: Extract<SafetyLevel, "green" | "yellow">;
  lifecycleStatus: Extract<GlobalDailyCandidate["lifecycleStatus"], "rising" | "active">;
  updatedAt: string;
};

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function hasCompleteContent(content: Pick<GlobalDailyLocaleContent, "title" | "summary" | "description" | "origin">) {
  return [content.title, content.summary, content.description, content.origin].every(hasText);
}

export function isGlobalDailyLocale(value: string | null | undefined): value is GlobalDailyLocale {
  return Boolean(value && GLOBAL_DAILY_LOCALES.includes(value as GlobalDailyLocale));
}

export function isValidGlobalDailyQuestion(question: QuizQuestion): boolean {
  return Boolean(
    question.meme.shortId.trim() &&
      question.meme.slug.trim() &&
      question.meme.title.trim() &&
      question.options.length === 4 &&
      question.options.every((option) => option.trim().length > 0) &&
      Number.isInteger(question.answerIndex) &&
      question.answerIndex >= 0 &&
      question.answerIndex < question.options.length,
  );
}

export function projectGlobalDailyOneCutCandidate(
  candidate: GlobalDailyCandidate | null | undefined,
  locale: GlobalDailyLocale,
): GlobalDailyOneCutCandidate | null {
  if (!candidate) return null;
  if (candidate.safetyLevel !== "green" && candidate.safetyLevel !== "yellow") return null;
  if (candidate.lifecycleStatus !== "rising" && candidate.lifecycleStatus !== "active") return null;
  if (!candidate.id.trim() || !candidate.shortId.trim() || !candidate.updatedAt.trim()) return null;

  const content = candidate.locales?.[locale];
  if (!content || !hasCompleteContent(content) || !content.slug.trim()) return null;

  return {
    memeId: candidate.id,
    shortId: candidate.shortId,
    slug: content.slug,
    title: content.title,
    summary: content.summary,
    locale,
    safetyLevel: candidate.safetyLevel,
    lifecycleStatus: candidate.lifecycleStatus,
    updatedAt: candidate.updatedAt,
  };
}

export function globalDailyDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GLOBAL_DAILY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildGlobalDailyCandidate(
  base: GlobalDailyBaseMeme,
  translations: readonly GlobalDailyTranslation[],
): GlobalDailyCandidate | null {
  if (
    !base.id ||
    !base.short_id ||
    !base.slug ||
    base.moderation_status !== "approved" && base.moderation_status !== "limited" ||
    !hasCompleteContent(base) ||
    !isIndexableMeme(base)
  ) {
    return null;
  }

  const locales = {} as Record<GlobalDailyLocale, GlobalDailyLocaleContent>;
  locales.ko = {
    slug: base.slug,
    title: base.title,
    summary: base.summary,
    description: base.description,
    origin: base.origin,
    source_updated_at: base.updated_at,
  };

  for (const locale of GLOBAL_DAILY_LOCALES) {
    if (locale === "ko") continue;
    const translation = translations.find(
      (row) => row.meme_id === base.id && row.locale === locale,
    );
    if (
      !translation ||
      translation.status !== "reviewed" ||
      !sameInstant(translation.source_updated_at, base.updated_at) ||
      !hasCompleteContent(translation)
    ) {
      return null;
    }
    locales[locale] = {
      slug: translation.localized_slug.trim() || base.slug,
      title: translation.title,
      summary: translation.summary,
      description: translation.description,
      origin: translation.origin,
      source_updated_at: translation.source_updated_at,
    };
  }

  return {
    id: base.id,
    shortId: base.short_id,
    category: base.category,
    originYear: base.origin_year,
    safetyLevel: base.safety_level,
    lifecycleStatus: base.lifecycle_status,
    updatedAt: base.updated_at,
    locales,
  };
}

function seedFrom(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function createGlobalDailyRng(seed: string): () => number {
  let state = seedFrom(seed) || 2_654_435_761;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function buildGlobalDailyQuestions(
  candidates: readonly GlobalDailyCandidate[],
  locale: GlobalDailyLocale,
  challengeDate: string,
): QuizQuestion[] {
  const stableCandidates = [...candidates].sort((left, right) => left.id.localeCompare(right.id));
  const pool: QuizPoolMeme[] = stableCandidates.map((candidate) => {
    const content = candidate.locales[locale];
    return {
      id: candidate.id,
      short_id: candidate.shortId,
      slug: content.slug,
      title: content.title,
      summary: content.summary,
      category: candidate.category,
      origin_year: candidate.originYear,
      safety_level: candidate.safetyLevel,
    };
  });

  const questions = buildQuestions(
    pool,
    GLOBAL_DAILY_QUESTION_COUNT,
    createGlobalDailyRng(`${challengeDate}:${locale}:${stableCandidates.map((item) => item.id).join(",")}`),
  );
  return questions.every(isValidGlobalDailyQuestion) ? questions : [];
}
