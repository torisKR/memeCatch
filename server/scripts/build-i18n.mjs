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
import { CURATED_CORE_MEMES } from "@/lib/curated-memes";
import { LOGIN_COPY } from "@/lib/i18n-login";
import { MY_COPY } from "@/lib/i18n-my";
import { AI_MEME_DISPLAY_CATEGORY, CATEGORIES, DISPLAY_CATEGORY_LIST, resolveDisplayCategory } from "@/lib/labels";

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

/** A copy table with each function called on `{name}` for its parameters. */
function withPlaceholders(copy) {
  return Object.fromEntries(Object.entries(copy).map(([key, value]) => {
    if (typeof value !== "function") return [key, value];
    const names = String(value).match(/^\(([^)]*)\)/)?.[1].split(",").map((name) => name.trim().split(/[\s:]/)[0]) ?? [];
    return [key, value(...names.map((name) => `{${name}}`))];
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
  // The Korean copy of /meme-cards (the page and ui/meme-cards.js). A
  // function is written out with `{name}` where its argument goes.
  "meme-cards.json": () => withPlaceholders(MEME_CARDS_COPY.ko),
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
  // The sign-in page's copy in every language (lib/i18n-login.ts): Next
  // changes it in place with the language switch. `oauthUnavailable` is a
  // function there; here its text with `{provider}` for the argument.
  "login.json": () =>
    perLocale((locale) => ({ ...LOGIN_COPY[locale], oauthUnavailable: LOGIN_COPY[locale].oauthUnavailable("{provider}") })),
  // The account pages' copy (lib/i18n-my.ts) as far as the native pages use
  // it, every language, and the interest chips of /onboarding
  // (`INTEREST_CATEGORIES`: the display categories without the AI one).
  "my.json": () => ({
    // Its functions as templates with `{name}` for each argument; `greeting`
    // as its two forms.
    locales: perLocale((locale) => {
      const copy = MY_COPY[locale];
      const { library } = copy.saved;
      return {
        ...copy,
        greeting: { withAge: copy.greeting("{age}"), plain: copy.greeting() },
        saved: {
          ...copy.saved,
          library: {
            ...library,
            results: library.results("{matches}", "{total}"),
            pagination: { ...library.pagination, status: library.pagination.status("{page}", "{total}") },
          },
        },
        submissions: { ...copy.submissions, submittedAt: copy.submissions.submittedAt("{date}") },
      };
    }),
    // /my's interest chips: `resolveDisplayCategory` of each legacy category,
    // and the first legacy category of each display category (its label).
    displayByLegacy: Object.fromEntries(Object.keys(CATEGORIES).map((category) => [category, resolveDisplayCategory(category)])),
    displayFirst: Object.fromEntries(DISPLAY_CATEGORY_LIST.map(({ key, categories }) => [key, categories[0]])),
    interestCategories: DISPLAY_CATEGORY_LIST.filter(({ key }) => key !== AI_MEME_DISPLAY_CATEGORY).map(({ key, categories }) => ({ key, categories })),
  }),
  // The eight editorial memes of the home guide (lib/curated-memes.ts): the
  // meme page renders one when its short id has no database row.
  "curated.json": () => CURATED_CORE_MEMES,
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
