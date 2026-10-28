import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LOCAL_QA_ORIGIN,
  PRODUCTION_ORIGIN,
  parseArgs,
  sanitizeDiagnostic,
  sanitizeProtectionBypassDiagnostic,
  sanitizeUrl,
  shouldBlockRequest,
  validateDetailResult,
  validateQaOrigin,
  validateReleaseOrigin,
  validateZicoCardResult,
  cancelPendingCommands,
  isCanceledReadInterception,
  protectionBypassHeaders,
  readProtectionBypassToken,
} from "./qa-meme-cards.mjs";

const RELEASE_ORIGIN = "https://memecatch-a1.vercel.app";
const BYPASS_TOKEN = "qa_bypass_token_1234567890";

test("QA origins are restricted to the exact local preview, production, or Memecatch Vercel deployments", () => {
  assert.equal(validateQaOrigin(LOCAL_QA_ORIGIN), LOCAL_QA_ORIGIN);
  assert.equal(validateQaOrigin(PRODUCTION_ORIGIN), PRODUCTION_ORIGIN);
  assert.equal(validateReleaseOrigin("https://memecatch-car8p28rn-ironjustlikethatgmailcoms-projects.vercel.app"), "https://memecatch-car8p28rn-ironjustlikethatgmailcoms-projects.vercel.app");
  for (const unsafe of [
    "http://127.0.0.1:3012.evil.test",
    "http://localhost:3012",
    "https://evil.example",
    "https://vercel.app",
    "https://other-project.vercel.app",
    "https://user:password@memecatch-a.vercel.app",
    "https://memecatch-a.vercel.app/path",
    "http://memecatch-a.vercel.app",
  ]) assert.throws(() => unsafe.includes("vercel.app") ? validateReleaseOrigin(unsafe) : validateQaOrigin(unsafe));
});

test("only Chrome's exact canceled read interception is separated from control failures", () => {
  const canceled = new Error(JSON.stringify({ code: -32602, message: "Invalid InterceptionId." }));
  assert.equal(isCanceledReadInterception("Fetch.continueRequest", canceled), true);
  assert.equal(isCanceledReadInterception("Fetch.failRequest", canceled), false);
  assert.equal(isCanceledReadInterception("Fetch.continueRequest", new Error("timed out")), false);
  assert.equal(isCanceledReadInterception("Fetch.continueRequest", new Error(JSON.stringify({ code: -32602, message: "Permission denied" }))), false);
});

test("browser teardown clears pending interception timers and settles their rejections", async () => {
  let fired = false;
  let rejection;
  const timer = setTimeout(() => { fired = true; }, 0);
  const pending = new Map([[1, { timer, reject: error => { rejection = error; } }]]);
  cancelPendingCommands(pending);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(pending.size, 0);
  assert.equal(fired, false);
  assert.match(rejection.message, /shutting down/);
});

test("targeted QA accepts only the corrected 새삥 copy and actual rendered follow symbols", () => {
  assert.equal(parseArgs(["--card-id", "mc-0012"]).cardId, "mc-0012");
  assert.throws(() => parseArgs(["--card-id", 'mc-0012"]']), /card ID/);
  assert.throws(() => parseArgs(["--card-id"]), /card ID/);
  const corrected = { cardId: "mc-0012", text: "새삥 챌린지 (지코) Mnet 스트릿 맨 파이터 리더 계급 미션곡 ‘새삥’ 안무를 따라 하는 댄스 챌린지", symbols: ["dance-follow", "repeat", "hands"] };
  assert.doesNotThrow(() => validateZicoCardResult(corrected));
  assert.throws(() => validateZicoCardResult({ ...corrected, symbols: ["footsteps", "music-note", "wave"] }), /symbols/);
  assert.throws(() => validateZicoCardResult({ ...corrected, text: "새삥 Freak-y 후렴 팔 동작" }), /copy/);
});

test("CLI keeps Vercel releases explicit and rejects missing values or unknown switches", () => {
  assert.equal(parseArgs([]).origin, LOCAL_QA_ORIGIN);
  assert.equal(parseArgs(["--origin", PRODUCTION_ORIGIN]).origin, PRODUCTION_ORIGIN);
  assert.equal(parseArgs(["--release-origin", "https://memecatch-a1.vercel.app"]).release, true);
  assert.throws(() => parseArgs(["--origin"]), /requires a value|absolute URL/);
  assert.throws(() => parseArgs(["--release-origin", "https://example.vercel.app"]), /memecatch/);
  assert.throws(() => parseArgs(["--browser-profile", "/Users/person/Library/Chrome"]), /Unknown argument/);
});

test("protection bypass files are accepted only for explicit release origins", () => {
  const release = parseArgs(["--release-origin", RELEASE_ORIGIN, "--protection-bypass-file", ".local/vercel-bypass"]);
  assert.equal(release.protectionBypassFile, join(process.cwd(), ".local/vercel-bypass"));
  assert.throws(() => parseArgs(["--protection-bypass-file", ".local/vercel-bypass"]), /release origin/);
  assert.throws(() => parseArgs(["--origin", PRODUCTION_ORIGIN, "--protection-bypass-file", ".local/vercel-bypass"]), /release origin/);
  assert.throws(() => parseArgs(["--release-origin", RELEASE_ORIGIN, "--protection-bypass-file"]), /requires a value/);
});

