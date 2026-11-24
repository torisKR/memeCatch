// Writes server/tests/fixtures/meme_embedding_vectors.json: the vectors the
// real lib/meme-embedding-runtime.server.ts (transformers.js 3.8.1 on
// onnxruntime-node 1.21.0) gives for real meme passages, queries and edge
// cases, with the token ids its tokenizer makes of each input.
//
//   npx vitest run --config server/parity/embeddings/vitest.config.mts
//
// The passages are documents of real memes (data/memes/verified), built the
// way public.meme_embedding_document builds them in SQL. The Rust port must
// give the same ids and a cosine of at least 0.9999 for every vector
// (server/tests/embedder_parity.rs).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

type Row = Record<string, unknown>;
type Case = { id: string; kind: "passage" | "query"; text: string; input_ids: number[]; vector: number[] };

const root = fileURLToPath(new URL("../../..", import.meta.url));
const out = fileURLToPath(new URL("../../tests/fixtures/meme_embedding_vectors.json", import.meta.url));
const MODEL = "intfloat/multilingual-e5-small";
const REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3";

function rows(file: string): Row[] {
  return readFileSync(`${root}/data/memes/verified/${file}`, "utf8")
    .split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as Row);
}

function text(value: unknown, max?: number): string | null {
  if (typeof value !== "string") return null;
  return max === undefined ? value : Array.from(value).slice(0, max).join("");
}

/** public.meme_embedding_document (db/migrations/20261003123428_meme_catalog_vectors.sql). */
function documentOf(row: Row): string {
  const aliases = Array.isArray(row.aliases) ? row.aliases.join(" ") : null;
  const parts = [text(row.title), aliases, text(row.summary), text(row.description, 3000),
    text(row.origin, 1500), text(row.usage_note, 1000)].filter((part): part is string => part !== null);
  const collapsed = parts.join("\n").replace(/[ \t\n\v\f\r]+/g, " ").trim();
  return Array.from(collapsed).slice(0, 6900).join("");
}

const probeSeed = "운영 배포의 동일 모델 메모리와 긴 문서 절단 경계를 확인합니다. ";
const probe = probeSeed.repeat(Math.ceil(6_900 / probeSeed.length)).slice(0, 6_900);

const edgePassages: Array<[string, string]> = [
  ["probe-document", probe],
  ["control-characters", "가\u0001나\u0007다\u000b라\u001f마\u007f바\u008f사\u009f아 끝"],
  ["space-like", "탭\t줄\n폼\f복귀\r엔비 오검 엠 제로​줄구분 문단 좁은 수학 원▁전각　비오엠﻿대체�끝"],
  ["fullwidth-tilde", "물결～표 와 ~ 반각, 전각 ＡＢＣ１２３ 그리고 ～～ 두 번"],
  ["nfkc", "①②③ ｶﾞｷﾞ ㎏㎞ ﬁ ½ Ⅻ ㈜ ㉠ ﾊﾟ 그리고 é (é)"],
  ["emoji", "웃음 🤣🤣 가족 👨‍👩‍👧 깃발 🇰🇷 피부 👍🏽 하트 ❤️"],
  ["special-tokens", "<mask> 가면 <s> 시작 </s> 끝 <pad> <unk> 그리고   <mask>뒤"],
  ["mixed-scripts", "Ça va? Déjà vu — Straße ПРИВЕТ мир ภาษาไทย العربية हिन्दी 日本語のミーム 中文"],
  ["english", "Rat Dance is a viral TikTok trend where people dance to a remix of the Rat Dance song."],
  ["whitespace-runs", "   앞 공백    가운데   여러   칸   뒤 공백   "],
  ["single-char", "밈"],
  ["latin-case", "HELLO hello HeLLo WORLD world"],
];

const queries: Array<[string, string]> = [
  ["q-korean", "query: 무야호"],
  ["q-short", "query: ab"],
  ["q-phrase", "query: 할머니 고추장 광고"],
  ["q-english", "query: rat dance"],
  ["q-slang", "query: 킹받네 진짜"],
  ["q-mixed", "query: BBBB 댄스 블링뱅뱅본"],
  ["q-emoji", "query: 🤣 웃긴 밈"],
  ["q-long", `query: ${"오늘의 밈 추천 ".repeat(15).slice(0, 120)}`],
];

test("capture transformers.js vectors", async () => {
  process.env.MEME_EMBEDDING_RUNTIME = "bundled";
  const runtime = await import("@/lib/meme-embedding-runtime.server");
  const passages: Array<[string, string]> = [];
  for (const [file, step] of [["round2-587.jsonl", 29], ["round3-796.jsonl", 37]] as const) {
    rows(file).forEach((row, index) => {
      if (index % step === 0) passages.push([`${file.split("-")[0]}-${index}`, documentOf(row)]);
    });
  }
  const longest = rows("round3-796.jsonl").map(documentOf).sort((a, b) => b.length - a.length)[0];
  passages.push(["longest-real", longest], ...edgePassages);

  const cases: Case[] = [];
  for (const [id, document] of passages) {
    const vector = await runtime.embedBundledMemePassage(document);
    if (!vector) throw new Error(`no vector for ${id}`);
    cases.push({ id, kind: "passage", text: document, input_ids: [], vector });
  }
  for (const [id, input] of queries) {
    const vector = await runtime.embedBundledMemeInput(input);
    if (!vector) throw new Error(`no vector for ${id}`);
    cases.push({ id, kind: "query", text: input, input_ids: [], vector });
  }

  // The pipeline's own tokenizer call (FeatureExtractionPipeline._call), for
  // telling a tokenizer difference from a numeric one.
  const { AutoTokenizer } = await import("@huggingface/transformers");
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL, { local_files_only: true, revision: REVISION });
  tokenizer.model_max_length = 512;
  for (const item of cases) {
    const input = item.kind === "passage" ? `passage: ${item.text}` : item.text;
    const encoded = tokenizer(input, { padding: true, truncation: true });
    item.input_ids = (encoded.input_ids.tolist() as bigint[][])[0].map(Number);
  }

  const fixture = {
    source: "server/parity/embeddings/vectors.capture.ts",
    model: MODEL, revision: REVISION,
    runtime: "@huggingface/transformers 3.8.1, onnxruntime-node 1.21.0, CPU fp32",
    node_max_rss_bytes: process.resourceUsage().maxRSS * 1024,
    cases,
  };
  writeFileSync(out, `${JSON.stringify(fixture)}\n`);
});
