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
import { MEME_CHAT_COPY } from "@/lib/meme-chat-copy";
import { GUIDES } from "@/lib/guides";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../i18n");
const perLocale = (value) => Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, value(locale)]));

/**
 * The object literal passed to `withLocaleFallback(` after `const <name> =`
 * in a .tsx file, which Node cannot import. Copy that lives in a component
 * is read from its source so that it is still written once. Fails loudly
 * when the declaration moves.
 */
function componentCopy(file, name) {
  const source = readFileSync(resolve(here, "../..", file), "utf8");
  const marker = `const ${name} = withLocaleFallback(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`${file} no longer declares ${marker}; update build-i18n.mjs`);
  let depth = 0;
  let quote = null;
  for (let index = start + marker.length; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}" && --depth === 0) {
      const literal = source.slice(start + marker.length, index + 1);
      return withLocaleFallback(new Function(`return (${literal});`)());
    }
  }
  throw new Error(`${file}: ${name} has no end`);
}

const FILES = {
  // What the page frame says: lib/i18n.ts with its fallbacks applied, the one
  // menu label that lives in lib/i18n-meme-cards.ts, the chat panel, and the
  // save button the frame's sign-in dialog belongs to.
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
  }),
  // The five articles of /guides and /guides/{slug}, as lib/guides.ts holds them.
  "guides.json": () => GUIDES,
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