test("protection bypass token reader accepts only a small regular non-symlink ASCII token file", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "memecatch-bypass-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const valid = join(directory, "valid");
  await writeFile(valid, BYPASS_TOKEN, { mode: 0o600 });
  await chmod(valid, 0o600);
  assert.equal(await readProtectionBypassToken(valid), BYPASS_TOKEN);

  const symlinkPath = join(directory, "link");
  await symlink(valid, symlinkPath);
  await assert.rejects(readProtectionBypassToken(symlinkPath), /regular non-symlink/);
  const oversized = join(directory, "oversized");
  await writeFile(oversized, "a".repeat(257), { mode: 0o600 });
  await assert.rejects(readProtectionBypassToken(oversized), /256 bytes/);
  const invalid = join(directory, "invalid");
  await writeFile(invalid, "too short", { mode: 0o600 });
  await assert.rejects(readProtectionBypassToken(invalid), /ASCII/);
  await assert.rejects(readProtectionBypassToken(directory), /regular non-symlink/);
});

test("protection bypass header is scoped to safe same-release-origin requests", () => {
  const input = {
    release: true,
    releaseOrigin: RELEASE_ORIGIN,
    bypassToken: BYPASS_TOKEN,
    method: "GET",
    requestUrl: `${RELEASE_ORIGIN}/about`,
    requestHeaders: { Accept: "text/html", "x-vercel-protection-bypass": "untrusted" },
  };
  const headers = protectionBypassHeaders(input);
  assert.deepEqual(headers, [
    { name: "Accept", value: "text/html" },
    { name: "x-vercel-protection-bypass", value: BYPASS_TOKEN },
  ]);
  assert.deepEqual(protectionBypassHeaders({ ...input, setBypassCookie: true }), [
    { name: "Accept", value: "text/html" },
    { name: "x-vercel-protection-bypass", value: BYPASS_TOKEN },
    { name: "x-vercel-set-bypass-cookie", value: "true" },
  ]);
  for (const override of [
    { requestUrl: "https://www.youtube.com/embed/example", setBypassCookie: true },
    { requestUrl: "https://stats.g.doubleclick.net/g/collect", setBypassCookie: true },
    { method: "POST" },
    { release: false },
    { releaseOrigin: LOCAL_QA_ORIGIN, requestUrl: `${LOCAL_QA_ORIGIN}/about` },
    { releaseOrigin: "https://example.vercel.app", requestUrl: "https://example.vercel.app/about" },
  ]) {
    assert.equal(protectionBypassHeaders({ ...input, ...override }), undefined);
  }
});

test("staged cookie bootstrap is limited to one same-origin Document before tested navigation", () => {
  const source = readFileSync(new URL("./qa-meme-cards.mjs", import.meta.url), "utf8");
  assert.ok(source.includes('params.resourceType === "Document"'));
  assert.ok(source.includes("protectionBootstrapPending = false"));
  assert.ok(source.includes('currentRoute = "protection-bootstrap"'));
  assert.doesNotMatch(source, /Network\.setExtraHTTPHeaders[^\n]*vercel/i);
  assert.doesNotMatch(source, /Network\.get(?:All)?Cookies|Storage\.getCookies/);
});

test("diagnostics remove queries, credentials, emails, bearer-like tokens, and user home names", () => {
  assert.equal(sanitizeUrl("https://user:pass@example.com/path?token=secret#profile"), "https://example.com/path");
  const clean = sanitizeDiagnostic("alice@example.com https://catchmeme.com/x?email=alice@example.com /Users/alice/private eyJhbGciOiJIUzI1NiJ9.aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb");
  assert.doesNotMatch(clean, /alice|secret|eyJhb/);
  assert.match(clean, /\[redacted-email\]/);
  assert.match(clean, /\/Users\/\[redacted-user\]/);
  const bypassClean = sanitizeProtectionBypassDiagnostic(`request failed for ${BYPASS_TOKEN}`, BYPASS_TOKEN);
  assert.doesNotMatch(bypassClean, new RegExp(BYPASS_TOKEN));
  assert.match(bypassClean, /\[redacted-token\]/);
});

test("all potentially mutating HTTP methods are blocked before transmission", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) assert.equal(shouldBlockRequest(method), false, method);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "CONNECT", "TRACE"]) assert.equal(shouldBlockRequest(method), true, method);
  assert.equal(shouldBlockRequest("post"), true);
});

test("detail validation rejects 404s, foreign origins, redirect aliases, and unrelated error-page copy", () => {
  const valid = {
    status: 200,
    requested: `${LOCAL_QA_ORIGIN}/memes/89b37mrx-old`,
    final: `${LOCAL_QA_ORIGIN}/memes/89b37mrx-old`,
    title: "새삥 챌린지 (지코) | 밈캐치",
    heading: "새삥 챌린지 (지코)",
    chain: [],
  };
  assert.doesNotThrow(() => validateDetailResult(valid, LOCAL_QA_ORIGIN));
  assert.throws(() => validateDetailResult({ ...valid, status: 404 }, LOCAL_QA_ORIGIN), /HTTP 200/);
  assert.throws(() => validateDetailResult({ ...valid, final: "https://evil.example/memes/89b37mrx-old" }, LOCAL_QA_ORIGIN), /origin/);
  assert.throws(() => validateDetailResult({ ...valid, chain: [{ status: 307 }] }, LOCAL_QA_ORIGIN), /redirect/);
  assert.throws(() => validateDetailResult({ ...valid, title: "페이지를 찾을 수 없음", heading: "404" }, LOCAL_QA_ORIGIN), /새삥 챌린지/);
});
