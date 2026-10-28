import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ADSENSE_ACCOUNT,
  LOCAL_PUBLISHER_ORIGIN,
  PRODUCTION_PUBLISHER_ORIGIN,
  isAdvertisingUrl,
  isExpectedNoJsScriptFailure,
  isExpectedBlockedAnalytics,
  parsePublisherArgs,
  validateLocalPublisherOrigin,
  validateMemePath,
  validatePublisherOrigin,
  validatePublisherPage,
} from "./qa-publisher-pages.mjs";

test("publisher QA accepts only the exact legacy local relay and canonical production origin", () => {
  assert.equal(validatePublisherOrigin(LOCAL_PUBLISHER_ORIGIN), LOCAL_PUBLISHER_ORIGIN);
  assert.equal(validatePublisherOrigin(PRODUCTION_PUBLISHER_ORIGIN), PRODUCTION_PUBLISHER_ORIGIN);
  for (const origin of ["http://localhost:3012", "https://www.catchmeme.com", "https://catchmeme.com.evil.test", "https://user:secret@catchmeme.com", "https://catchmeme.com/path"]) {
    assert.throws(() => validatePublisherOrigin(origin), /origin/);
  }
});

test("local publisher origin accepts only explicit HTTP loopback ports", () => {
  for (const origin of ["http://localhost:3025", "http://127.0.0.1:3012"]) {
    assert.equal(validateLocalPublisherOrigin(origin), origin);
  }
  for (const origin of [
    "http://localhost",
    "https://localhost:3025",
    "http://0.0.0.0:3025",
    "http://[::1]:3025",
    "http://user:secret@localhost:3025",
    "http://localhost:3025/path",
    "http://localhost:3025/?query=1",
  ]) assert.throws(() => validateLocalPublisherOrigin(origin), /local origin/i, origin);
});

test("canonical meme paths are normalized once without accepting traversal or URL syntax", () => {
  assert.equal(
    validateMemePath("/memes/2au7br9f-%EB%8F%84%EB%A7%88%EB%8F%84%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80"),
    "/memes/2au7br9f-%EB%8F%84%EB%A7%88%EB%8F%84%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80",
  );
  assert.equal(validateMemePath("/memes/89b37mrx-새삥 챌린지 (지코)"), "/memes/89b37mrx-%EC%83%88%EC%82%A5%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%A7%80%EC%BD%94)");
  for (const path of [
    "https://catchmeme.com/memes/2au7br9f-slug",
    "/memes/2au7br9f-slug?preview=1",
    "/memes/2au7br9f-slug#fragment",
    "/memes/../../admin",
    "/memes/2au7br9f-%2Fadmin",
    "/memes/2au7br9f-%252Fadmin",
    "/memes/2au7br9f-%25EC%2583%2588",
    "/en/memes/2au7br9f-slug",
    "/memes/not-a-short-id",
  ]) assert.throws(() => validateMemePath(path), /meme path/i, path);
});

test("CLI rejects missing values, unsafe release identifiers, and unknown switches", () => {
  assert.equal(parsePublisherArgs([]).origin, LOCAL_PUBLISHER_ORIGIN);
  assert.equal(parsePublisherArgs(["--origin", PRODUCTION_PUBLISHER_ORIGIN, "--expected-release", "publisher-abc123"]).expectedRelease, "publisher-abc123");
  assert.throws(() => parsePublisherArgs(["--origin"]), /requires a value|origin/);
  assert.throws(() => parsePublisherArgs(["--expected-release", "secret value with spaces"]), /release/);
  assert.throws(() => parsePublisherArgs(["--browser-profile", "/Users/person/Chrome"]), /Unknown argument/);
});

