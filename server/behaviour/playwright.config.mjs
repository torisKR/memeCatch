// The behaviour scenarios: every scenario against the server, at a phone and
// a desktop width (server/behaviour/README.md).
//
//   AXUM_URL=http://127.0.0.1:3001 \
//   DATABASE_URL=<the server's database> BETTER_AUTH_SECRET=<its secret> \
//     node_modules/.bin/playwright test -c server/behaviour/playwright.config.mjs
//
// Add `--project=mobile` or a file name to narrow a run. Reach the server at
// its site origin (NEXT_PUBLIC_SITE_URL), a loopback host on purpose: the
// session cookie of a production server is `__Secure-`, which a browser keeps
// over plain HTTP only there.
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const checkout = createHash("sha256").update(dirname(fileURLToPath(import.meta.url))).digest("hex").slice(0, 12);

const baseURL = process.env.AXUM_URL;
if (!baseURL) throw new Error("AXUM_URL is not set");

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
  projects: Object.entries(sizes).map(([name, device]) => ({ name, use: { ...device, baseURL } })),
});
