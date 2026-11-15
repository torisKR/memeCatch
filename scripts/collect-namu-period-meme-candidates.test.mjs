import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { parseNamuKoreaPeriodMemes } from "./collect-namu-period-meme-candidates.mjs";

const source = readFileSync(new URL("./collect-namu-period-meme-candidates.mjs", import.meta.url), "utf8");
assert.match(source, /memeTitleKey/);
assert.match(source, /catalog_match_status: "new"/);
assert.match(source, /needs_human_source_match/);
assert.match(source, /never writes to Supabase/);

const sample = `
무대뽀](https://namu.wiki/w/a)

- 2010년

  - 1월: [테스트밈](https://namu.wiki/w/%ED%85%8C%EC%8A%A4%ED%8A%B8%EB%B0%88 "테스트밈"), [각설이](https://namu.wiki/w/%EA%B0%81%EC%84%A4%EC%9D%B4)

#### [1.1.4.](https://namu.wiki/w/x#toc) 2018년

- 1월: [폰은정](https://namu.wiki/w/%ED%8F%B0%EC%9D%80%EC%A0%95), [신규 챌린지](https://namu.wiki/w/challenge)

### [1.2.](https://namu.wiki/w/x#toc) [해외](https://namu.wiki/w/overseas)

- 2018년

  - 1월: [Ugandan Knuckles](https://namu.wiki/w/ugandan)
`;

const rows = parseNamuKoreaPeriodMemes(sample, { minYear: 2010, maxYear: 2026 });
assert.equal(rows.length, 4);
assert.deepEqual(
  new Set(rows.map((row) => `${row.origin_year}:${row.title}`)),
  new Set(["2010:테스트밈", "2010:각설이", "2018:폰은정", "2018:신규 챌린지"]),
);
assert.equal(rows.find((row) => row.title === "신규 챌린지")?.category_hint, "challenge");
assert.ok(!rows.some((row) => row.title === "Ugandan Knuckles"));
console.log("collect-namu-period-meme-candidates safeguards OK");