test("CLI keeps exact --origin behavior and adds explicit local and detail targets", () => {
  const parsed = parsePublisherArgs([
    "--local-origin", "http://127.0.0.1:3025",
    "--meme-path", "/memes/2au7br9f-도마도마-챌린지",
  ]);
  assert.equal(parsed.origin, "http://127.0.0.1:3025");
  assert.equal(parsed.memePath, "/memes/2au7br9f-%EB%8F%84%EB%A7%88%EB%8F%84%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80");
  assert.throws(() => parsePublisherArgs(["--origin", LOCAL_PUBLISHER_ORIGIN, "--local-origin", "http://localhost:3025"]), /origin selector/i);
});

test("CLI accepts only an exact MemeCatch Vercel deployment through --release-origin", () => {
  const releaseOrigin = "https://memecatch-l7hende0j-ironjustlikethatgmailcoms-projects.vercel.app";
  const parsed = parsePublisherArgs(["--release-origin", releaseOrigin, "--expected-release", "publisher-abc123"]);
  assert.equal(parsed.origin, releaseOrigin);
  assert.equal(parsed.release, true);
  assert.equal(parsed.expectedRelease, "publisher-abc123");
  assert.throws(() => parsePublisherArgs(["--origin", releaseOrigin]), /origin/);
  for (const origin of [
    "https://example.vercel.app",
    "https://memecatch-preview.example.com",
    "http://memecatch-preview.vercel.app",
    "https://memecatch-preview.vercel.app/path",
    "https://user:secret@memecatch-preview.vercel.app",
    "https://memecatch-preview.vercel.app.evil.test",
  ]) assert.throws(() => parsePublisherArgs(["--release-origin", origin]), /Release origin/);
});

test("publisher protection bypass file is release-only and keeps expected-release validation", () => {
  const releaseOrigin = "https://memecatch-l7hende0j-ironjustlikethatgmailcoms-projects.vercel.app";
  const parsed = parsePublisherArgs([
    "--release-origin", releaseOrigin,
    "--protection-bypass-file", ".local/vercel-bypass",
    "--expected-release", "publisher-abc123",
  ]);
  assert.equal(parsed.protectionBypassFile, new URL("../.local/vercel-bypass", import.meta.url).pathname);
  assert.equal(parsed.expectedRelease, "publisher-abc123");
  assert.throws(() => parsePublisherArgs(["--protection-bypass-file", ".local/vercel-bypass"]), /release origin/);
  assert.throws(() => parsePublisherArgs(["--origin", PRODUCTION_PUBLISHER_ORIGIN, "--protection-bypass-file", ".local/vercel-bypass"]), /release origin/);
  assert.throws(() => parsePublisherArgs(["--release-origin", releaseOrigin, "--protection-bypass-file"]), /requires a value/);
});

test("known advertising hosts are blocked without overmatching ordinary Google or first-party URLs", () => {
  for (const url of [
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
    "https://googleads.g.doubleclick.net/pagead/ads",
    "https://securepubads.g.doubleclick.net/tag/js/gpt.js",
    "https://www.googleadservices.com/pagead/conversion.js",
    "https://adservice.google.co.kr/adsid/integrator.js",
    "https://ep1.adtrafficquality.google/sodar/sodar.bin",
  ]) assert.equal(isAdvertisingUrl(url), true, url);
  for (const url of ["https://catchmeme.com/explore", "https://www.google.com/", "not a url"]) assert.equal(isAdvertisingUrl(url), false, url);
});

test("only the exact blocked GA collection POST is expected analytics", () => {
  assert.equal(isExpectedBlockedAnalytics("POST", "https://stats.g.doubleclick.net/g/collect?v=2&tid=redacted"), true);
  assert.equal(isExpectedBlockedAnalytics("post", "https://stats.g.doubleclick.net/g/collect"), true);
  for (const [method, url] of [
    ["GET", "https://stats.g.doubleclick.net/g/collect?v=2"],
    ["POST", "https://stats.g.doubleclick.net/g/collect/"],
    ["POST", "https://googleads.g.doubleclick.net/pagead/ads"],
    ["POST", "https://pagead2.googlesyndication.com/pagead/ads"],
    ["POST", "https://stats.g.doubleclick.net.evil.test/g/collect"],
    ["POST", "http://stats.g.doubleclick.net/g/collect"],
    ["POST", "https://user:secret@stats.g.doubleclick.net/g/collect"],
  ]) assert.equal(isExpectedBlockedAnalytics(method, url), false, `${method} ${url}`);
  assert.equal(isAdvertisingUrl("https://stats.g.doubleclick.net/g/collect"), true, "Expected analytics is still blocked as an advertising-host request");
});

