import assert from "node:assert/strict";
import { parseTranslationArtifacts, splitSqlStatements, validateTranslationBatch } from "./translation-batch-check.mjs";

const statements = splitSqlStatements("select 'a;b'; insert into public.meme_translations (meme_id, locale) values ('00000000-0000-0000-0000-000000000001','en');");
assert.equal(statements.length, 2, "semicolons inside strings must not split statements");

const artifacts = parseTranslationArtifacts("artifacts/renewal/loop-050");
const worklist = {
  total: 1,
  byMemeId: new Map([["00000000-0000-0000-0000-000000000001", "abcdefgh"]]),
};
const report = validateTranslationBatch({ worklist, artifacts: { files: [], records: [], errors: [] } });
assert.equal(report.ok, true);
assert.equal(report.actualRows, 0);
assert.equal(report.missingCounts.en, 1);

const unsafe = validateTranslationBatch({
  worklist,
  artifacts: {
    files: ["en-slice0.sql"],
    errors: [],
    records: [
      {
        file: "en-slice0.sql",
        memeId: "00000000-0000-0000-0000-000000000001",
        locale: "en",
        fileLocale: "en",
        hasConflictGuard: false,
      },
    ],
  },
});
assert.equal(unsafe.ok, false);
assert.match(unsafe.errors.join("\n"), /no conflict guard/);

const real = parseTranslationArtifacts("artifacts/renewal/loop-050");
assert.equal(real.errors.length, 0, real.errors.join("\n"));
assert.equal(real.records.length, 440);
assert.ok(real.records.every((row) => row.hasConflictGuard));

console.log("translation batch checker safeguards OK");
