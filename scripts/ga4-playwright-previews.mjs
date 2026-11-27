// Capture the real Maud views with stubbed Data API responses and embedded CSS.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const tabs = ["overview", "acquisition", "behaviour", "dropoff", "realtime"];
const origin = "http://127.0.0.1:43173";
const directory = await mkdtemp(join(tmpdir(), "memecatch-ga4-preview-"));
const artifacts = fileURLToPath(new URL("../artifacts/ga4-advanced/", import.meta.url));
const assetsDir = fileURLToPath(new URL("../server/assets/", import.meta.url));

async function verifyTracking(browser) {
  const page = await browser.newPage({ locale: "ko-KR", serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.previewCopyAttempts = [];
    window.previewShares = [];
    window.previewRejectClipboard = true;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      async writeText(text) {
        window.previewCopyAttempts.push(text);
        if (window.previewRejectClipboard) throw new Error("Clipboard rejected");
      },
    } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/memes/fixture1-example" || url.pathname === "/quiz") {
      const filename = url.pathname === "/quiz" ? "quiz.html" : "meme.html";
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: await readFile(join(directory, filename)) });
    }
    if (/^\/_axum\/(site|quiz)\.[a-f0-9]+\.(js|css)$/.test(url.pathname)) {
      const [, name, extension] = url.pathname.match(/\/(site|quiz)\.[a-f0-9]+\.(js|css)$/);
      const filename = name === "quiz" ? "pages/quiz.js" : `site.${extension}`;
      return route.fulfill({ contentType: extension === "css" ? "text/css" : "text/javascript", body: await readFile(join(assetsDir, filename)) });
    }
    if (url.pathname === "/api/quiz") {
      return route.fulfill({ json: { questions: [{
        question: "테스트 문제", options: ["정답", "오답", "보기 3", "보기 4"],
        answerIndex: 0,
        meme: { shortId: "fixture1", slug: "example", title: "예시 밈", originYear: 2024 },
      }] } });
    }
    return route.fulfill({ status: 204 });
  });
  const events = () => page.evaluate(() => window.dataLayer
    .map((entry) => Array.from(entry))
    .filter(([command]) => command === "event")
    .map(([, name, params]) => ({ name, params })));
  await page.goto(`${origin}/memes/fixture1-example`);
  assert.ok((await events()).some(({ name }) => name === "meme_view"));
  const copy = page.getByRole("button", { name: "밈 명칭 및 요약 복사" });
  await copy.click();
  await page.waitForFunction(() => window.previewCopyAttempts.length === 1);
  assert.equal((await events()).filter(({ name }) => name === "copy").length, 0);
  await page.evaluate(() => { window.previewRejectClipboard = false; });
  await copy.click();
  await page.locator("button[data-copy][data-copied]").waitFor();
  const copies = (await events()).filter(({ name }) => name === "copy");
  assert.deepEqual(copies, [{ name: "copy", params: {
    meme_id: "00000000-0000-4000-8000-000000000001", method: "clipboard",
  } }]);
  assert.equal(await page.evaluate(() => window.previewCopyAttempts[1]), "예시 캡션");

  const share = page.getByRole("button", { name: "공유", exact: true });
  await share.click();
  await page.waitForFunction(() => window.previewCopyAttempts.length === 3);
  assert.equal(await page.evaluate(() => window.previewCopyAttempts[2]),
    `${origin}/memes/fixture1-example?utm_source=share&utm_medium=link`);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: async ({ url }) => {
      window.previewShares.push(url);
    } });
  });
  await share.click();
  await page.waitForFunction(() => window.previewShares.length === 1);
  assert.deepEqual((await events()).filter(({ name }) => name === "share_click").map(({ params }) => params.method),
    ["link", "native"]);

  await page.goto(`${origin}/quiz`);
  await page.locator('[data-quiz-mode="all"]').click();
  await page.getByRole("button", { name: /정답/ }).click();
  await page.getByRole("button", { name: "결과 보기" }).click();
  const quizEvents = (await events()).filter(({ name }) => ["quiz_start", "quiz_complete"].includes(name));
  assert.deepEqual(quizEvents, [
    { name: "quiz_start", params: { mode: "all" } },
    { name: "quiz_complete", params: { mode: "all", score: 1, item_count: 1, state: "general" } },
  ]);
  assert.deepEqual(errors, []);
  await page.close();
  console.log("Verified dataLayer copy, share_click (link and native), quiz_start and quiz_complete");
}

let browser;
try {
  const cargo = spawnSync("cargo", [
    "test", "--lib", "pages::admin::ga4::tests::export_ga4_playwright_previews",
    "--", "--exact", "--ignored",
  ], {
    cwd: fileURLToPath(new URL("../server/", import.meta.url)),
    env: { ...process.env, CARGO_INCREMENTAL: "0", GA4_ADVANCED_PREVIEW_DIR: directory },
    stdio: "inherit",
  });
  if (cargo.status !== 0) throw new Error("Failed to render the Rust fixtures");
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch();
  await verifyTracking(browser);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, locale: "ko-KR", serviceWorkers: "block" });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/site.css") {
        return route.fulfill({ contentType: "text/css", body: await readFile(join(directory, "site.css")) });
      }
      if (url.pathname === "/admin/analytics") {
        const tab = url.searchParams.get("tab") ?? "overview";
        if (tabs.includes(tab)) return route.fulfill({ contentType: "text/html; charset=utf-8", body: await readFile(join(directory, `${tab}.html`)) });
      }
      return route.fulfill({ status: 404 });
    });
    await page.goto(`${origin}/admin/analytics`);
    for (const tab of tabs) {
      const href = `/admin/analytics?tab=${tab}&range=28d`;
      const nav = page.getByRole("navigation", { name: "GA4 리포트 메뉴" });
      await nav.locator(`a[href="${href}"]`).click();
      await page.waitForURL(`**${href}`);
      assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), href);
      const charts = page.getByRole("main").locator('svg[role="img"]');
      const tables = page.getByRole("main").locator("details.ga4-details");
      assert.ok(await charts.count() > 0, `${tab} renders charts`);
      assert.equal(await tables.count(), await charts.count(), `${tab} has a data table per chart`);
      for (const chart of await charts.all()) {
        assert.ok(await chart.getAttribute("aria-label"), `${tab} has chart names`);
        assert.equal(await chart.locator(":scope > title").count(), 1, `${tab} has SVG titles`);
      }
      const firstTable = tables.first();
      await firstTable.locator("summary").click();
      assert.ok(await firstTable.locator("table").isVisible(), `${tab} data tables open`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `${tab} has no horizontal page overflow`);
      await firstTable.locator("summary").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      const path = join(artifacts, `analytics-${tab}-${width}x${height}.png`);
      await page.screenshot({ path });
      console.log(path);
    }
    await page.close();
  }
} finally {
  await browser?.close();
  await rm(directory, { recursive: true, force: true });
}
