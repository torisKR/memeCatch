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
