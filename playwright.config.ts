import { defineConfig, devices } from "@playwright/test";

const chrome = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3210",
    locale: "ko-KR",
    launchOptions: { executablePath: chrome },
  },
});
