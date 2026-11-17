import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { main, previewSourceCandidates } from "./auto-approve-source-candidates.mjs";

const script = new URL("./auto-approve-source-candidates.mjs", import.meta.url).pathname;
const confirm = "--operator-confirm-auto-approve";
const env = { PATH: process.env.PATH, DATABASE_URL: "postgres://invalid:invalid@127.0.0.1:1/invalid" };

test("daily acquisition remains separate from source approval", () => {
  const daily = readFileSync(new URL("./daily-source-discovery.sh", import.meta.url), "utf8");
  assert.doesNotMatch(daily, /auto-approve-source-candidates/);
  assert.match(daily, /discover-youtube-candidates/);
  assert.match(daily, /verify-youtube-pending/);
});

test("every legacy write invocation fails before connecting, even with confirmation", () => {
  for (const args of [[], [confirm], [confirm, "--limit=1"], [confirm, "--dry-run=false"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env, timeout: 3000 });
    assert.equal(result.status, 2, `args: ${args.join(" ")}, stderr: ${result.stderr}`);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /DATABASE_URL|ECONN|invalid:invalid/);
    assert.match(result.stderr, args.includes(confirm) ? /비활성화/ : /--operator-confirm-auto-approve/);
  }
});

test("dry run still requires the existing explicit confirmation flag", () => {
  const result = spawnSync(process.execPath, [script, "--dry-run"], { encoding: "utf8", env, timeout: 3000 });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--operator-confirm-auto-approve/);
});

test("dry run only reads pending rows and reports title and channel matches as candidates", async () => {
  const row = (id, memeTitle, title, channel, extra = {}) => ({
    meme_id: id, source_id: id,
    memes: { title: memeTitle, aliases: [] },
    media_sources: { platform: "youtube", title, channel_name: channel, embeddable: true, removed_at: null, ...extra },
  });
  const rows = [
    row("title", "밈 이름", "밈 이름 활용", "일반 채널"),
    row("channel", "원본 밈", "다른 제목", "원본 밈 팬 채널"),
    row("not-embeddable", "밈 이름", "밈 이름", "", { embeddable: false }),
    row("removed", "밈 이름", "밈 이름", "", { removed_at: "2026-01-01" }),
    row("no-match", "밈 이름", "다른 제목", ""),
  ];
  const calls = [];
  const rest = async (path, init) => { calls.push({ path, init }); return rows; };
  const result = await previewSourceCandidates(rest, 2000);
  assert.equal(result.dryRun, true);
  assert.equal(result.approved, 2); // Legacy dry-run field: matches, not actual approvals.
  assert.deepEqual(result.byMatch, { title: 1, channel: 1 });
  assert.equal(result.skipped, 3);
  assert.equal(calls.length, 1);
  assert.match(calls[0].path, /^meme_media\?/);
  assert.match(calls[0].path, /review_state=eq\.pending/);
  assert.equal(calls[0].init, undefined);
});

test("dry run limit is retained", async () => {
  const row = { meme_id: "1", source_id: "1", memes: { title: "밈 제목", aliases: [] }, media_sources: { platform: "youtube", title: "밈 제목", channel_name: "", embeddable: true, removed_at: null } };
  const result = await previewSourceCandidates(async () => [row, row], 1);
  assert.equal(result.approved, 1);
});

test("legacy dry-run command uses only the read client and preserves JSON output", async () => {
  const calls = [];
  const output = [];
  const messages = [];
  const row = { meme_id: "1", source_id: "1", memes: { title: "밈 제목", aliases: [] }, media_sources: { platform: "youtube", title: "밈 제목", channel_name: "", embeddable: true, removed_at: null } };
  await main([confirm, "--dry-run", "--limit=1"], {
    restFactory: () => async (path, init) => { calls.push({ path, init }); return [row]; },
    stdout: (value) => output.push(value),
    stderr: (value) => messages.push(value),
  });
  assert.deepEqual(JSON.parse(output[0]), { dryRun: true, approved: 1, skipped: 0, failed: 0, byPlatform: { youtube: 1 }, byMatch: { title: 1 } });
  assert.match(messages[0], /승인 건수가 아닌/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init, undefined);
});
