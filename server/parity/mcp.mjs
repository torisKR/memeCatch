#!/usr/bin/env node
// The ChatGPT connector routes on Next and on Axum (README.md, "MCP"): the
// public MCP server, the OAuth metadata, the operator routes without a state
// key (as production runs them), the GitHub webhook and the retry cron.
//
// Both servers get CRON_SECRET=parity-cron, MCP_EVENT_RETRY_TOKEN=parity-retry,
// MCP_GITHUB_WEBHOOK_SECRET=parity-hook and no MCP_EVENT_STATE_KEY. Their
// requests to catchmeme.com and chatgpt.com go to the stub this script runs
// on 127.0.0.1:3530 (Next through mcp-intercept.mjs, Axum through
// AXUM_TEST_MCP_ORIGIN): /llms-full.txt is relayed from Next's own (the same
// database), /oauth/client.json is what each case sets. Run it on freshly
// started servers: both cache the corpus for five minutes and the client
// metadata for an hour.
//
//   TEST_DB_CONTAINER=<c> node server/parity/mcp.mjs --state=<state.json> <next> <axum>
import { createHmac } from "node:crypto";
import http from "node:http";
import { readFileSync } from "node:fs";

const options = Object.fromEntries(process.argv.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2).split(/=(.*)/s, 2)));
process.argv = process.argv.filter((arg) => !arg.startsWith("--"));
const { compare, compareOnce, expectEqual, nextBase, axumBase, run, send } = await import("./harness.mjs");
const { operator, user } = JSON.parse(readFileSync(options.state, "utf8"));

const CLIENT = "https://chatgpt.com/oauth/client.json";
const REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect";
const mask = (text) => text
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<fetchedAt>")
  .replace(/^header retry-after: \d+$/m, "header retry-after: <n>");
let address = Math.floor(Math.random() * 200);
const fresh = () => `10.66.${Math.floor((address += 1) / 250) % 250}.${address % 250}`;

// ---- the stub --------------------------------------------------------------
// The corpus as each case needs it. "relay" is Next's /llms-full.txt with the
// site origin it was built with replaced by https://catchmeme.com, as
// production serves it (safeMemeUrl keeps only those URLs).
let corpusMode = "relay";
let client = { status: 200, body: JSON.stringify({ client_id: CLIENT, redirect_uris: [REDIRECT], token_endpoint_auth_method: "none" }) };
const seen = [];
const site = async () => (await send(nextBase, { path: "/llms-full.txt" })).body.toString("utf8");
const corpusAnswers = {
  fail: (response) => response.writeHead(500).end("down"),
  redirect: (response) => response.writeHead(302, { location: "/elsewhere" }).end(),
  broken: (response) => { response.writeHead(200, { "content-type": "text/plain", "content-length": "1000" }); response.write("### partial"); setTimeout(() => response.socket.destroy(), 50); },
  huge: (response) => { response.writeHead(200, { "content-type": "text/plain", "content-length": String(6 * 1024 * 1024) }); setTimeout(() => response.socket.destroy(), 50); },
  slow: (response) => setTimeout(() => response.headersSent || response.writeHead(200).end("late"), 13_000),
  raw: async (response) => response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(await site()),
  relay: async (response) => response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end((await site()).replace(/http:\/\/127\.0\.0\.1:\d+/g, "https://catchmeme.com")),
};
const stub = http.createServer(async (request, response) => {
  const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !["host", "connection", "accept-encoding"].includes(name)));
  seen.push(`${request.method} ${request.url} ${JSON.stringify(headers, Object.keys(headers).sort())}`);
  if (request.url === "/llms-full.txt") return corpusAnswers[corpusMode](response);
  if (request.url === "/oauth/client.json") return response.writeHead(client.status, { "content-type": "application/json" }).end(client.body);
  response.writeHead(404).end();
});
await new Promise((resolve) => stub.listen(3530, "127.0.0.1", resolve));

