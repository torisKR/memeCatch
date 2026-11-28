#!/usr/bin/env node
// The /memes directory's 3,562 memes as SQL (explore.spec.mjs reads its page
// count and order): the catalog of server/tests/fixtures/directory_order.json,
// which the ICU order test holds the server to. Throwaway database only; run
// before b2-seed.sql (it gives 360 of these rows the timeline's years),
// b2b-seed.sql (the meme cards are made on them) and b3-seed.sql (it takes
// four of them out, PLAN.md B3-10).
//
//   node server/behaviour/seeds/b2-catalog.mjs | psql
import { readFileSync } from "node:fs";

const fixture = new URL("../../tests/fixtures/directory_order.json", import.meta.url);
const { items } = JSON.parse(readFileSync(fixture, "utf8"));
const sqlText = (value) => `'${value.replaceAll("'", "''")}'`;

// Indexable prose (pages/content_depth.rs): a solid description, a rich
// origin and a usage note, so that every row is listed.
const description =
  "이 문서는 밈 전체 목록의 가나다 정렬을 두 서버에서 비교하려고 만든 검증용 밈입니다. 제목이 무엇이든 같은 본문을 쓰고, " +
  "뜻과 쓰임과 유래를 설명하는 문장을 넉넉히 적어 색인 기준을 넘깁니다. 실제 문서처럼 어떤 자리에서 누가 쓰는지, " +
  "듣는 사람이 어떻게 받아들이는지, 언제 쓰면 어색한지까지 적어 둡니다. 정렬은 제목만 보고 하므로 본문은 결과에 " +
  "영향을 주지 않습니다. 다만 본문이 얇으면 목록에서 빠지므로, 모든 행이 목록에 오르도록 길게 적었습니다. " +
  "세 번째 문장 묶음은 길이를 채우려는 것입니다. 정렬 검증용 문서는 수천 개가 같은 본문을 나눠 씁니다.";
const origin =
  "2026년 가을 밈캐치의 Axum 이관 작업에서 가나다 정렬 비교를 위해 만들어졌고, 제목은 저장소의 실제 밈 제목과 경계 사례에서 왔습니다.";
const usageNote = "정렬 검증용 문서라 실제 대화에서 쓰지 않습니다. 목록의 순서만 확인할 때 씁니다.";

process.stdout.write(`${[
  "delete from memes where slug like 'dir-%';",
  "create temporary table dir_catalog (short_id text, slug text, title text) on commit drop;",
  "insert into dir_catalog values",
  `${items.map((item) => `  (${sqlText(item.short_id)}, ${sqlText(item.slug)}, ${sqlText(item.title)})`).join(",\n")};`,
  "insert into memes (short_id, slug, title, summary, description, origin, usage_note, usage_examples, category, origin_year,",
  "  year_precision, safety_level, lifecycle_status, moderation_status, doc_class, published_at, updated_at, created_at)",
  `select short_id, slug, title, '정렬 검증용 밈 ' || short_id, ${sqlText(description)}, ${sqlText(origin)}, ${sqlText(usageNote)}, '[]'::jsonb,`,
  "  'phrase', null, 'unknown', 'green', 'active', 'approved', 'meme',",
  "  '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z' from dir_catalog;",
  // The visual browse grid needs enough approved art to exercise pagination.
  "insert into meme_contents (meme_id, type, thumbnail_url, availability, moderation_status)",
  "select id, 'image', '/ai-memes/ai-slop.jpg', 'live', 'approved' from memes",
  "  where slug like 'dir-%' order by short_id limit 120;",
].join("\n")}\n`);