test("only empty Script failures from the no-JavaScript phase are expected", () => {
  const route = "/memes/devseed06-never-gonna-give-you-up#no-js";
  assert.equal(isExpectedNoJsScriptFailure(route, { type: "Script", errorText: "" }), true);
  for (const [candidateRoute, params] of [
    ["/memes/devseed06-never-gonna-give-you-up", { type: "Script", errorText: "" }],
    [route, { type: "Document", errorText: "" }],
    [route, { type: "XHR", errorText: "" }],
    [route, { type: "Script", errorText: "net::ERR_FAILED" }],
    [route, { type: "Script" }],
  ]) assert.equal(isExpectedNoJsScriptFailure(candidateRoute, params), false);
});

function base(route) {
  const headings = {
    "/": "지금 궁금한 밈, 한눈에.",
    "/guides/reading-memes": "밈의 원본과 사용 맥락을 확인하는 방법",
    "/about": "밈캐치 소개",
    "/explore": "밈 탐색",
  };
  return {
    route,
    status: 200,
    releaseSha: "publisher-abc123",
    heading: headings[route],
    headingCount: 1,
    metaAccount: ADSENSE_ACCOUNT,
    adScripts: 0,
    overflow: 0,
    guideLink: true,
    sourceQualityCopy: true,
    homeCards: 3,
    homeCardsWithSummary: 3,
    homeEmptyState: false,
    guideDate: true,
    guideExamples: 3,
    guideSourceLinks: 2,
    containsInflatedCount: false,
    exploreCards: 24,
  };
}

test("page contracts require ownership metadata, no ads, no overflow, and the expected release", () => {
  assert.doesNotThrow(() => validatePublisherPage(base("/"), "publisher-abc123"));
  assert.throws(() => validatePublisherPage({ ...base("/"), status: 404 }), /HTTP 200/);
  assert.throws(() => validatePublisherPage({ ...base("/"), metaAccount: null }), /AdSense/);
  assert.throws(() => validatePublisherPage({ ...base("/"), adScripts: 1 }), /advertising/);
  assert.throws(() => validatePublisherPage({ ...base("/"), overflow: 2 }), /overflow/);
  assert.throws(() => validatePublisherPage(base("/"), "different-release"), /release/);
  assert.throws(() => validatePublisherPage({ ...base("/about"), headingCount: 2 }), /single expected h1/);
});

test("home, guide, about, and explore retain their publisher-quality evidence", () => {
  assert.throws(() => validatePublisherPage({ ...base("/"), homeCardsWithSummary: 2 }), /meaningful summary/);
  assert.throws(() => validatePublisherPage({ ...base("/guides/reading-memes"), guideExamples: 2 }), /guide/);
  assert.throws(() => validatePublisherPage({ ...base("/about"), containsInflatedCount: true }), /3,000/);
  assert.throws(() => validatePublisherPage({ ...base("/explore"), exploreCards: 0 }), /public entries/);
});

test("home accepts an honest empty state without inventing recommendation cards", () => {
  assert.doesNotThrow(() => validatePublisherPage({ ...base("/"), homeCards: 0, homeCardsWithSummary: 0, homeEmptyState: true }));
  assert.throws(() => validatePublisherPage({ ...base("/"), homeCards: 0, homeCardsWithSummary: 0, homeEmptyState: false }), /empty state/);
});