const rpc = (body, headers = {}) => ({
  method: "POST", path: "/api/mcp",
  headers: { "content-type": "application/json", "x-forwarded-for": fresh(), ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": { name: "parity", version: "1" }, "io.modelcontextprotocol/clientCapabilities": {} };
const modern = (method, params = {}, extra = {}) => rpc({ jsonrpc: "2.0", id: 7, method, params: { ...params, _meta: meta } }, { "mcp-protocol-version": "2026-07-28", "mcp-method": method, ...extra });
const call = (name, args, id = 1) => rpc({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });

async function corpusDown() {
  // Failures are not cached: every case loads again. The last one, "relay",
  // is the corpus the other sections read (cached for five minutes).
  for (const mode of ["fail", "redirect", "broken", "huge", "slow", "raw"]) {
    corpusMode = mode;
    seen.length = 0;
    await compareOnce(`mcp: the corpus ${mode}`, call("search_memes", { query: "밈" }), { mask, status: 200 });
    expectEqual(`mcp: the corpus ${mode}: the request of each server`, seen[1], seen[0]);
  }
  corpusMode = "relay";
}

/** Every meme of the corpus through get_meme: its fields byte for byte. */
async function corpus() {
  const text = await site();
  const ids = [...new Set([...text.matchAll(/^- URL: \S+\/memes\/([a-z0-9]{3,36})-/gim)].map((match) => match[1]))];
  expectEqual("corpus: memes in the seeded llms-full.txt", ids.length > 10, true, `${ids.length}`);
  for (const id of ids) await compare(`corpus: get_meme ${id}`, call("get_meme", { id }), { mask, status: 200 });
  for (const query of ["", "중꺾마", "챌린지", "r1", "써도", "ㅋㅋ"]) {
    await compare(`corpus: search "${query}", risky, 12`, call("search_memes", { query, limit: 12, includeRisky: true }), { mask, status: 200 });
  }
}

async function publicServer() {
  await compare("mcp: GET", { method: "GET", path: "/api/mcp" }, { status: 405 });
  await compare("mcp: HEAD", { method: "HEAD", path: "/api/mcp" });
  await compare("mcp: PUT", { method: "PUT", path: "/api/mcp" });
  const cases = [
    ["a foreign origin", rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, { origin: "https://evil.example" }), 403],
    ["the ChatGPT origin", rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, { origin: "https://chatgpt.com" }), 200],
    ["text/plain", rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, { "content-type": "text/plain" }), 415],
    ["APPLICATION/JSON; charset", rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, { "content-type": "APPLICATION/JSON; charset=utf-8" }), 200],
    ["a body over 256 KiB", rpc({ jsonrpc: "2.0", id: 1, method: "ping", pad: "x".repeat(270000) }), 413],
    ["malformed JSON", rpc("{"), 400],
    ["a byte-order mark", rpc("﻿{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}"), 400],
    ["an array", rpc("[]"), 400],
    ["jsonrpc 1.0", rpc({ jsonrpc: "1.0", id: 1, method: "ping" }), 400],
    ["id null", rpc({ jsonrpc: "2.0", id: null, method: "ping" }), 400],
    ["id an object", rpc({ jsonrpc: "2.0", id: { a: 1 }, method: "ping" }), 400],
    ["id 1.5", rpc({ jsonrpc: "2.0", id: 1.5, method: "ping" }), 400],
    ["id a string", rpc({ jsonrpc: "2.0", id: "abc", method: "ping" }), 200],
    ["id 2^53", rpc("{\"jsonrpc\":\"2.0\",\"id\":9007199254740992,\"method\":\"ping\"}"), 400],
    ["no method", rpc({ jsonrpc: "2.0", id: 1 }), 400],
    ["a notification", rpc({ jsonrpc: "2.0", method: "notifications/initialized" }), 202],
    ["initialize", rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "c", version: "1" }, capabilities: {} } }), 200],
    ["initialize, an unknown version", rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999", clientInfo: { name: "c", version: "1" }, capabilities: {} } }), 200],
    ["initialize, a 2026 header", rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "c", version: "1" }, capabilities: {} } }, { "mcp-protocol-version": "2026-07-28" }), 400],
    ["initialize, no capabilities", rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "c", version: "1" } } }), 400],
    ["ping", rpc({ jsonrpc: "2.0", id: 1, method: "ping" }), 200],
    ["tools/list", rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }), 200],
    ["resources/list", rpc({ jsonrpc: "2.0", id: 1, method: "resources/list" }), 200],
    ["resources/read", rpc({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "ui://memecatch/app-v1.html" } }), 200],
    ["resources/read, unknown", rpc({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "ui://x" } }), 200],
    ["events/list", rpc({ jsonrpc: "2.0", id: 1, method: "events/list" }), 404],
    ["an unknown method", rpc({ jsonrpc: "2.0", id: 1, method: "nope" }), 404],
    ["an unknown version header", rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, { "mcp-protocol-version": "2030-01-01" }), 400],
    ["a numeric _meta version", rpc({ jsonrpc: "2.0", id: 1, method: "ping", params: { _meta: { "io.modelcontextprotocol/protocolVersion": 5 } } }), 400],
    ["2026 without the header", rpc({ jsonrpc: "2.0", id: 1, method: "ping", params: { _meta: meta } }), 400],
    ["2026 server/discover", modern("server/discover"), 200],
    ["2026 tools/list", modern("tools/list"), 200],
    ["2026 a mismatched Mcp-Method", modern("tools/list", {}, { "mcp-method": "ping" }), 400],
    ["2026 no client info", rpc({ jsonrpc: "2.0", id: 1, method: "ping", params: { _meta: { ...meta, "io.modelcontextprotocol/clientInfo": undefined } } }, { "mcp-protocol-version": "2026-07-28", "mcp-method": "ping" }), 400],
    ["2026 _meta for another version", rpc({ jsonrpc: "2.0", id: 1, method: "ping", params: { _meta: { ...meta, "io.modelcontextprotocol/protocolVersion": "2025-06-18" } } }, { "mcp-protocol-version": "2026-07-28", "mcp-method": "ping" }), 400],
    ["2026 tools/call, a base64 name", modern("tools/call", { name: "search_memes", arguments: { query: "댄스" } }, { "mcp-name": `=?base64?${Buffer.from("search_memes").toString("base64")}?=` }), 200],
    ["2026 tools/call, no Mcp-Name", modern("tools/call", { name: "search_memes", arguments: {} }), 400],
    ["2026 events/list", modern("events/list"), 404],
  ];
  for (const [label, request, status] of cases) await compare(`mcp: ${label}`, request, { mask, status });
}

