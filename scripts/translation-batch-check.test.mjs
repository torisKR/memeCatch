import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseTranslationArtifacts, splitSqlStatements, validateTranslationBatch } from "./translation-batch-check.mjs";
import { buildAtomicInsertSql } from "./translate-memes-mlx-linked.mjs";

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
assert.ok(real.forbiddenMutations.length > 0, "historical self-promotion SQL must be inventoried");
assert.ok(
  real.errors.some((error) => error.includes("forbidden translation-table mutation")),
  "historical mutation must fail the safety gate",
);
assert.equal(real.records.length, 448);
assert.ok(real.records.every((row) => row.hasConflictGuard));

const unsafeDir = mkdtempSync(join(tmpdir(), "memecatch-translation-unsafe-"));
try {
  writeFileSync(
    join(unsafeDir, "en-slice0.sql"),
    "update public.meme_translations set status='reviewed', reviewed_at=now(), reviewed_by='00000000-0000-0000-0000-000000000001'::uuid;\n",
  );
  writeFileSync(
    join(unsafeDir, "en-slice1.sql"),
    "insert into public.meme_translations (meme_id, locale, status, reviewed_at, reviewed_by) values ('00000000-0000-0000-0000-000000000001', 'en', 'reviewed', now(), '00000000-0000-0000-0000-000000000001'::uuid) on conflict (meme_id, locale) do nothing;\n",
  );
  writeFileSync(join(unsafeDir, "en-slice2.sql"), "call public.review_translation_batch();\n");
  writeFileSync(join(unsafeDir, "en-slice3.sql"), "select public.rpc('review_translation_batch');\n");
  const unsafeArtifact = parseTranslationArtifacts(unsafeDir);
  assert.equal(unsafeArtifact.forbiddenMutations.length, 3);
  assert.match(unsafeArtifact.errors.join("\n"), /forbidden translation-table mutation/);
  assert.equal(unsafeArtifact.records[0].hasReviewPromotion, true);
  const unsafeReport = validateTranslationBatch({
    worklist,
    artifacts: unsafeArtifact,
  });
  assert.equal(unsafeReport.ok, false);
} finally {
  rmSync(unsafeDir, { recursive: true, force: true });
}

const atomicDir = mkdtempSync(join(tmpdir(), "memecatch-translation-check-"));
try {
  const meme = {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "source-slug",
    title: "원문 제목",
    summary: "원문 요약",
    description: "원문 설명",
    origin: "원문 유래",
    usage_note: null,
    caution: null,
    aliases: ["원문 별칭"],
    usage_examples: [],
    updated_at: "2026-08-08T00:00:00.000Z",
  };
  const translation = {
    title: "Source Title",
    summary: "An English summary.",
    description: "An English description.",
    origin: "An English origin.",
    usage_note: null,
    caution: null,
    aliases: ["Source Title"],
    usage_examples: [],
  };
  for (const locale of ["en", "ja", "zh", "zh-tw"]) {
    writeFileSync(
      join(atomicDir, `${locale}-slice0.sql`),
      `${buildAtomicInsertSql({ meme, locale, translation, model: "test-model" })};\n`,
    );
  }
  const atomic = parseTranslationArtifacts(atomicDir);
  assert.equal(atomic.errors.length, 0, atomic.errors.join("\n"));
  assert.equal(atomic.records.length, 4);
  assert.ok(atomic.records.every((record) => record.memeId === meme.id));
  assert.deepEqual(
    atomic.records.map((record) => record.locale).sort(),
    ["en", "ja", "zh", "zh-tw"].sort(),
  );
  assert.ok(atomic.records.every((record) => record.hasConflictGuard));
  assert.ok(atomic.records.every((record) => record.hasMachineStatus));
  assert.ok(atomic.records.every((record) => !record.hasReviewPromotion));
  assert.ok(atomic.records.every((record) => record.hasSourceSnapshotGuard));
  const cleanReport = validateTranslationBatch({
    worklist,
    artifacts: atomic,
    requireComplete: true,
  });
  assert.equal(cleanReport.ok, true, cleanReport.errors.join("\n"));
} finally {
  rmSync(atomicDir, { recursive: true, force: true });
}

console.log("translation batch checker safeguards OK");
