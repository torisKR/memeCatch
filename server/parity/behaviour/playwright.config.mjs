// The behaviour gate: every scenario against Next and against Axum, at a
// phone and a desktop width (server/parity/README.md, "Browser behaviour gate").
//
//   NEXT_URL=http://localhost:3002 AXUM_URL=http://127.0.0.1:3001 \
//   DATABASE_URL=<the database both servers use> BETTER_AUTH_SECRET=<their secret> \
//     node_modules/.bin/playwright test -c server/parity/behaviour/playwright.config.mjs
//
// Add `--project=axum-mobile` or a file name to narrow a run. Next must be
// reached at an origin it trusts (`http://localhost:<its port>`), and Axum at
// the site origin the Next build was given, with Next behind it: the APIs the
// frame calls are Next's and refuse a request from another origin. Both are
// loopback hosts on purpose: the session cookie of a production build is
// `__Secure-`, which a browser keeps over plain HTTP only there.
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const checkout = createHash("sha256").update(dirname(fileURLToPath(import.meta.url))).digest("hex").slice(0, 12);

const servers = { next: process.env.NEXT_URL, axum: process.env.AXUM_URL };
for (const [name, url] of Object.entries(servers)) {
  if (!url) throw new Error(`${name === "next" ? "NEXT_URL" : "AXUM_URL"} is not set`);
}

const sizes = {
  mobile: { ...devices["Pixel 7"] },
  desktop: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
};

export default defineConfig({
  testDir: "scenarios",
  // One folder per checkout: Playwright empties it at the start of a run,
  // and runs from other worktrees on the same machine must not empty ours.
  outputDir: join(tmpdir(), `memecatch-behaviour-results-${checkout}`),
  // Scenarios share one database (saved memes, sessions): one at a time.
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: { locale: "ko-KR", timezoneId: "Asia/Seoul", trace: "off" },
  projects: Object.entries(servers).flatMap(([server, baseURL]) =>
    Object.entries(sizes).map(([size, device]) => ({
      name: `${server}-${size}`,
      metadata: { server },
      use: { ...device, baseURL },
    })),
  ),
});
