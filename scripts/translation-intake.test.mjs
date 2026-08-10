import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseTranslationArtifacts } from "./translation-batch-check.mjs";
import { run, validateIntakePack } from "./translation-intake.mjs";
import { sourceSnapshot, sourceSnapshotHash } from "./translate-memes-mlx-linked.mjs";

const meme = {
  id: "00000000-0000-0000-0000-000000000001",
  short_id: "abcdefgh",
  slug: "test-meme",
  title: "테스트 밈",
  summary: "이 밈은 짧은 상황에서 쓰는 밈입니다.",
  description: "한국에서 쓰이는 테스트 밈입니다.",
  origin: "테스트 원문에서 시작했습니다.",
  usage_note: null,
  caution: null,
  aliases: ["테스트 밈"],
  usage_examples: [{ situation: "카카오톡", text: "이건 테스트 밈이야." }],
  updated_at: "2026-08-08T00:00:00.000Z",
};

const secondMeme = {
  ...meme,
  id: "00000000-0000-0000-0000-000000000002",
  short_id: "bcdefghi",
  slug: "test-meme-two",
};

const translations = {
  en: {
    title: "Test Meme",
    summary: "This meme is used in short situations.",
    description: "This is a test meme used in Korea.",
    origin: "It started from a test source.",
    usage_note: null,
    caution: null,
    aliases: ["테스트 밈", "Test Meme"],
    usage_examples: [{ situation: "KakaoTalk", text: "This is a test meme." }],
  },
  ja: {
    title: "テストミーム",
    summary: "このミームは短い場面で使われます。",
    description: "韓国で使われるテストミームです。",
    origin: "テスト用の原文から始まりました。",
    usage_note: null,
    caution: null,
    aliases: ["테스트 밈", "テストミーム"],
    usage_examples: [{ situation: "カカオトーク", text: "これはテストミームです。" }],
  },
  zh: {
    title: "测试梗",
    summary: "这个梗用于简短的场合。",
    description: "这是在韩国使用的测试梗。",
    origin: "它源自一段测试原文。",
    usage_note: null,
    caution: null,
    aliases: ["테스트 밈", "测试梗"],
    usage_examples: [{ situation: "聊天软件", text: "这是一个测试梗。" }],
  },
  "zh-tw": {
    title: "測試迷因",
    summary: "這個迷因用於簡短的情境。",
    description: "這是在韓國使用的測試迷因。",
    origin: "它源自一段測試原文。",
    usage_note: null,
    caution: null,
    aliases: ["테스트 밈", "測試迷因"],
    usage_examples: [{ situation: "聊天軟體", text: "這是一個測試迷因。" }],
  },
};

const pack = {
  version: 1,
  rows: Object.entries(translations).map(([locale, translation]) => ({
    meme,
    locale,
    translation,
    provider: "human-editor",
    model: "external-editor",
    prompt_version: 1,
  })),
};

const worklist = {
  total: 1,
  byMemeId: new Map([[meme.id, meme.short_id]]),
};

const valid = validateIntakePack({ pack, worklist, requireComplete: true });
assert.equal(valid.ok, true, valid.errors.join("\n"));
assert.equal(valid.validRows, 4);
assert.deepEqual(valid.localeCounts, { en: 1, ja: 1, zh: 1, "zh-tw": 1 });

const legacyPack = {
  provenance: { authoring: "OpenAI gpt-5.6-luna agent draft" },
  rows: pack.rows.map(({ meme: source, locale, translation }) => ({
    locale,
    source,
    source_snapshot_hash: sourceSnapshotHash(sourceSnapshot(source)),
    translation,
  })),
};
const legacy = validateIntakePack({ pack: legacyPack, worklist, requireComplete: true });
assert.equal(legacy.ok, true, legacy.errors.join("\n"));
assert.equal(legacy.validRows, 4);
assert.ok(legacy.rows.every((row) => row.provider === "openai" && row.model === "gpt-5.6-luna"));

const legacyStale = JSON.parse(JSON.stringify(legacyPack));
legacyStale.rows[0].source_snapshot_hash = "0".repeat(64);
const staleLegacy = validateIntakePack({ pack: legacyStale, worklist });
assert.equal(staleLegacy.ok, false);
assert.match(staleLegacy.errors.join("\n"), /source_snapshot_hash does not match source/);

const incomplete = validateIntakePack({
  pack: { rows: pack.rows.slice(0, 3) },
  worklist,
  requireComplete: true,
});
assert.equal(incomplete.ok, false);
assert.match(incomplete.errors.join("\n"), /missing locales zh-tw/);

const duplicate = validateIntakePack({
  pack: { rows: [...pack.rows, pack.rows[0]] },
  worklist,
});
assert.equal(duplicate.ok, false);
assert.match(duplicate.errors.join("\n"), /duplicate translation/);
assert.equal(duplicate.canonical.duplicateInputRows, 1);

const outOfWorklist = validateIntakePack({
  pack: { rows: [{ ...pack.rows[0], meme: secondMeme }] },
  worklist,
});
assert.equal(outOfWorklist.ok, false);
assert.equal(outOfWorklist.canonical.outOfWorklistRows, 1);
assert.match(outOfWorklist.errors.join("\n"), /not in the worklist/);

