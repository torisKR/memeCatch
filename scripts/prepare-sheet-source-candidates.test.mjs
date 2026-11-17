import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const script = new URL("./prepare-sheet-source-candidates.mjs", import.meta.url);

function sheetRow(overrides = {}) {
  const row = Array(31).fill(null);
  row[0] = "VID-00001";
  row[2] = "Observed video title";
  row[6] = "유튜브 형식 미확인";
  row[7] = "Ｆｕｌｌ　 Name";
  row[8] = "dQw4w9WgXcQ";
  row[10] = "https://youtu.be/dQw4w9WgXcQ?t=1";
  row[12] = "https://knowyourmeme.com/videos/example";
  row[24] = "출처에 연결된 밈 사례·원본 관계 미확인";
  row[30] = "수집 후보";
  for (const [column, value] of Object.entries(overrides)) row[Number(column)] = value;
  return row;
}

async function fixture({ rows, memes }) {
  const root = await mkdtemp(join(tmpdir(), "memecatch-sheet-candidates-"));
  const inputDir = join(root, "sheet-id-123");
  const approved = join(root, "approved.jsonl");
  const output = join(root, "candidates.jsonl");
  await mkdir(inputDir);
  await writeFile(join(inputDir, "batch.json"), JSON.stringify({ tab: "2025", start: 2, rows }));
  await writeFile(approved, `${memes.map((meme) => JSON.stringify(meme)).join("\n")}\n`);
  return { root, inputDir, approved, output };
}

async function run(paths, extra = []) {
  const { stdout } = await execFileAsync(process.execPath, [
    script.pathname,
    "--input-dir",
    paths.inputDir,
    "--sheet-id",
    "1AbCdEfGhIjKlMnOpQrStUvWxYz_123-456",
    "--approved-memes",
    paths.approved,
    "--output",
    paths.output,
    ...extra,
  ]);
  return JSON.parse(stdout.trim());
}

const approved = (overrides = {}) => ({
  id: "meme-1",
  title: "Canonical title",
  aliases: ["full name"],
  moderation_status: "approved",
  ...overrides,
});