async function tools() {
  const cases = [
    ["search", call("search_memes", { query: "댄스" })],
    ["search, all", call("search_memes", {})],
    ["search, limit 1", call("search_memes", { query: "밈", limit: 1 })],
    ["search, limit 12, risky", call("search_memes", { query: "밈", limit: 12, includeRisky: true })],
    ["search, limit 2.0", call("search_memes", { query: "밈", limit: 2.0 })],
    ["search, limit 13", call("search_memes", { query: "밈", limit: 13 })],
    ["search, limit null", call("search_memes", { query: "밈", limit: null })],
    ["search, 161 characters", call("search_memes", { query: "가".repeat(161) })],
    ["search, a number", call("search_memes", { query: 5 })],
    ["search, punctuation only", call("search_memes", { query: "!!!" })],
    ["search, nothing found", call("search_memes", { query: "없는검색어입니다" })],
    ["search, spaced and wide", call("search_memes", { query: "  ＤＡＮＣＥ 댄스  " })],
    ["open_memecatch", call("open_memecatch", { query: "챌린지" })],
    ["get_meme", call("get_meme", { id: "r1aaaa02" })],
    ["get_meme, unknown", call("get_meme", { id: "zzzz" })],
    ["get_meme, invalid", call("get_meme", { id: "a-b" })],
    ["get_meme, no id", call("get_meme", {})],
    ["an unknown tool", call("nope", {})],
    ["arguments an array", call("search_memes", [])],
    ["arguments null", call("search_memes", null)],
    ["an unknown argument", call("get_meme", { id: "r1aaaa02", x: 1 })],
  ];
  for (const [label, request] of cases) await compare(`mcp: ${label}`, request, { mask, status: 200 });
  const found = await compare("mcp: search finds memes", call("search_memes", { query: "중꺾마" }), { mask, status: 200 });
  const memes = found && JSON.parse(found.body).result?.structuredContent?.memes;
  expectEqual("mcp: the search answer has memes", Array.isArray(memes) && memes.length > 0, true);
}

async function limit() {
  const ip = fresh();
  const at = (n) => {
    const request = call("nope", {}, n);
    return { ...request, headers: { ...request.headers, "x-forwarded-for": ip } };
  };
  for (let index = 1; index <= 120; index += 1) await compareOnce(`mcp: tools/call ${index} of an address`, at(index), { mask, status: 200 });
  await compareOnce("mcp: the 121st tools/call", at(121), { mask, status: 429 });
  await compareOnce("mcp: other methods are not limited", { ...rpc({ jsonrpc: "2.0", id: 1, method: "ping" }), headers: { "content-type": "application/json", "x-forwarded-for": ip } }, { status: 200 });
}

async function metadata() {
  for (const path of ["/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource/api/mcp-operator"]) {
    await compare(`metadata: ${path}`, { path }, { status: 200 });
    await compare(`metadata: HEAD ${path}`, { method: "HEAD", path });
    await compare(`metadata: POST ${path}`, { method: "POST", path });
    await compare(`metadata: www host ${path}`, { path, headers: { host: "www.catchmeme.com" } });
  }
}

