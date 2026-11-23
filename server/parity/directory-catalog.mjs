#!/usr/bin/env node
// The /memes directory orders its memes with
// `Intl.Collator("ko", { sensitivity: "base", numeric: true })` and then by
// short id (`sortDirectory` in lib/meme-directory.ts). Axum orders them with
// ICU4X (`pages/directory.rs`). This script makes the catalog both are held
// to and the order the real TypeScript gives it.
//
//   # The fixture, on the Node of the Next image (its ICU decides the order):
//   docker run --rm -v "$PWD":/w:ro -w /w node:22-bookworm-slim \
//     node --experimental-strip-types --import ./scripts/register-ts-paths.mjs \
//     server/parity/directory-catalog.mjs > server/tests/fixtures/directory_order.json
//
//   # The same catalog as rows, for the page gate (throwaway database, superuser):
//   node server/parity/directory-catalog.mjs sql | psql
//
// The titles are every short `title`/`name` string in data/ (real meme and
// article titles) and generated cases: Latin in three cases, accents, digits
// in every width, leading punctuation, emoji, jamo, Hanja, kana, whitespace
// JavaScript and Rust trim differently, blank titles (the slug stands in) and
// duplicates (the short id decides).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE = path.join(ROOT, "server/tests/fixtures/directory_order.json");
// `gen_short_id()` in db/migrations/20260708004500_schema_v2.sql.
const SHORT_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const MAX_DATA_TITLE = 80;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function dataTitles() {
  const titles = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const key of ["title", "name"]) {
      const text = value[key];
      if (typeof text === "string" && text.trim() && text.length <= MAX_DATA_TITLE) titles.add(text);
    }
    Object.values(value).forEach(visit);
  };
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (name.endsWith(".json")) {
        try {
          visit(JSON.parse(fs.readFileSync(file, "utf8")));
        } catch {
          // Not JSON a title can come from.
        }
      }
    }
  };
  walk(path.join(ROOT, "data"));
  return [...titles];
}

const HANDWRITTEN = [
  "apple", "Apple", "APPLE", "apples", "Zebra", "zoo", "café", "cafe", "Cafe", "Ångström", "naïve", "élan", "über", "Œuvre",
  "1", "2", "10", "100", "01", "001", "2026 밈", "2025 밈", "10대 밈", "9시 뉴스", "1+1", "3.14", "1,000원", "½", "①", "１２３",
  "٣ arabic", "२ devanagari", "0", "00", "007 요원", "7", "77", "1등", "2등", "10등", "100만", "99%", "2x", "x2",
  "'따옴표'", "\"인용\"", "(괄호)", "[대괄호]", "!느낌표", "?물음표", "#해시태그", "@멘션", "...말줄임", "…말줄임", "~물결",
  "-하이픈", "_밑줄", "·가운뎃점", "「낫표」", "『겹낫표』", "《책》", "★별", "♥하트", "※참고", "→화살표", "&앰퍼샌드", "/슬래시",
  "😂 웃음", "🔥불", "👍", "🫠 녹는 얼굴", "❤️", "🇰🇷 태극기", "👨‍👩‍👧 가족", "🙂🙃", "💀", "ㅋ😂", "밈😂", "😂밈",
  "MZ세대", "mz세대", "Mz세대", "K-팝", "K팝", "kpop", "K-POP", "LOL", "lol", "Lol", "ㅋㅋㅋ", "ㅋㅋ", "ㅎㅎ", "ㄹㅇ", "ㅇㅈ",
  "ㄱㄱ", "ㄲ", "ㅏ", "가", "각", "갂", "갃", "나", "힣", "ᄀ", "가", "가나다", "가 나 다", "가-나", "가나_다", "가나다라마바사",
  "大박", "漢字", "中二病", "一", "二", "かわいい", "カワイイ", "ｶﾜｲｲ", "躺平", "内卷", "ไทย", "Ελληνικά", "Кириллица", "עברית",
  "  앞공백", "뒤공백  ", "\t탭", "　전각공백", "﻿바이트순서표", "\u0085넬", " 줄바꿈없는공백", "중간​폭없는공백",
  "같은 제목", "같은 제목", "같은 제목", "Same Title", "same title", "SAME TITLE", "가나", "가나", "ｶﾞ", "ガ", "が",
  "   ", "", "\t",
];

