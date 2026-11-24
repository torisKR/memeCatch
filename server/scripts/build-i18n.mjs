#!/usr/bin/env node
// Exports the TypeScript dictionaries, and copy that lives as data in
// lib/, to JSON that the Rust pages read, so no string is written twice. Run from the repository root:
//
//   node --import ./scripts/register-ts-paths.mjs server/scripts/build-i18n.mjs          write
//   node --import ./scripts/register-ts-paths.mjs server/scripts/build-i18n.mjs --check  exit 1 if stale
//
// The output is committed (server/i18n/*.json) and embedded in the server, so
// its build needs no Node. `--check` runs in CI: a dictionary changed in
// TypeScript without this script rerun fails there.
//
// To give a later page its strings, add an entry to FILES: the JSON file
// name and a function that returns plain data from the imported modules.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LANGUAGE_FLAGS,
  LANGUAGE_NAMES,
  LANGUAGE_SHORT_NAMES,
  SUPPORTED_LOCALES,
  getDocumentDirection,
  getDocumentLanguage,
  getMessages,
  withLocaleFallback,
} from "@/lib/i18n";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { AUDIENCE_LABELS_I18N, PAGE_COPY } from "@/lib/i18n-pages";
import { MEME_NEWS_BRIEFS } from "@/lib/meme-news";
import { gradeForScore } from "@/lib/quiz";
import { QUIZ_MODE_LABEL } from "@/lib/quiz-share";
import { MEME_CHAT_COPY } from "@/lib/meme-chat-copy";
import { GUIDES } from "@/lib/guides";
import { EDITORIAL_ORIGINALS } from "@/lib/editorial-originals";
import { COLLECTIONS } from "@/lib/collections";
import { getSafetySignalCopy } from "@/lib/safety-copy";
import { HOME_COPY, HOME_LOCALES } from "@/lib/home-copy";
import { HOME_WEB3_COPY } from "@/lib/home-web3-copy";
import { HOME_IMMERSIVE_COPY } from "@/lib/home-immersive-copy";
import { HOME_SCENE_COPY } from "@/lib/home-scene-copy";
import { HOME_DISCOVERY_COPY } from "@/lib/home-discovery-copy";
import { getSeoCopy } from "@/lib/i18n-routing";
import { RANKINGS_LOCALE_PREFIXES } from "@/lib/rankings-locale-rewrite";
import { LOCALIZED_EXPLORE_COPY } from "@/lib/i18n-global-explore";
import { rankingsExploreHref, rankingsFallbackCopy } from "@/lib/rankings-fallback-copy";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";
import { CURATED_CORE_MEMES, curatedPassesIndexGate } from "@/lib/curated-memes";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../i18n");
const perLocale = (value) => Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, value(locale)]));

/**
 * The literal (object or array) that follows `marker` in a source file that
 * Node cannot import (a .tsx, or a module that pulls in React or the
 * database). Copy that lives there is read from the source so that it is
 * still written once. Fails loudly when the declaration moves.
 */
function sourceLiteral(file, marker) {
  const source = readFileSync(resolve(here, "../..", file), "utf8");
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`${file} no longer declares ${marker}; update build-i18n.mjs`);
  let depth = 0;
  let quote = null;
  let begin = -1;
  for (let index = start + marker.length; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{" || char === "[") {
      if (depth === 0) begin = index;
      depth += 1;
    } else if ((char === "}" || char === "]") && --depth === 0) {
      return new Function(`return (${source.slice(begin, index + 1)});`)();
    }
  }
  throw new Error(`${file}: ${marker} has no end`);
}

/** `const <name> = withLocaleFallback({...})` in a component, fallbacks applied. */
const componentCopy = (file, name) => withLocaleFallback(sourceLiteral(file, `const ${name} = withLocaleFallback(`));

const parameterNames = (fn) =>
  String(fn).match(/^\(([^)]*)\)/)?.[1].split(",").map((name) => name.trim().split(/[\s:]/)[0]) ?? [];

/**
 * A copy table with each function called on `{name}` for its parameters,
 * named as in `reference` (the Korean table) when given, by position: the
 * languages name their parameters differently.
 */
function withPlaceholders(copy, reference = copy) {
  return Object.fromEntries(Object.entries(copy).map(([key, value]) => {
    if (typeof value !== "function") return [key, value];
    return [key, value(...parameterNames(reference[key]).map((name) => `{${name}}`))];
  }));
}

