#!/usr/bin/env node
// Writes what the real generateMemeConcepts (lib/meme-studio.server.ts)
// returns for every tone and format over topics chosen for the template
// rules (particles, upper case, dashes, UTF-16 length). The Rust port in
// src/routes/studio/templates.rs is held to it.
//
//   node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
//     server/parity/meme-studio-fixture.mjs > server/tests/fixtures/meme_studio.json
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const { generateMemeConcepts, MEME_TONES, MEME_FORMATS } = await import(path.join(ROOT, "lib/meme-studio.server.ts"));

const topics = [
  "밈", "고양이", "출근길", "월요일 아침", "cat", "Cats", "straße", "ǆ digraph",
  "AI—대체", "a–b 대결", "😀 이모지", "😀😀", "x".repeat(118), "가나다라마바사아자차카타파하".repeat(8).slice(0, 120),
  "123", "밈 2026", "İstanbul", "ﬁ ligature", "été",
];
const out = [];
for (const topic of topics) {
  for (const tone of MEME_TONES) {
    for (const format of MEME_FORMATS) {
      out.push({ topic, tone, format, result: await generateMemeConcepts({ topic, tone, format }) });
    }
  }
}
process.stdout.write(`${JSON.stringify(out)}\n`);