function generatedTitles(random) {
  const titles = [];
  for (let n = 1; n <= 120; n += 1) titles.push(`밈 ${n}`, `Meme ${n}`, `${n}번째 밈`);
  for (let n = 0; n < 60; n += 1) titles.push(`v${(random() * 3).toFixed(1)}.${Math.floor(random() * 20)}`);
  const syllable = () => String.fromCodePoint(0xac00 + Math.floor(random() * 11172));
  for (let n = 0; n < 220; n += 1) {
    const length = 2 + Math.floor(random() * 4);
    titles.push(Array.from({ length }, syllable).join(""));
  }
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let n = 0; n < 80; n += 1) {
    const length = 3 + Math.floor(random() * 6);
    titles.push(Array.from({ length }, () => letters[Math.floor(random() * letters.length)]).join(""));
  }
  return titles;
}

function catalog() {
  const random = seededRandom(20261124);
  const titles = [...dataTitles(), ...HANDWRITTEN, ...generatedTitles(random)];
  const taken = new Set();
  const shortId = () => {
    for (;;) {
      const id = Array.from({ length: 8 }, () => SHORT_ID_ALPHABET[Math.floor(random() * SHORT_ID_ALPHABET.length)]).join("");
      if (!taken.has(id)) {
        taken.add(id);
        return id;
      }
    }
  };
  return titles.map((title) => {
    const short_id = shortId();
    return { short_id, slug: `dir-${short_id}`, title };
  });
}

async function fixture() {
  const { sortDirectory } = await import(path.join(ROOT, "lib/meme-directory.ts"));
  const items = catalog();
  // `loadMemeDirectory`: `row.title?.trim() || row.slug`.
  const listed = items.map((item) => ({
    id: item.short_id,
    short_id: item.short_id,
    slug: item.slug,
    title: item.title.trim() || item.slug,
    summary: "",
    category: "phrase",
    origin_year: null,
  }));
  const order = sortDirectory(listed).map((item) => item.short_id);
  const out = { node: process.version, icu: process.versions.icu, unicode: process.versions.unicode, items, order };
  process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
}

const sqlText = (value) => `'${value.replaceAll("'", "''")}'`;

function sql() {
  const { items } = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  // Indexable prose (pages/content_depth.rs): a solid description (2 points),
  // a rich origin (2) and a usage note (1).
  const description =
    "이 문서는 밈 전체 목록의 가나다 정렬을 두 서버에서 비교하려고 만든 검증용 밈입니다. 제목이 무엇이든 같은 본문을 쓰고, " +
    "뜻과 쓰임과 유래를 설명하는 문장을 넉넉히 적어 색인 기준을 넘깁니다. 실제 문서처럼 어떤 자리에서 누가 쓰는지, " +
    "듣는 사람이 어떻게 받아들이는지, 언제 쓰면 어색한지까지 적어 둡니다. 정렬은 제목만 보고 하므로 본문은 결과에 " +
    "영향을 주지 않습니다. 다만 본문이 얇으면 목록에서 빠지므로, 모든 행이 목록에 오르도록 길게 적었습니다. " +
    "세 번째 문장 묶음은 길이를 채우려는 것입니다. 정렬 검증용 문서는 수천 개가 같은 본문을 나눠 씁니다.";
  const origin =
    "2026년 가을 밈캐치의 Axum 이관 작업에서 가나다 정렬 비교를 위해 만들어졌고, 제목은 저장소의 실제 밈 제목과 경계 사례에서 왔습니다.";
  const usageNote = "정렬 검증용 문서라 실제 대화에서 쓰지 않습니다. 목록의 순서만 확인할 때 씁니다.";
  const lines = [
    "-- Generated by server/parity/directory-catalog.mjs sql. Throwaway database only.",
    "begin;",
    "delete from memes where slug like 'dir-%';",
    "create temporary table dir_catalog (short_id text, slug text, title text) on commit drop;",
    "insert into dir_catalog values",
    items.map((item) => `  (${sqlText(item.short_id)}, ${sqlText(item.slug)}, ${sqlText(item.title)})`).join(",\n") + ";",
    "insert into memes (short_id, slug, title, summary, description, origin, usage_note, usage_examples, category, origin_year,",
    "  year_precision, safety_level, lifecycle_status, moderation_status, doc_class, published_at, updated_at, created_at)",
    `select short_id, slug, title, '정렬 검증용 밈 ' || short_id, ${sqlText(description)}, ${sqlText(origin)}, ${sqlText(usageNote)}, '[]'::jsonb,`,
    "  'phrase', null, 'unknown', 'green', 'active', 'approved', 'meme',",
    "  '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z' from dir_catalog;",
    "commit;",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

if (process.argv[2] === "sql") sql();
else await fixture();