const FILES = {
  // What the page frame says: lib/i18n.ts with its fallbacks applied, the one
  // menu label that lives in lib/i18n-meme-cards.ts, the chat panel, the
  // save button the frame's sign-in dialog belongs to, and the card export.
  "frame.json": () => ({
    locales: SUPPORTED_LOCALES.map((code) => ({
      code,
      name: LANGUAGE_NAMES[code],
      flag: LANGUAGE_FLAGS[code],
      short: LANGUAGE_SHORT_NAMES[code],
      lang: getDocumentLanguage(code),
      dir: getDocumentDirection(code),
    })),
    messages: perLocale((locale) => getMessages(locale)),
    memeCardsNav: perLocale((locale) => MEME_CARDS_COPY[locale].nav),
    chat: MEME_CHAT_COPY,
    save: componentCopy("components/save-button.tsx", "SAVE_COPY"),
    export: withLocaleFallback(sourceLiteral("components/export-button.tsx", "const COPY_BASE = ")),
  }),
  // The copy of /meme-cards and /{locale}/meme-cards (the page and
  // ui/meme-cards.js), Korean and the four editions. A function is written
  // out with `{name}` where its argument goes.
  "meme-cards.json": () => Object.fromEntries(["ko", "en", "ja", "zh", "zh-tw"].map((locale) => [locale, withPlaceholders(MEME_CARDS_COPY[locale], MEME_CARDS_COPY.ko)])),
  // /news: the Korean page copy, the age groups and the briefs of lib/meme-news.ts.
  "news.json": () => ({
    copy: withPlaceholders(PAGE_COPY.ko),
    audiences: AUDIENCE_LABELS_I18N.ko,
    briefs: MEME_NEWS_BRIEFS,
  }),
  // /quiz/r/{token}: the five grades of gradeForScore (from 90, 70, 50, 30
  // and 0 percent) and the mode labels.
  "quiz.json": () => ({
    grades: [90, 70, 50, 30, 0].map((percent) => ({ from: percent, ...gradeForScore(percent, 100) })),
    modes: QUIZ_MODE_LABEL,
  }),
  // The five articles of /guides and /guides/{slug}, as lib/guides.ts holds them.
  "guides.json": () => GUIDES,
  // The illustrated originals of /originals and /originals/edition/{slug}.
  "originals.json": () => EDITORIAL_ORIGINALS,
  // The themed lists of /collections and /collections/{slug}: lib/collections.ts
  // and the groups the index page arranges them in.
  "collections.json": () => ({
    collections: COLLECTIONS,
    groups: sourceLiteral("app/(default)/collections/page.tsx", "const GROUPS = "),
  }),
  // The eight editorial memes of the home guide (lib/curated-memes.ts): the
  // meme page renders one when its short id has no database row.
  "curated.json": () => CURATED_CORE_MEMES,
  // The home page in each language it has (`/` and `/{locale}`): the copy of
  // its sections, the four usage signals, the SEO names its metadata and
  // JSON-LD use; the listable curated memes (the fallback deck and the
  // safety showcase) and the self-check quiz of
  // components/safety-diagnostic-quiz.tsx.
  "home.json": () => ({
    locales: Object.fromEntries(HOME_LOCALES.map((locale) => [locale, {
      home: HOME_COPY[locale],
      web3: HOME_WEB3_COPY[locale],
      story: HOME_IMMERSIVE_COPY[locale],
      scene: HOME_SCENE_COPY[locale],
      discovery: withPlaceholders(HOME_DISCOVERY_COPY[locale]),
      signals: getSafetySignalCopy(locale),
      seo: getSeoCopy(locale),
    }])),
    curated: CURATED_CORE_MEMES.filter(curatedPassesIndexGate).map((meme) => ({
      id: meme.id,
      short_id: meme.short_id,
      slug: meme.slug,
      title: meme.title,
      summary: meme.summary,
      category: meme.category,
      safety_level: meme.safety_level,
      origin_year: meme.origin_year,
      work: meme.usage_context.work,
      friends: meme.usage_context.friends,
      dialogue: meme.usage_examples[0]?.dialogue[1] ?? null,
    })),
    diagnostic: sourceLiteral("components/safety-diagnostic-quiz.tsx", "const DIAGNOSTIC_QUESTIONS: readonly QuizQuestion[] = "),
    hint: sourceLiteral(
      "components/home/translated-edition-hint.tsx",
      "const HINT_COPY: Record<SeoContentLocale, { lead: string; cta: string }> = ",
    ),
  }),
  // `/{locale}/rankings` (app/locale-rankings): for each prefix, the title,
  // the fallback copy and its explore link, and the alt of the share card
  // `ogDefaultImageDescriptor(locale)` names.
  "locale-rankings.json": () => Object.fromEntries(RANKINGS_LOCALE_PREFIXES.map((locale) => [locale, {
    ...rankingsFallbackCopy(locale),
    exploreHref: rankingsExploreHref(locale),
    image: ogDefaultImageDescriptor(locale),
  }])),
  // `/{locale}/explore` (app/[locale]/explore): `LOCALIZED_EXPLORE_COPY`.
  "locale-explore.json": () => Object.fromEntries(
    Object.entries(LOCALIZED_EXPLORE_COPY).map(([locale, copy]) => [locale, withPlaceholders(copy)]),
  ),
  // The 410 document of the retired product pages (lib/retired-products.ts):
  // its copy, its own header and navigation, the shipped illustrations that
  // fill missing cards, and the safety labels its cards show in each language
  // a meme path can have.
  "retired.json": () => ({
    copy: sourceLiteral("components/retired-products-page.tsx", "const COPY = "),
    document: sourceLiteral("lib/retired-product-document.ts", "const COPY = "),
    brand: sourceLiteral("lib/retired-product-document.ts", "const BRAND = "),
    nav: sourceLiteral("lib/retired-product-document.ts", "const NAV = "),
    fallbackPicks: sourceLiteral("lib/retired-product-memes.ts", "export const RETIRED_PRODUCT_FALLBACK_PICKS = "),
    safetyLabels: Object.fromEntries(
      ["ko", "en", "ja", "zh", "zh-tw"].map((locale) => [
        locale,
        Object.fromEntries(Object.entries(getSafetySignalCopy(locale).levels).map(([level, signal]) => [level, signal.label])),
      ]),
    ),
  }),
};

let stale = 0;
for (const [name, build] of Object.entries(FILES)) {
  const file = resolve(out, name);
  const text = `${JSON.stringify(build(), null, 1)}\n`;
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(file, "utf8");
    } catch {
      /* missing counts as stale */
    }
    if (current !== text) {
      console.error(`server/i18n/${name} is stale: a TypeScript dictionary changed. Run server/scripts/build-i18n.mjs`);
      stale += 1;
    }
  } else {
    writeFileSync(file, text);
    console.log(`${file}: ${text.length} bytes`);
  }
}
process.exit(stale ? 1 : 0);