async function operatorRoutes() {
  await compare("operator: GET", { path: "/api/mcp-operator" }, { status: 401 });
  await compare("operator: PUT", { method: "PUT", path: "/api/mcp-operator" });
  await compare("operator: HEAD", { method: "HEAD", path: "/api/mcp-operator" }, { status: 401 });
  for (const [label, origin, status] of [["no origin", null, 200], ["ChatGPT", "https://chatgpt.com", 200], ["the site", "https://catchmeme.com", 200], ["a foreign origin", "https://evil.example", 403]]) {
    const headers = { "content-type": "application/json", authorization: "Bearer x", ...(origin ? { origin } : {}) };
    await compare(`operator: POST, ${label}`, { method: "POST", path: "/api/mcp-operator", headers, body: "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"events/list\"}" }, { status });
  }
  await compare("operator: POST, no body", { method: "POST", path: "/api/mcp-operator" }, { status: 200 });
  for (const [label, headers, body] of [["a code exchange", { "content-type": "application/x-www-form-urlencoded" }, "grant_type=authorization_code&code=x"], ["JSON", { "content-type": "application/json" }, "{}"], ["nothing", {}, undefined]]) {
    await compare(`token: ${label}`, { method: "POST", path: "/api/mcp-operator/oauth/token", headers, body }, { status: 503 });
  }
  await compare("token: GET", { path: "/api/mcp-operator/oauth/token" });
}

const authorizeQuery = (extra = {}) => `/api/mcp-operator/oauth/authorize?${new URLSearchParams({ client_id: CLIENT, redirect_uri: REDIRECT, resource: "https://catchmeme.com/api/mcp-operator", response_type: "code", scope: "memecatch:monitor", code_challenge: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ", code_challenge_method: "S256", state: "s<&>\"'", ...extra })}`;

async function authorize() {
  const get = (path, cookie) => ({ path, headers: cookie ? { cookie } : {} });
  await compare("authorize: an invalid request", get(authorizeQuery({ scope: "x" })), { status: 400 });
  await compare("authorize: a repeated parameter", get(`${authorizeQuery()}&state=t`), { status: 400 });
  // The client metadata is cached once valid: the failures first.
  for (const [label, reply, status] of [
    ["metadata 404", { status: 404, body: "{}" }, 400],
    ["metadata not JSON", { status: 200, body: "nope" }, 503],
    ["metadata over 16 KiB", { status: 200, body: JSON.stringify({ pad: "x".repeat(17000) }) }, 400],
    ["metadata without the redirect", { status: 200, body: JSON.stringify({ client_id: CLIENT, redirect_uris: ["x"], token_endpoint_auth_method: "none" }) }, 400],
    ["metadata null", { status: 200, body: "null" }, 503],
  ]) {
    client = reply;
    seen.length = 0;
    await compareOnce(`authorize: ${label}`, get(authorizeQuery()), { status });
    expectEqual(`authorize: ${label}: the metadata request`, seen[1], seen[0]);
  }
  client = { status: 200, body: JSON.stringify({ client_id: CLIENT, redirect_uris: [REDIRECT], token_endpoint_auth_methods_supported: ["none"] }) };
  await compare("authorize: signed out", get(authorizeQuery()), { status: 401 });
  await compare("authorize: signed out, a path with escapes", get(`${authorizeQuery()}&x=%E2%9C%93`), { status: 401 });
  await compare("authorize: not an operator", get(authorizeQuery(), user.cookie), { status: 401 });
  await compare("authorize: an operator", get(authorizeQuery(), operator.cookie), { status: 503 });
  const post = (headers, body) => ({ method: "POST", path: "/api/mcp-operator/oauth/authorize", headers, body });
  const form = { "content-type": "application/x-www-form-urlencoded" };
  await compare("authorize POST: no origin", post({ ...form, cookie: operator.cookie }, "ticket=x&decision=allow"), { status: 403 });
  await compare("authorize POST: signed out", post({ ...form, origin: "https://catchmeme.com" }, "ticket=x"), { status: 401 });
  await compare("authorize POST: not a form", post({ origin: "https://catchmeme.com", cookie: operator.cookie, "content-type": "application/json" }, "{}"), { status: 400 });
  await compare("authorize POST: a repeated field", post({ ...form, origin: "https://catchmeme.com", cookie: operator.cookie }, "ticket=a&ticket=b"), { status: 400 });
  await compare("authorize POST: over 16 KiB", post({ ...form, origin: "https://catchmeme.com", cookie: operator.cookie }, `ticket=${"x".repeat(17000)}`), { status: 503 });
  await compare("authorize POST: allow", post({ ...form, origin: "https://catchmeme.com", cookie: operator.cookie }, "ticket=x&decision=allow"), { status: 503 });
  await compare("authorize: PUT", { method: "PUT", path: "/api/mcp-operator/oauth/authorize" });
  await compare("authorize: HEAD, signed out", { method: "HEAD", path: authorizeQuery() }, { status: 401 });
}

