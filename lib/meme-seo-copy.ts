import { DEFINITE_YEAR_PRECISIONS, SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";
import type { SeoContentLocale } from "@/lib/i18n-routing";

/**
 * Search titles and meta descriptions for meme detail documents.
 *
 * Bing flagged `${title} 뜻 | 밈캐치` as too short and descriptions as too
 * short. Titles aim at about 60 characters including the brand the layout
 * template appends; descriptions at 110-160 characters.
 *
 * Every sentence is built from database fields (summary, origin_year,
 * year_precision, safety_level, usage examples, caution). Nothing here
 * invents a fact: a missing field drops its sentence.
 */
export type MemeSeoLocale = "ko" | SeoContentLocale;

export const TITLE_TARGET_CHARS = 60;
export const DESCRIPTION_MIN_CHARS = 110;
export const DESCRIPTION_MAX_CHARS = 160;

/** What the `%s | brand` template adds after the page title. */
const BRAND_SUFFIX: Record<MemeSeoLocale, string> = {
  ko: " | 밈캐치",
  en: " | MemeCatch",
  ja: " | MemeCatch",
  zh: " | MemeCatch",
  "zh-tw": " | MemeCatch",
};

const TITLE_PATTERNS: Record<MemeSeoLocale, Array<(title: string, house: boolean) => string>> = {
  ko: [
    (t, house) => `${t} 뜻·${house ? "제작 배경" : "유래"}, 지금 써도 될까?`,
    (t, house) => `${t} 뜻·${house ? "제작 배경" : "유래"}`,
    (t) => `${t} 뜻`,
  ],
  en: [
    (t) => `${t} Meaning & Origin: Is It OK to Use?`,
    (t) => `${t} Meaning & Origin`,
    (t) => `${t} Meaning`,
  ],
  ja: [
    (t) => `${t}の意味・由来｜今使っても大丈夫？`,
    (t) => `${t}の意味・由来`,
    (t) => `${t}の意味`,
  ],
  zh: [
    (t) => `${t}是什么意思？含义、由来与能不能用`,
    (t) => `${t}的含义与由来`,
    (t) => `${t}的含义`,
  ],
  "zh-tw": [
    (t) => `${t}是什麼意思？含義、由來與能不能用`,
    (t) => `${t}的含義與由來`,
    (t) => `${t}的含義`,
  ],
};

function chars(text: string): number {
  return [...text].length;
}

/** Longest pattern whose full title (with brand) stays within about 60 characters. */
export function memeSeoTitle(
  locale: MemeSeoLocale,
  title: string,
  options: { houseOriginal?: boolean } = {},
): string {
  const clean = title.trim();
  const house = Boolean(options.houseOriginal);
  const patterns = TITLE_PATTERNS[locale];
  for (const pattern of patterns) {
    const candidate = pattern(clean, house);
    if (chars(candidate) + chars(BRAND_SUFFIX[locale]) <= TITLE_TARGET_CHARS) return candidate;
  }
  return patterns[patterns.length - 1](clean, house);
}

const SAFETY_COPY: Record<SeoContentLocale, Record<SafetyLevel, string>> = {
  en: { green: "generally safe to use", yellow: "context matters", gray: "mostly dated", red: "risky to use" },
  ja: { green: "基本的に使用可", yellow: "文脈に注意", gray: "やや古い表現", red: "使用は危険" },
  zh: { green: "通常可以使用", yellow: "需要注意语境", gray: "大多已经过时", red: "使用风险较高" },
  "zh-tw": { green: "通常可以使用", yellow: "需要注意語境", gray: "大多已經過時", red: "使用風險較高" },
};

export type MemeSeoDescriptionInput = {
  title: string;
  summary: string | null | undefined;
  originYear?: number | null;
  yearPrecision?: string | null;
  safetyLevel?: string | null;
  usageExampleCount?: number;
  hasOrigin?: boolean;
  hasCaution?: boolean;
  houseOriginal?: boolean;
};

type DescriptionParts = { lead: (summary: string) => string; rest: string[]; fillers: string[] };

function isSafety(value: string | null | undefined): value is SafetyLevel {
  return value === "green" || value === "yellow" || value === "gray" || value === "red";
}

function sentence(text: string, terminal: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?。！？…]$/.test(t) ? t : `${t}${terminal}`;
}

