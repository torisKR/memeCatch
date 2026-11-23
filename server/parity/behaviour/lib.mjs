// What the behaviour scenarios share. A scenario is written once and run
// against Next and against Axum (playwright.config.mjs); it passes when both
// servers pass the same assertions. Assert what a user can observe: the URL,
// visible text, focus, aria state, cookies, storage and the requests a step
// causes. Do not assert on class names or on markup structure.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as base } from "@playwright/test";

export { expect };

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

/** The seeded memes of ../pages/seed.sql the scenarios open. */
export const MEME = {
  path: "/memes/pgrich01-parity-rich",
  id: "00000000-0000-4000-8000-000000000001",
  title: "패리티 리치",
};

// Requests that are how a server delivers a page, not what a step asks for.
const NOT_BEHAVIOUR = [
  /^\/_next\//, // Next's bundles, images and data
  /^\/_axum\//, // Axum's stylesheet, scripts and frame fragments
  /\.(png|gif|jpe?g|webp|svg|ico|css|js|woff2?|webmanifest)$/,
  /^\/sw\.js$/,
];

function shapeOf(value) {
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shapeOf(item)]));
  }
  return value === null ? "null" : typeof value;
}

function describeRequest(request, origin) {
  const url = new URL(request.url());
  if (url.origin !== origin || request.isNavigationRequest()) return null;
  const headers = request.headers();
  // Next's client router: React payloads and prefetches for the same paths.
  if (headers.rsc || url.searchParams.has("_rsc")) return null;
  if (NOT_BEHAVIOUR.some((pattern) => pattern.test(url.pathname))) return null;
  let body = null;
  try {
    body = request.postDataJSON();
  } catch {
    body = request.postData();
  }
  return {
    method: request.method(),
    // A server action is a POST to the page with this header. Its Axum
    // counterpart is a named endpoint; scenarios accept either by name.
    path: headers["next-action"] ? "<server action>" : url.pathname,
    body,
    shape: body && typeof body === "object" ? shapeOf(body) : body === null ? null : "text",
  };
}

/** The same-origin requests `action` causes, as `{ method, path, body, shape }`. */
export async function requestsDuring(page, action, { settle = 600 } = {}) {
  const origin = new URL(base.info().project.use.baseURL).origin;
  const seen = [];
  const listener = (request) => {
    const entry = describeRequest(request, origin);
    if (entry) seen.push(entry);
  };
  page.context().on("request", listener);
  try {
    await action();
    await page.waitForTimeout(settle);
  } finally {
    page.context().off("request", listener);
  }
  return seen;
}

/** Opens `path` and waits until the page's scripts have run. */
export async function open(page, path) {
  await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
}

/** What has focus, as a user of assistive technology would hear it. */
export function focused(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return "(nothing)";
    const label = element.getAttribute("aria-label")
      || (element.labels && element.labels[0]?.textContent)
      || element.textContent
      || element.getAttribute("name")
      || "";
    return `${element.getAttribute("role") || element.localName}: ${label.replace(/\s+/g, " ").trim()}`;
  });
}

/**
 * The focus ring of the focused element, as drawn: `"<outline style>
 * <outline width>"` while it matches :focus-visible, `"none"` otherwise.
 */
export function focusRing(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || !element.matches(":focus-visible")) return "none";
    const style = getComputedStyle(element);
    return style.outlineStyle === "none" ? "none" : `${style.outlineStyle} ${style.outlineWidth}`;
  });
}

export const localStorageItem = (page, key) => page.evaluate((name) => localStorage.getItem(name), key);
export const sessionStorageItem = (page, key) => page.evaluate((name) => sessionStorage.getItem(name), key);

/**
 * SQL as the superuser of the test database container (TEST_DB_CONTAINER, as
 * ../harness.mjs uses it), for a scenario that must make the database fail.
 */
export function databaseSql(sql) {
  const container = process.env.TEST_DB_CONTAINER ?? "memecatch-axum-test-pg";
  const result = spawnSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "memecatch", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-At"],
    { input: sql, encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr.slice(-600)}`);
  return result.stdout.trim();
}

export const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;

export async function cookieValue(page, name) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === name)?.value ?? null;
}

/**
 * A new user with a session, made by the app's own better-auth (session.mjs)
 * on the database both servers use. Needs DATABASE_URL and BETTER_AUTH_SECRET
 * as the servers have them.
 */
function mintSession(role) {
  const result = spawnSync(
    process.execPath,
    ["--import", resolve(root, "scripts/register-ts-paths.mjs"), resolve(here, "session.mjs"), role],
    { cwd: root, encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } },
  );
  if (result.status !== 0) throw new Error(`session.mjs failed: ${result.stderr.slice(-600)}`);
  return JSON.parse(result.stdout.trim().split("\n").pop());
}

export const test = base.extend({
  // A beacon's body is opaque to the driver. With sendBeacon reporting
  // failure the page uses its fetch fallback (lib/analytics.ts), which
  // carries the same JSON and can be read.
  context: async ({ context }, provide) => {
    await context.addInitScript(() => {
      navigator.sendBeacon = () => false;
    });
    await provide(context);
  },
  /** `"next"` or `"axum"`: the server this project drives. */
  server: [async ({}, provide, testInfo) => provide(testInfo.project.metadata.server), { scope: "test" }],
  /** `signIn("user" | "operator")` puts a fresh session cookie in the context. */
  signIn: async ({ context, baseURL }, provide) => {
    await provide(async (role = "user") => {
      const session = mintSession(role);
      // By domain, not by URL: the cookie is `Secure` (a production build
      // names it `__Secure-`) and the servers speak plain HTTP on loopback.
      await context.addCookies([{
        name: session.cookieName,
        value: decodeURIComponent(session.cookieValue),
        domain: new URL(baseURL).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      }]);
      return session;
    });
  },
});

export const mobileOnly = (isMobile) => test.skip(!isMobile, "a phone-width behaviour");
export const desktopOnly = (isMobile) => test.skip(isMobile, "a desktop-width behaviour");