const staleRows = JSON.parse(JSON.stringify(pack.rows));
staleRows[1].meme.title = "변경된 원문 밈";
const stale = validateIntakePack({ pack: { rows: staleRows }, worklist });
assert.equal(stale.ok, false);
assert.match(stale.errors.join("\n"), /source snapshot differs/);

const root = mkdtempSync(join(tmpdir(), "memecatch-translation-intake-"));
try {
  const inputPath = join(root, "pack.json");
  const worklistPath = join(root, "worklist.json");
  const artifactDir = join(root, "artifacts");
  writeFileSync(inputPath, JSON.stringify(pack), "utf8");
  writeFileSync(worklistPath, JSON.stringify({ total: 1, docs: [{ meme_id: meme.id, short_id: meme.short_id }] }), "utf8");

  const report = run([
    "--input", inputPath,
    "--worklist", worklistPath,
    "--artifact-dir", artifactDir,
    "--slice=82",
    "--require-complete",
    "--emit-artifact",
  ]);
  assert.equal(report.ok, true, report.errors.join("\n"));
  assert.equal(report.filesWritten.length, 4);
  assert.ok(report.filesWritten.every((path) => readFileSync(path, "utf8").includes("on conflict (meme_id, locale) do nothing")));

  const artifacts = parseTranslationArtifacts(artifactDir);
  assert.equal(artifacts.errors.length, 0, artifacts.errors.join("\n"));
  assert.equal(artifacts.records.length, 4);
  assert.ok(artifacts.records.every((record) => record.hasSourceSnapshotGuard));

  const historicalDir = join(root, "historical");
  const historicalReport = run([
    "--input", inputPath,
    "--worklist", worklistPath,
    "--artifact-dir", historicalDir,
    "--slice=83",
    "--require-complete",
    "--emit-artifact",
  ]);
  assert.equal(historicalReport.ok, true, historicalReport.errors.join("\n"));

  const duplicateExisting = run([
    "--input", inputPath,
    "--worklist", worklistPath,
    "--existing-artifact-dir", historicalDir,
    "--require-complete",
  ]);
  assert.equal(duplicateExisting.ok, false);
  assert.equal(duplicateExisting.canonical.existingSafeRows, 4);
  assert.equal(duplicateExisting.canonical.existingUnsafeRows, 0);
  assert.equal(duplicateExisting.canonical.duplicateExistingRows, 4);
  assert.equal(duplicateExisting.canonical.missingBefore.en, 0);

  const secondInputPath = join(root, "second-pack.json");
  const secondWorklistPath = join(root, "second-worklist.json");
  const secondPack = {
    rows: pack.rows.map((row) => ({ ...row, meme: secondMeme })),
  };
  const secondWorklist = {
    total: 2,
    docs: [
      { meme_id: meme.id, short_id: meme.short_id },
      { meme_id: secondMeme.id, short_id: secondMeme.short_id },
    ],
  };
  writeFileSync(secondInputPath, JSON.stringify(secondPack), "utf8");
  writeFileSync(secondWorklistPath, JSON.stringify(secondWorklist), "utf8");

  const unsafeDir = join(root, "unsafe");
  const unsafeReport = run([
    "--input", inputPath,
    "--worklist", worklistPath,
    "--artifact-dir", unsafeDir,
    "--slice=84",
    "--require-complete",
    "--emit-artifact",
  ]);
  assert.equal(unsafeReport.ok, true, unsafeReport.errors.join("\n"));
  const unsafeEnPath = join(unsafeDir, "en-slice84.sql");
  writeFileSync(
    unsafeEnPath,
    `${readFileSync(unsafeEnPath, "utf8")}\nupdate public.meme_translations set status = 'reviewed';\n`,
    "utf8",
  );

  const newArtifactDir = join(root, "new-artifacts");
  const isolatedUnsafe = run([
    "--input", secondInputPath,
    "--worklist", secondWorklistPath,
    "--existing-artifact-dir", unsafeDir,
    "--artifact-dir", newArtifactDir,
    "--slice=85",
    "--require-complete",
    "--emit-artifact",
  ]);
  assert.equal(isolatedUnsafe.ok, true, isolatedUnsafe.errors.join("\n"));
  assert.equal(isolatedUnsafe.canonical.existingSafeRows, 3);
  assert.equal(isolatedUnsafe.canonical.existingUnsafeRows, 1);
  assert.equal(isolatedUnsafe.canonical.existingArtifactOk, false);
  assert.ok(isolatedUnsafe.canonical.existingArtifactErrors > 0);
  assert.equal(isolatedUnsafe.canonical.newRows, 4);
  assert.equal(isolatedUnsafe.canonical.missingBefore.en, 2);
  assert.equal(isolatedUnsafe.canonical.missingAfter.en, 1);
  assert.equal(isolatedUnsafe.canonical.localeDelta.en.delta, 1);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("translation intake safeguards OK");
