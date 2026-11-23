#!/usr/bin/env node
// Prints SQL that puts `memes` in a known state for the parity scripts. Pipe
// it to psql as a superuser of a THROWAWAY database (scripts/test-db.sh): it
// deletes every approved meme.
//
//   node server/parity/seed-memes.mjs spread   | docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q
//   node server/parity/seed-memes.mjs pool 300 | ...
//   node server/parity/seed-memes.mjs empty    | ...
//
// spread: 31 approved memes whose short ids are evenly spaced, so a random
//         pick reaches each equally often, and 31 that are not approved
//         (slug `parity-hidden-*`) in between.
// pool N: the first N rows of tests/fixtures/daily_quiz.json, approved.
// empty:  no approved meme.
import { readFileSync } from "node:fs";

const [mode, countArg] = process.argv.slice(2);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const NOT_APPROVED = ["pending", "fact_checking", "rights_checking", "limited", "rejected"];
const quote = (value) => (value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`);

let rows;
if (mode === "spread") {
  rows = [...ALPHABET].flatMap((letter, index) => [
    {
      short_id: `${letter}mmmmmmm`,
      slug: index % 3 === 0 ? `parity-밈 ${index}/a?` : `parity-plain-${index}`,
      title: `패리티 밈 ${letter} (Parity ${index})`,
      summary: `${letter}로 시작하는 ${index}번째 밈이 어디에서 왔고 언제 쓰는지 설명하는 충분히 긴 요약이에요.`,
      category: ["phrase", "dance", "song"][index % 3],
      origin_year: index % 4 === 0 ? null : 2000 + index,
      safety_level: ["green", "yellow", "gray", "red"][index % 4],
      status: "approved",
    },
    {
      short_id: `${letter}nnnnnnn`,
      slug: `parity-hidden-${index}`,
      title: `숨은 밈 ${index}`,
      summary: `승인되지 않은 ${index}번째 밈이라서 어떤 응답에도 나오면 안 되는 요약이에요.`,
      category: "phrase",
      origin_year: 2020,
      safety_level: "green",
      status: NOT_APPROVED[index % NOT_APPROVED.length],
    },
  ]);
} else if (mode === "pool" && Number.isInteger(Number(countArg))) {
  const fixture = JSON.parse(readFileSync(new URL("../tests/fixtures/daily_quiz.json", import.meta.url), "utf8"));
  rows = fixture.rows.slice(0, Number(countArg)).map((row, index) => ({ ...row, slug: `parity-${index}`, status: "approved" }));
} else if (mode === "empty") {
  rows = [];
} else {
  console.error("usage: seed-memes.mjs spread | pool <count> | empty");
  process.exit(2);
}

const values = rows.map(
  (row) =>
    `(${[row.short_id, row.slug, row.title, row.summary].map(quote).join(", ")}, ${quote(row.category)}::meme_category, ${row.origin_year ?? "null"}, ${quote(row.safety_level)}::safety_level, ${quote(row.status)}::moderation_status)`,
);
console.log("begin;");
console.log("delete from public.memes where slug like 'parity-%' or moderation_status = 'approved';");
if (values.length) {
  console.log(
    `insert into public.memes (short_id, slug, title, summary, category, origin_year, safety_level, moderation_status) values\n${values.join(",\n")};`,
  );
}
console.log("commit;");