function detailBase() {
  return {
    ...base("/memes/2au7br9f-%EB%8F%84%EB%A7%88%EB%8F%84%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80"),
    heading: "도마도마 챌린지",
    summary: "등장인물의 움직임을 따라 하는 챌린지예요.",
    canonicalPath: "/memes/2au7br9f-%EB%8F%84%EB%A7%88%EB%8F%84%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80",
    koreanAlternatePath: "/memes/2au7br9f-%EB%8F%84%EB%A7%88%EB%8F%84%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80",
    defaultAlternatePath: "/memes/2au7br9f-%EB%8F%84%EB%A7%88%EB%8F%84%EB%A7%88-%EC%B1%8C%EB%A6%B0%EC%A7%80",
    storyPresent: true,
    storyOpen: false,
    sourcesPresent: true,
    sourcesOpen: false,
    usageExamplesPresent: true,
    usageExamplesBeforeMedia: true,
    jsonLdParseErrors: 0,
    videoObjects: 1,
    matchedVideoObjects: 1,
  };
}

test("detail contract requires one visible answer and Korean canonical alternates", () => {
  assert.doesNotThrow(() => validatePublisherPage(detailBase()));
  assert.throws(() => validatePublisherPage({ ...detailBase(), summary: "" }), /summary/);
  assert.throws(() => validatePublisherPage({ ...detailBase(), defaultAlternatePath: "/en/memes/2au7br9f-slug" }), /x-default/);
});

test("detail contract keeps optional evidence sections collapsed and examples before media", () => {
  assert.throws(() => validatePublisherPage({ ...detailBase(), storyOpen: true }), /story/i);
  assert.throws(() => validatePublisherPage({ ...detailBase(), sourcesOpen: true }), /source/i);
  assert.throws(() => validatePublisherPage({ ...detailBase(), usageExamplesBeforeMedia: false }), /examples/i);
});

test("every detail VideoObject must parse and match a rendered explanatory iframe", () => {
  assert.throws(() => validatePublisherPage({ ...detailBase(), jsonLdParseErrors: 1 }), /JSON-LD/);
  assert.throws(() => validatePublisherPage({ ...detailBase(), matchedVideoObjects: 0 }), /VideoObject/);
});

test("streamed page waits require the requested Korean route and visible content", () => {
  const source = readFileSync(new URL("./qa-publisher-pages.mjs", import.meta.url), "utf8");
  // CDP returnByValue must never serialize the HTMLElement returned by a
  // selector predicate (React-managed DOM nodes have cyclic internal fields).
  assert.ok(source.includes('evaluate(`Boolean(${expression})`)'));
  assert.ok(source.includes('cdp("Network.setExtraHTTPHeaders", { headers: { "Accept-Language": "ko-KR,ko;q=0.9" } })'));
  assert.ok(source.includes("location.pathname === ${JSON.stringify(route)}"));
  assert.ok(source.includes("document.querySelectorAll('h1')].some(node => node.getClientRects().length > 0)"));
  assert.doesNotMatch(source, /data-interactive-card/);
  assert.ok(source.includes("data-home-recommendations"));
  assert.ok(source.includes("document.querySelectorAll('a[href^=\"/memes/\"]')"));
  assert.ok(source.includes("some(node => node.getClientRects().length > 0)"));
  assert.ok(source.includes("Emulation.setScriptExecutionDisabled"));
  assert.ok(source.includes("Input.dispatchKeyEvent"));
  assert.ok(source.includes("VideoObject"));
  assert.doesNotMatch(source, /Network\.setExtraHTTPHeaders[^\n]*vercel-protection-bypass/i);
  assert.ok(source.includes('params.resourceType === "Document"'));
  assert.ok(source.includes("protectionBootstrapPending = false"));
  assert.ok(source.includes('currentRoute = "protection-bootstrap"'));
  assert.doesNotMatch(source, /Network\.get(?:All)?Cookies|Storage\.getCookies/);
});