function koParts(input: MemeSeoDescriptionInput): DescriptionParts {
  const rest: string[] = [];
  if (typeof input.originYear === "number") {
    const definite = DEFINITE_YEAR_PRECISIONS.some((p) => p === input.yearPrecision);
    rest.push(
      input.houseOriginal
        ? `제작 연도 ${input.originYear}년.`
        : `유행 시작 ${input.originYear}년${definite ? "" : "(추정)"}.`,
    );
  }
  if (isSafety(input.safetyLevel)) rest.push(`지금 써도 될까? 사용 신호는 '${SAFETY_LEVELS[input.safetyLevel].user}'이에요.`);
  const covered = [
    input.hasOrigin ? (input.houseOriginal ? "제작 배경" : "유래") : null,
    input.usageExampleCount ? `예문 ${input.usageExampleCount}개` : null,
    input.hasCaution ? "쓰면 안 되는 상황" : null,
  ].filter(Boolean);
  if (covered.length > 0) rest.push(`${covered.join("·")}까지 정리했어요.`);
  return {
    lead: (summary) => `${input.title} 뜻: ${sentence(summary, ".")}`,
    rest,
    fillers: ["상황별 사용 맥락과 출처도 함께 확인하세요.", "밈캐치 한국 밈 사전 문서예요."],
  };
}

function localizedParts(locale: SeoContentLocale, input: MemeSeoDescriptionInput): DescriptionParts {
  const year = typeof input.originYear === "number" ? input.originYear : null;
  const safety = isSafety(input.safetyLevel) ? SAFETY_COPY[locale][input.safetyLevel] : null;
  const n = input.usageExampleCount ?? 0;
  switch (locale) {
    case "en":
      return {
        lead: (s) => `${input.title} meaning: ${sentence(s, ".")}`,
        rest: [
          ...(year ? [`Originated around ${year}.`] : []),
          ...(safety ? [`Is it OK to use now? Usage signal: ${safety}.`] : []),
          ...(n > 0 ? [`Includes ${n} usage example${n === 1 ? "" : "s"}.`] : []),
          ...(input.hasCaution ? ["Notes when not to use it."] : []),
        ],
        fillers: ["From the MemeCatch Korean meme dictionary.", "Links to the original Korean entry."],
      };
    case "ja":
      return {
        lead: (s) => `${input.title}の意味：${sentence(s, "。")}`,
        rest: [
          ...(year ? [`${year}年ごろに登場。`] : []),
          ...(safety ? [`今使っても大丈夫？使用サインは「${safety}」。`] : []),
          ...(n > 0 ? [`使用例${n}件つき。`] : []),
          ...(input.hasCaution ? ["使ってはいけない場面も解説。"] : []),
        ],
        fillers: ["MemeCatchの韓国ミーム辞典の解説です。", "韓国語の原文ページへのリンクつき。"],
      };
    case "zh":
      return {
        lead: (s) => `${input.title}是什么意思：${sentence(s, "。")}`,
        rest: [
          ...(year ? [`约在${year}年出现。`] : []),
          ...(safety ? [`现在还能用吗？使用信号：${safety}。`] : []),
          ...(n > 0 ? [`附${n}个用法示例。`] : []),
          ...(input.hasCaution ? ["也说明了不该使用的场合。"] : []),
        ],
        fillers: ["来自MemeCatch韩国迷因词典。", "附韩文原文页面链接。"],
      };
    case "zh-tw":
      return {
        lead: (s) => `${input.title}是什麼意思：${sentence(s, "。")}`,
        rest: [
          ...(year ? [`約在${year}年出現。`] : []),
          ...(safety ? [`現在還能用嗎？使用信號：${safety}。`] : []),
          ...(n > 0 ? [`附${n}個用法範例。`] : []),
          ...(input.hasCaution ? ["也說明了不該使用的場合。"] : []),
        ],
        fillers: ["來自MemeCatch韓國迷因詞典。", "附韓文原文頁面連結。"],
      };
  }
}

function joiner(locale: MemeSeoLocale): string {
  return locale === "ja" || locale === "zh" || locale === "zh-tw" ? "" : " ";
}

function truncate(text: string, max: number): string {
  const list = [...text];
  if (list.length <= max) return text;
  const cut = list.slice(0, Math.max(1, max - 1)).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:·、，。]+$/, "")}…`;
}

/**
 * Lead with the summary, then the year, the safety signal and what the page
 * covers. Sentences that do not fit are dropped; the summary is shortened
 * only when the lead alone overflows. Neutral site sentences pad short results.
 */
export function memeSeoDescription(locale: MemeSeoLocale, input: MemeSeoDescriptionInput): string {
  const parts = locale === "ko" ? koParts(input) : localizedParts(locale, input);
  const sep = joiner(locale);
  const summary = (input.summary ?? "").trim();
  let text = summary ? parts.lead(summary) : "";
  if (chars(text) > DESCRIPTION_MAX_CHARS) return truncate(text, DESCRIPTION_MAX_CHARS);
  const add = (piece: string) => {
    const next = text ? `${text}${sep}${piece}` : piece;
    if (chars(next) <= DESCRIPTION_MAX_CHARS) {
      text = next;
      return true;
    }
    return false;
  };
  for (const piece of parts.rest) add(piece);
  for (const filler of parts.fillers) {
    if (chars(text) >= DESCRIPTION_MIN_CHARS) break;
    add(filler);
  }
  return text;
}

/** Count of stored usage examples (jsonb array) for the description. */
export function usageExampleCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