test("matches an NFKC, whitespace, and case normalized full alias and writes review-only provenance", async () => {
  const paths = await fixture({ rows: [sheetRow()], memes: [approved()] });
  try {
    const counts = await run(paths);
    assert.deepEqual(counts, {
      files: 1,
      rows: 1,
      candidates: 1,
      written: 1,
      duplicates: 0,
      invalidRows: 0,
      missingNames: 0,
      unmatchedNames: 0,
      ambiguousNames: 0,
    });
    const candidates = (await readFile(paths.output, "utf8")).trim().split("\n").map(JSON.parse);
    assert.deepEqual(candidates, [{
      meme_id: "meme-1",
      source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      video_title: "Observed video title",
      note: "spreadsheet_id=1AbCdEfGhIjKlMnOpQrStUvWxYz_123-456; row=VID-00001; source=https://knowyourmeme.com/videos/example; sheet_role=출처에 연결된 밈 사례·원본 관계 미확인; intent=usage_example; origin_verified=false",
    }]);
    assert.deepEqual(Object.keys(candidates[0]), ["meme_id", "source_url", "video_title", "note"]);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test("rejects ambiguous and missing names and deduplicates by meme, platform, and external ID", async () => {
  const duplicate = sheetRow({ 0: "VID-00002", 7: "canonical title" });
  const ambiguous = sheetRow({ 0: "VID-00003", 6: "유튜브 쇼츠", 7: "shared alias", 8: "jrruPm_tU_A", 10: "https://www.youtube.com/shorts/jrruPm_tU_A" });
  const missing = sheetRow({ 0: "VID-00004", 7: "" });
  const unmatched = sheetRow({ 0: "VID-00005", 7: "unknown", 8: "LACbVhgtx9I", 10: "https://www.youtube.com/watch?v=LACbVhgtx9I" });
  const paths = await fixture({
    rows: [sheetRow(), duplicate, ambiguous, missing, unmatched],
    memes: [approved({ aliases: ["full name", "shared alias"] }), approved({ id: "meme-2", title: "Other", aliases: ["shared alias"] })],
  });
  try {
    const counts = await run(paths);
    assert.equal(counts.candidates, 1);
    assert.equal(counts.written, 1);
    assert.equal(counts.duplicates, 1);
    assert.equal(counts.ambiguousNames, 1);
    assert.equal(counts.missingNames, 1);
    assert.equal(counts.unmatchedNames, 1);
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test("rejects blank or invalid rows, including a normalized URL whose ID differs from column I", async () => {
  const mismatchedId = sheetRow({ 0: "VID-00002", 8: "jrruPm_tU_A" });
  const badUrl = sheetRow({ 0: "VID-00003", 6: "틱톡", 8: "6833754937747361025", 10: "http://www.tiktok.com/@creator/video/6833754937747361025" });
  const blankTitle = sheetRow({ 0: "VID-00004", 2: " " });
  const notIncluded = sheetRow({ 0: "VID-00005", 30: "제외" });
  const blankRole = sheetRow({ 0: "VID-00006", 24: "" });
  const badProvenance = sheetRow({ 0: "VID-00007", 12: "not a URL" });
  const mismatchedPlatform = sheetRow({ 0: "VID-00008", 6: "틱톡" });
  const credentialedHttp = sheetRow({ 0: "VID-00009", 10: "http://user@www.youtube.com/watch?v=dQw4w9WgXcQ" });
  const portHttp = sheetRow({ 0: "VID-00010", 10: "http://www.youtube.com:80/watch?v=dQw4w9WgXcQ" });
  const lookalikeHttp = sheetRow({ 0: "VID-00011", 10: "http://youtube.example.com/watch?v=dQw4w9WgXcQ" });
  const paths = await fixture({
    rows: [mismatchedId, badUrl, blankTitle, notIncluded, blankRole, badProvenance, mismatchedPlatform, credentialedHttp, portHttp, lookalikeHttp],
    memes: [approved()],
  });
  try {
    const counts = await run(paths);
    assert.equal(counts.rows, 10);
    assert.equal(counts.invalidRows, 10);
    assert.equal(counts.candidates, 0);
    assert.equal(await readFile(paths.output, "utf8"), "");
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test("dry-run reports counts without creating or changing the output", async () => {
  const paths = await fixture({ rows: [sheetRow()], memes: [approved()] });
  try {
    await writeFile(paths.output, "sentinel\n");
    const counts = await run(paths, ["--dry-run"]);
    assert.equal(counts.candidates, 1);
    assert.equal(counts.written, 0);
    assert.equal(await readFile(paths.output, "utf8"), "sentinel\n");
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test("accepts null aliases and enforces longform, Shorts, TikTok, and Instagram sheet labels", async () => {
  const rows = [
    sheetRow({ 0: "VID-00001", 6: "유튜브 롱폼", 7: "Canonical title" }),
    sheetRow({ 0: "VID-00002", 6: "유튜브 쇼츠", 7: "Short meme", 8: "jrruPm_tU_A", 10: "https://www.youtube.com/shorts/jrruPm_tU_A" }),
    sheetRow({ 0: "VID-00003", 6: "틱톡", 7: "TikTok meme", 8: "6833754937747361025", 10: "https://www.tiktok.com/@creator/video/6833754937747361025" }),
    sheetRow({ 0: "VID-00004", 6: "인스타", 7: "Instagram meme", 8: "DGYAH_wviX0", 10: "https://www.instagram.com/reel/DGYAH_wviX0/" }),
    sheetRow({ 0: "VID-00005", 6: "유튜브 롱폼", 7: "Short meme", 8: "jrruPm_tU_A", 10: "https://www.youtube.com/shorts/jrruPm_tU_A" }),
    sheetRow({ 0: "VID-00006", 6: "유튜브 쇼츠", 7: "Generic YouTube meme", 8: "LACbVhgtx9I", 10: "https://www.youtube.com/watch?v=LACbVhgtx9I" }),
  ];
  const paths = await fixture({
    rows,
    memes: [
      approved({ aliases: null }),
      approved({ id: "meme-2", title: "Short meme", aliases: [] }),
      approved({ id: "meme-3", title: "TikTok meme", aliases: [] }),
      approved({ id: "meme-4", title: "Instagram meme", aliases: [] }),
      approved({ id: "meme-5", title: "Generic YouTube meme", aliases: [] }),
    ],
  });
  try {
    const counts = await run(paths);
    assert.equal(counts.candidates, 5);
    assert.equal(counts.invalidRows, 1);
    const candidates = (await readFile(paths.output, "utf8")).trim().split("\n").map(JSON.parse);
    const genericYouTube = candidates.find((candidate) => candidate.meme_id === "meme-5");
    assert.equal(genericYouTube.source_url, "https://www.youtube.com/watch?v=LACbVhgtx9I");
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test("fails when the snapshot directory has no JSON files", async () => {
  const paths = await fixture({ rows: [], memes: [approved()] });
  try {
    await rm(join(paths.inputDir, "batch.json"));
    await assert.rejects(run(paths), (error) => {
      assert.match(error.stderr, /contains no sheet snapshot JSON files/);
      return true;
    });
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});

test("upgrades exact historical YouTube HTTP hosts without mutating the snapshot", async () => {
  const row = sheetRow({ 10: "http://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3" });
  const paths = await fixture({ rows: [row], memes: [approved()] });
  try {
    const counts = await run(paths);
    assert.equal(counts.candidates, 1);
    const [candidate] = (await readFile(paths.output, "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(candidate.source_url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const snapshot = JSON.parse(await readFile(join(paths.inputDir, "batch.json"), "utf8"));
    assert.equal(snapshot.rows[0][10], "http://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3");
  } finally {
    await rm(paths.root, { recursive: true, force: true });
  }
});