const sign = (body) => `sha256=${createHmac("sha256", "parity-hook").update(body).digest("hex")}`;
const hook = (event, body, signature = sign(body)) => ({
  method: "POST", path: "/api/mcp-operator/github",
  headers: { "content-type": "application/json", "x-github-event": event, "x-github-delivery": "parity-delivery-1", ...(signature ? { "x-hub-signature-256": signature } : {}) },
  body,
});

async function github() {
  const repo = { repository: { full_name: "torisKR/memeCatch" } };
  const push = JSON.stringify({ ...repo, ref: "refs/heads/main", after: "a".repeat(40) });
  const cases = [
    ["no signature", hook("push", push, null), 401],
    ["a wrong signature", hook("push", push, sign("other")), 401],
    ["an upper-case signature", hook("push", push, sign(push).toUpperCase()), 401],
    ["not JSON", hook("push", "{"), 400],
    ["a byte-order mark", hook("push", `﻿${push}`), 400],
    ["an array", hook("push", "[]"), 400],
    ["another repository", hook("push", JSON.stringify({ repository: { full_name: "x/y" }, ref: "refs/heads/main" })), 400],
    ["an event it ignores", hook("star", JSON.stringify(repo)), 202],
    ["a push to another branch", hook("push", JSON.stringify({ ...repo, ref: "refs/heads/dev" })), 202],
    ["a deleted main", hook("push", JSON.stringify({ ...repo, ref: "refs/heads/main", deleted: true })), 202],
    ["a push with a bad commit", hook("push", JSON.stringify({ ...repo, ref: "refs/heads/main", after: "xyz" })), 400],
    ["a push to main", hook("push", push), 503],
    ["a failed run", hook("workflow_run", JSON.stringify({ ...repo, action: "completed", workflow_run: { conclusion: "failure", id: 5, html_url: "https://github.com/torisKR/memeCatch/actions/runs/5" } })), 503],
    ["a failed run, a foreign URL", hook("workflow_run", JSON.stringify({ ...repo, action: "completed", workflow_run: { conclusion: "failure", id: 5, html_url: "https://example.com/x" } })), 400],
    ["a passing run", hook("workflow_run", JSON.stringify({ ...repo, action: "completed", workflow_run: { conclusion: "success" } })), 202],
    ["an issue opened", hook("issues", JSON.stringify({ ...repo, action: "opened", issue: { number: 3, html_url: "https://github.com/torisKR/memeCatch/issues/3" } })), 503],
    ["an issue, number 0", hook("issues", JSON.stringify({ ...repo, action: "closed", issue: { number: 0, html_url: "https://github.com/torisKR/memeCatch/issues/3" } })), 400],
    ["a body over 2 MiB", hook("push", JSON.stringify({ pad: "x".repeat(2_200_000) })), 413],
  ];
  for (const [label, request, status] of cases) await compare(`github: ${label}`, request, { status });
  await compare("github: GET", { path: "/api/mcp-operator/github" });
}

async function cron() {
  for (const [label, value, status] of [["no header", null, 401], ["a wrong token", "Bearer nope", 401], ["CRON_SECRET", "Bearer parity-cron", 503], ["the retry token", "Bearer parity-retry", 503], ["no Bearer", "parity-cron", 401], ["two spaces", "Bearer  parity-cron", 401]]) {
    await compare(`cron: ${label}`, { path: "/api/cron/mcp-events", headers: value ? { authorization: value } : {} }, { status });
  }
  await compare("cron: POST", { method: "POST", path: "/api/cron/mcp-events" });
  await compare("cron: HEAD", { method: "HEAD", path: "/api/cron/mcp-events", headers: { authorization: "Bearer parity-cron" } }, { status: 503 });
}

try {
  await run({ corpusDown, corpus, publicServer, tools, limit, metadata, operatorRoutes, authorize, github, cron });
} finally {
  stub.close();
}
