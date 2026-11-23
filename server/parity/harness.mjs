// Shared by cards-quiz.mjs and tracking.mjs: sends one request to a server,
// describes the answer as text, compares Next with Axum, and runs SQL in the
// test database container. See README.md in this directory.
import { execFileSync } from "node:child_process";
import http from "node:http";

// Not compared. README.md gives the reason for each.
const IGNORED_HEADERS = new Set(["date", "connection", "keep-alive", "transfer-encoding", "x-nextjs-cache"]);

const [nextBase, axumBase, ...selected] = process.argv.slice(2);
if (!nextBase || !axumBase) {
  console.error("usage: <script> <next-base-url> <axum-base-url> [section...]");
  process.exit(2);
}
export { nextBase, axumBase };
export const container = process.env.TEST_DB_CONTAINER ?? "memecatch-axum-test-pg";

// Both servers get the Host header of the Next base URL, as in parity.mjs.
const hostHeader = new URL(nextBase).host;

/** `request`: { method, path, headers, body (string or Buffer), chunked }. */
export function send(base, { method = "GET", path, headers = {}, body, chunked = false }) {
  const { hostname, port } = new URL(base);
  const payload = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  const length = payload && !chunked ? { "content-length": payload.length } : {};
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname,
        port,
        path, // sent as written, never normalized
        method,
        headers: { host: hostHeader, accept: "*/*", "user-agent": "memecatch-parity", ...headers, ...length },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, headers: response.headersDistinct, body: Buffer.concat(chunks) }),
        );
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    // `end(payload)` alone would make Node declare the length. Writing first
    // sends the head without one, so the body goes out chunked.
    if (payload && chunked) request.write(payload);
    request.end(payload && !chunked ? payload : undefined);
  });
}

/** Status, body and every compared header as sorted lines of text. */
export function describe(response, mask = (text) => text) {
  const lines = [`status: ${response.status}`, `body: ${mask(response.body.toString("utf8"))}`];
  for (const [name, values] of Object.entries(response.headers)) {
    if (!IGNORED_HEADERS.has(name)) lines.push(`header ${name}: ${mask(values.join("\n"))}`);
  }
  return lines.sort().join("\n");
}

let failed = 0;
let passed = 0;
const indent = (text) => text.replace(/^/gm, "      ");

export function pass(label, note = "") {
  passed += 1;
  console.log(`ok    ${label}${note ? `  ${note}` : ""}`);
}

export function fail(label, detail) {
  failed += 1;
  console.log(`DIFF  ${label}\n${indent(detail)}`);
}

/** Fails unless `actual === expected`; both are printed when they differ. */
export function expectEqual(label, actual, expected, note = "") {
  if (actual === expected) pass(label, note);
  else fail(label, `expected:\n${indent(String(expected))}\nactual:\n${indent(String(actual))}`);
}

const brief = (response) => {
  const text = response.body.toString("utf8");
  return `${response.status} ${text.length > 70 ? `${text.slice(0, 70)}…` : text}`;
};

/**
 * Next, Axum, Next again: for requests that change nothing. A field that
 * differs between the two answers of Next is not deterministic and is not
 * compared (as in parity.mjs); `mask` hides what may legitimately differ.
 */
export async function compare(label, request, { mask, status } = {}) {
  const first = await send(nextBase, request);
  const viaAxum = await send(axumBase, request);
  const second = await send(nextBase, request);
  const [a, b, c] = [first, viaAxum, second].map((response) => describe(response, mask));
  if (a !== c) return fail(label, `Next answered differently twice:\n${a}\n--\n${c}`);
  if (a !== b) return fail(label, `next:\n${indent(a)}\naxum:\n${indent(b)}`);
  if (status !== undefined && first.status !== status) {
    return fail(label, `both answered ${first.status}, the case expects ${status}`);
  }
  pass(label, brief(first));
  return first;
}

/**
 * One request to each server, in the order given: for requests that write.
 * Returns both answers. `order` is "next-first" or "axum-first".
 */
export async function compareOnce(label, request, { mask, status, order = "next-first", requestForAxum } = {}) {
  const forAxum = requestForAxum ?? request;
  let next;
  let axum;
  if (order === "next-first") {
    next = await send(nextBase, request);
    axum = await send(axumBase, forAxum);
  } else {
    axum = await send(axumBase, forAxum);
    next = await send(nextBase, request);
  }
  const [a, b] = [describe(next, mask), describe(axum, mask)];
  if (a !== b) fail(label, `next:\n${indent(a)}\naxum:\n${indent(b)}`);
  else if (status !== undefined && next.status !== status) {
    fail(label, `both answered ${next.status}, the case expects ${status}`);
  } else pass(label, brief(next));
  return { next, axum };
}

/** Runs SQL as the superuser of the throwaway database; returns its output. */
export function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "memecatch", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-At"],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

export const sqlText = (value) => (value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`);

/** Runs the named sections (all when none is named) and exits 1 on a difference. */
export async function run(sections) {
  const names = selected.length ? selected : Object.keys(sections);
  for (const name of names) {
    if (!sections[name]) {
      console.error(`no section ${name}; the sections are: ${Object.keys(sections).join(", ")}`);
      process.exit(2);
    }
    console.log(`\n== ${name}`);
    await sections[name]();
  }
  console.log(`\n${passed} checks passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
