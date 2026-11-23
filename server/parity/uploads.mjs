#!/usr/bin/env node
// POST /api/upload and POST /api/mpe/uploads on Next and on Axum, the R2
// requests the TypeScript and the Rust send for an upload, and an MPE job
// created through Axum and worked by scripts/mpe-media-worker.mjs. See
// README.md in this directory.
//
//   TEST_DB_CONTAINER=<container> NEXT_OBJECT_DIR=<dir> DATABASE_URL=<url> \
//     node --experimental-strip-types --import ./scripts/register-ts-paths.mjs \
//     server/parity/uploads.mjs <next-base-url> <axum-base-url> [section...]
//
// Next runs on <next-base-url> with LOCAL_OBJECT_STORAGE_DIR=<dir> and no
// R2_* value, on Node 22 as in the Next image (undici 6 parses the forms),
// built with NEXT_PUBLIC_SITE_URL=<next-base-url>. This script starts the
// rest: a Versity S3 Gateway container (memecatch-axum-parity-s3-<pid>), a
// recording proxy in front of it, and Axum on <axum-base-url>'s port through
// `cargo test --test uploads serve_for_parity -- --ignored`, with R2 at the
// proxy. Nothing here contacts Cloudflare. DATABASE_URL is the test database
// as the app's role, for Axum and the worker.
//
// Every case signs in a user of its own (a better-auth user and session row,
// and the cookie the secret signs), so the per-minute limits of one case
// never reach another. Next stores in its directory, Axum in the gateway.
import { execFileSync, spawn } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { axumBase, compareOnce, expectEqual, fail, nextBase, pass, psql, run, send } from "./harness.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SECRET = process.env.BETTER_AUTH_SECRET ?? "test-only-auth-secret-0123456789abcdef";
const { NEXT_OBJECT_DIR, DATABASE_URL } = process.env;
if (!NEXT_OBJECT_DIR || !DATABASE_URL) {
  console.error("NEXT_OBJECT_DIR and DATABASE_URL must be set");
  process.exit(2);
}
const SITE = new URL(nextBase).origin;
const BUCKET = "memecatch-parity";
const BOUNDARY = "----axumparityboundary";
const LIMIT = 20 * 1024 * 1024 + 128 * 1024;
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00", "latin1");
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]), Buffer.from("webm")]);
const MP4 = execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=64x64:d=1", "-c:v", "libx264",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart+frag_keyframe", "-f", "mp4", "pipe:1"]);
const RIGHTS = ["rightsDeclaration", null, '{"accepted":true}'];

// ---- users, forms, requests ----

/** A better-auth user with a session, as tests/common/session.rs makes one. */
function signIn() {
  const [userId, token] = psql(`
    with u as (insert into public."user" (name, email, "emailVerified") values ('axum parity', 'axum-parity-' || gen_random_uuid() || '@example.com', true) returning id, email),
    a as (insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) select id, email, now(), jsonb_build_object('nickname', 'ap' || substr(replace(id::text, '-', ''), 1, 12)) from u returning id),
    s as (insert into public.session (token, "expiresAt", "updatedAt", "userId") select replace(gen_random_uuid()::text, '-', ''), now() + interval '7 days', now(), id from a returning token, "userId")
    select "userId" || ' ' || token from s;`).split(" ");
  const signature = createHmac("sha256", SECRET).update(token).digest("base64");
  return { userId, cookie: `__Secure-better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}` };
}

/** A multipart body from `[name, [filename, type] or null, content]`. */
function form(...parts) {
  const chunks = [];
  for (const [name, file, content] of parts) {
    const disposition = file
      ? `Content-Disposition: form-data; name="${name}"; filename="${file[0]}"\r\nContent-Type: ${file[1]}\r\n`
      : `Content-Disposition: form-data; name="${name}"\r\n`;
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n${disposition}\r\n`), Buffer.from(content), Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

const FORM = { "content-type": `multipart/form-data; boundary=${BOUNDARY}` };
const post = (user, body, headers = {}, extra = {}) => ({
  method: "POST",
  headers: { origin: SITE, ...(user ? { cookie: user.cookie } : {}), ...FORM, ...headers },
  body,
  ...extra,
});
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g;
// Object names and ids are random; each server counts its own minute.
const mask = (text) => text.replace(UUID, "<uuid>").replace(/^header retry-after: \d+$/m, "header retry-after: <1-60>");

/** One case for each route: a user of its own, the same request to each server. */
async function both(label, route, build, options = {}) {
  const user = signIn();
  const answers = await compareOnce(label, { path: route, ...build(user) }, { mask, ...options });
  return { user, ...answers };
}

// ---- the gateway, the recording proxy and Axum ----

const recorded = [];
const rules = { failPut: new Set(), dropDelete: new Set(), recordObjects: false };
let gateway;
let axum;

const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();

async function waitFor(port) {
  for (let attempt = 0; attempt < 2400; attempt += 1) {
    const open = await new Promise((resolve) => {
      const socket = net.connect(port, "127.0.0.1", () => resolve(socket.end() || true));
      socket.on("error", () => resolve(false));
    });
    if (open) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`nothing listens on ${port}`);
}

async function startGateway() {
  const keys = { access: `access${randomBytes(8).toString("hex")}`, secret: `secret${randomBytes(16).toString("hex")}` };
  const name = `memecatch-axum-parity-s3-${process.pid}`;
  docker("run", "-d", "--name", name, "-p", "127.0.0.1::7070", "-e", `ROOT_ACCESS_KEY=${keys.access}`,
    "-e", `ROOT_SECRET_KEY=${keys.secret}`, "-e", "VGW_REGION=auto", "--entrypoint", "sh", "versity/versitygw:v1.11.0",
    "-c", `mkdir -p /data/${BUCKET} && exec versitygw --port :7070 posix /data`);
  gateway = { name, port: Number(docker("port", name, "7070/tcp").split("\n")[0].split(":").pop()), keys };
  await waitFor(gateway.port);
}

/** The key of a proxied object path, `/<bucket>/<key>`, decoded. */
const keyOf = (url) => decodeURIComponent(new URL(url, "http://x").pathname.slice(BUCKET.length + 2));

function forward(request, body, response, key) {
  const upstream = http.request(
    { host: "127.0.0.1", port: gateway.port, method: request.method, path: request.url, headers: request.headers },
    (answer) => {
      const parts = [];
      answer.on("data", (chunk) => parts.push(chunk));
      answer.on("end", () => {
        recorded.at(-1).status = answer.statusCode;
        const [bucket, ...name] = key.split("/");
        if (rules.recordObjects && request.method === "PUT" && answer.statusCode === 200 && bucket === "mpe-temporary") {
          // What Supabase storage did and nothing does now: the row
          // create_media_ingestion looks for (see the worker section).
          psql(`insert into storage.objects (bucket_id, name) values ('mpe-temporary', '${name.join("/")}')`);
        }
        response.writeHead(answer.statusCode, answer.headers).end(Buffer.concat(parts));
      });
    },
  );
  upstream.on("error", () => response.writeHead(502).end());
  upstream.end(body);
}

/** Forwards to the gateway with the Host header as it was signed, and records. */
function startProxy() {
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      const key = keyOf(request.url);
      recorded.push({ method: request.method, url: request.url, key, headers: request.headers, body });
      const user = key.split("/")[1];
      if (request.method === "PUT" && rules.failPut.has(user)) return response.writeHead(500).end("injected");
      if (request.method === "DELETE" && rules.dropDelete.has(user)) return request.socket.destroy();
      forward(request, body, response, key);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** The `uploads` test binary, built if it is not. */
function testBinary() {
  const output = execFileSync("cargo", ["test", "--quiet", "--test", "uploads", "--no-run", "--message-format=json"], {
    cwd: path.join(ROOT, "server"), encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  const built = output.split("\n").filter(Boolean).map((line) => JSON.parse(line))
    .find((message) => message.reason === "compiler-artifact" && message.target?.name === "uploads" && message.executable);
  return built.executable;
}

async function startAxum(proxyPort) {
  const port = new URL(axumBase).port;
  axum = spawn(testBinary(), ["serve_for_parity", "--ignored", "--exact", "--nocapture"], {
    cwd: path.join(ROOT, "server"),
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      PARITY_PORT: port,
      PARITY_R2_ENDPOINT: `http://127.0.0.1:${proxyPort}`,
      R2_ACCOUNT_ID: "parity-account",
      R2_ACCESS_KEY_ID: gateway.keys.access,
      R2_SECRET_ACCESS_KEY: gateway.keys.secret,
      R2_BUCKET: BUCKET,
      UPSTREAM_URL: nextBase,
      NEXT_PUBLIC_SITE_URL: nextBase,
      BETTER_AUTH_SECRET: SECRET,
      NODE_ENV: "production",
      RELEASE_SHA: "local",
    },
  });
  await waitFor(Number(port));
}

// ---- what each server stored ----

/** Next's objects in `<bucket>/<user>/`. */
function nextObjects(bucket, user) {
  const dir = path.join(NEXT_OBJECT_DIR, bucket, user);
  return existsSync(dir) ? readdirSync(dir) : [];
}

/** What Axum put and did not delete afterwards in `<bucket>/<user>/`. */
function axumObjects(bucket, user) {
  const live = new Set();
  for (const { method, key, status } of recorded) {
    if (!key.startsWith(`${bucket}/${user}/`)) continue;
    if (method === "PUT" && status === 200) live.add(key);
    if (method === "DELETE") live.delete(key);
  }
  return [...live];
}

/** The objects each server holds for the case's user, compared. */
function storedLike(label, bucket, nextUser, axumUser, count) {
  const counts = `next ${nextObjects(bucket, nextUser).length}, axum ${axumObjects(bucket, axumUser).length}`;
  expectEqual(`${label}: objects kept`, counts, `next ${count}, axum ${count}`);
}

// ---- sections ----

const big = (size) => Buffer.alloc(size, 0x61);
const declaredOver = (user) => post(user, big(LIMIT + 1));
const streamedOver = (user) => post(user, big(LIMIT + 1), {}, { chunked: true });

async function uploadChecks() {
  const route = "/api/upload";
  const cases = [
    ["signed out", () => post(null, form(["file", ["a.png", "image/png"], PNG])), 401],
    ["no origin", (user) => ({ ...post(user, ""), headers: { cookie: user.cookie, ...FORM } }), 403],
    ["same-origin fetch, signed out", () => ({ method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: "" }), 401],
    ["an origin only Next judges", (user) => post(user, "", { origin: "http://localhost:3000" }), 403],
    ["no form", (user) => post(user, "{}", { "content-type": "application/json" }), 400],
    ["no file", (user) => post(user, form(["x", null, "1"])), 400],
    ["a text field named file", (user) => post(user, form(["file", null, "x"])), 400],
    ["a type not listed", (user) => post(user, form(["file", ["a.bmp", "image/bmp"], PNG])), 400],
    ["a type with a parameter", (user) => post(user, form(["file", ["a.png", "image/png; x=1"], PNG])), 400],
    ["gif bytes declared png", (user) => post(user, form(["file", ["a.png", "image/png"], GIF])), 400],
    ["an image over 5 MiB", (user) => post(user, form(["file", ["a.png", "image/png"], Buffer.concat([PNG, big(5 * 1024 * 1024)])])), 400],
    ["an empty file", (user) => post(user, form(["file", ["a.png", "image/png"], ""])), 400],
    ["declared one byte over the limit", declaredOver, 413],
    ["chunked one byte over the limit", streamedOver, 413],
    ["exactly the limit, no form", (user) => post(user, big(LIMIT)), 400],
    // undici 6 refuses a form with text after its closing boundary.
    ["a form with an epilogue", (user) => post(user, Buffer.concat([form(["file", ["a.png", "image/png"], PNG]), Buffer.from("x")])), 400],
  ];
  for (const [label, build, status] of cases) await both(`upload: ${label}`, route, build, { status });
  for (const [label, name, type, bytes] of [
    ["a png", "a.png", "image/png", PNG],
    ["a png declared in upper case", "a.png", "IMAGE/PNG", PNG],
    ["a gif", "a.gif", "image/gif", GIF],
    ["a webm video", "a.webm", "video/webm", WEBM],
    ["an mp4 video", "a.mp4", "video/mp4", MP4],
  ]) {
    const { user } = await both(`upload: ${label}`, route, (u) => post(u, form(["file", [name, type], bytes])), { status: 200 });
    storedLike(`upload: ${label}`, "meme-uploads", user.userId, user.userId, 1);
  }
  await both("upload: GET", route, (user) => ({ method: "GET", headers: { cookie: user.cookie } }), { status: 405 });
}

async function mpeChecks() {
  const route = "/api/mpe/uploads";
  const png = ["file", ["a.png", "image/png"], PNG];
  const cases = [
    ["signed out", () => post(null, form(png, RIGHTS)), 401],
    ["no origin", (user) => ({ ...post(user, ""), headers: { cookie: user.cookie, ...FORM } }), 403],
    ["no form", (user) => post(user, ""), 400],
    ["no file", (user) => post(user, form(RIGHTS)), 400],
    ["no rights", (user) => post(user, form(png)), 400],
    ["rights not accepted", (user) => post(user, form(png, ["rightsDeclaration", null, '{"accepted":"true"}'])), 400],
    ["rights that are not JSON", (user) => post(user, form(png, ["rightsDeclaration", null, "{"])), 400],
    ["rights as a file", (user) => post(user, form(png, ["rightsDeclaration", ["r.json", "application/json"], '{"accepted":true}'])), 400],
    ["a source", (user) => post(user, form(png, RIGHTS, ["sourceId", null, ""])), 400],
    ["a declared type that is not the bytes", (user) => post(user, form(["file", ["a.png", "image/gif"], PNG], RIGHTS)), 400],
    ["octet-stream is allowed, bytes unknown", (user) => post(user, form(["file", ["a.bin", "application/octet-stream"], "hello"], RIGHTS)), 400],
    ["an empty file", (user) => post(user, form(["file", ["a.png", "image/png"], ""], RIGHTS)), 400],
    ["declared one byte over the limit", declaredOver, 413],
    ["chunked one byte over the limit", streamedOver, 413],
  ];
  for (const [label, build, status] of cases) await both(`mpe: ${label}`, route, build, { status });
  for (const [label, file] of [["an mp4", ["file", ["a.mp4", "video/mp4"], MP4]], ["a png declared octet-stream", ["file", ["a.png", "application/octet-stream"], PNG]]]) {
    // create_media_ingestion finds no storage.objects row: 500 on both, and
    // both remove the object they stored.
    const { user } = await both(`mpe: ${label}, ingestion fails`, route, (u) => post(u, form(RIGHTS, file)), { status: 500 });
    storedLike(`mpe: ${label}`, "mpe-temporary", user.userId, user.userId, 0);
    const puts = recorded.filter((entry) => entry.key.startsWith(`mpe-temporary/${user.userId}/`)).map((entry) => entry.method);
    expectEqual(`mpe: ${label}: Axum put then deleted`, puts.join(" "), "PUT DELETE");
  }
}

/** A request each server gets from a user of its own, `count` times; the last answers compared. */
async function repeated(label, route, build, count, status) {
  const [forNext, forAxum] = [signIn(), signIn()];
  for (let index = 1; index < count; index += 1) {
    await compareOnce(`${label} (${index})`, { path: route, ...build(forNext) }, { mask, requestForAxum: { path: route, ...build(forAxum) } });
  }
  await compareOnce(label, { path: route, ...build(forNext) }, { mask, status, requestForAxum: { path: route, ...build(forAxum) } });
}

async function limits() {
  await repeated("upload: the 11th in a minute (memory)", "/api/upload", (user) => post(user, ""), 11, 429);
  await repeated("mpe: the 6th in a minute (memory)", "/api/mpe/uploads", (user) => post(user, ""), 6, 429);
  const minute = (user, action) =>
    psql(`insert into public.api_rate_limits (user_id, action, window_start, request_count) select '${user.userId}', '${action}', date_trunc('minute', now()) + n * interval '1 minute', 100 from generate_series(0, 2) n`);
  await both("upload: the database limit", "/api/upload", (user) => (minute(user, "upload"), post(user, form(["file", ["a.png", "image/png"], PNG]))), { status: 429 });
  await both("mpe: the database limit", "/api/mpe/uploads", (user) => (minute(user, "mpe_upload_storage"), post(user, "")), { status: 429 });
  const full = (user) => psql(`insert into public.community_upload_storage_quota (scope, reserved_bytes, reserved_objects) values ('user:${user.userId}', 0, 500)`);
  await both("upload: the storage quota is used up", "/api/upload", (user) => (full(user), post(user, form(["file", ["a.png", "image/png"], PNG]))), { status: 429 });
  // A database that cannot answer the call: 503 on both.
  psql("revoke execute on function public.reserve_api_request(text) from authenticated");
  try {
    await both("upload: reserve_api_request fails", "/api/upload", (user) => post(user, ""), { status: 503 });
    await both("mpe: reserve_api_request fails", "/api/mpe/uploads", (user) => post(user, ""), { status: 503 });
  } finally {
    psql("grant execute on function public.reserve_api_request(text) to authenticated");
  }
  psql("revoke execute on function public.reserve_community_upload_storage(uuid, bigint) from service_role");
  try {
    await both("upload: the storage quota cannot be read", "/api/upload", (user) => post(user, form(["file", ["a.png", "image/png"], PNG])), { status: 503 });
  } finally {
    psql("grant execute on function public.reserve_community_upload_storage(uuid, bigint) to service_role");
  }
}

async function storeFailures() {
  // Next cannot make the user's folder (a file is in its way); the gateway
  // proxy answers 500 to Axum's PUT.
  for (const [label, route, bucket, parts] of [
    ["upload", "/api/upload", "meme-uploads", [["file", ["a.png", "image/png"], PNG]]],
    ["mpe", "/api/mpe/uploads", "mpe-temporary", [RIGHTS, ["file", ["a.png", "image/png"], PNG]]],
  ]) {
    const user = signIn();
    mkdirSync(path.join(NEXT_OBJECT_DIR, bucket), { recursive: true });
    writeFileSync(path.join(NEXT_OBJECT_DIR, bucket, user.userId), "in the way");
    rules.failPut.add(user.userId);
    await compareOnce(`${label}: the object cannot be stored`, { path: route, ...post(user, form(...parts)) }, { mask, status: 502 });
  }
  // Axum only: the DELETE after a failed ingestion breaks off. Next's
  // directory cannot be made to refuse a removal, so this is not compared.
  const user = signIn();
  rules.dropDelete.add(user.userId);
  const answer = await send(axumBase, { path: "/api/mpe/uploads", ...post(user, form(RIGHTS, ["file", ["a.png", "image/png"], PNG])) });
  expectEqual("mpe: cleanup fails (Axum only)", `${answer.status} ${answer.body}`, '500 {"ok":false,"error":"ingestion_failed_cleanup_failed"}');
  const audit = psql(`select action || ' ' || entity_type || ' ' || (entity_id like '${user.userId}/%') || ' ' || detail::text from public.admin_audit_log where actor_id = '${user.userId}'`);
  expectEqual("mpe: cleanup fails: audit row", audit, 'mpe_upload_orphan_cleanup_failed storage_object true {"bucket": "mpe-temporary"}');
}

/** Raw bytes on one connection: what comes back until the server closes it. */
function rawExchange(base, bytes) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = net.connect(Number(port), hostname, () => socket.end(bytes));
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
    socket.on("error", reject);
  });
}

async function shortContentLength() {
  // A whole valid form, of which the head declares only the first 64 bytes.
  // Each server reads 64 bytes, finds no form, stores nothing and takes the
  // rest for a next request on the connection, which does not parse. Node
  // answers that at once and closes, so Next's client never gets the route's
  // answer; hyper answers the route first. See PLAN.md (differences).
  const summary = async (base) => {
    const user = signIn();
    const body = form(["file", ["a.png", "image/png"], PNG]);
    const head = `POST /api/upload HTTP/1.1\r\nHost: ${new URL(nextBase).host}\r\nOrigin: ${SITE}\r\nCookie: ${user.cookie}\r\n` +
      `Content-Type: ${FORM["content-type"]}\r\nContent-Length: 64\r\n\r\n`;
    const text = await rawExchange(base, Buffer.concat([Buffer.from(head), body]));
    await new Promise((resolve) => setTimeout(resolve, 500));
    const answers = [...text.matchAll(/HTTP\/1\.1 (\d{3})[^\r]*\r\n/g)].map((match) => match[1]);
    const metered = psql(`select coalesce(sum(request_count), 0) from public.api_rate_limits where user_id = '${user.userId}' and action = 'upload'`);
    const stored = base === nextBase ? nextObjects("meme-uploads", user.userId).length : axumObjects("meme-uploads", user.userId).length;
    return { line: `first answer ${answers[0]}; metered ${metered}; stored ${stored}`, all: answers.join(" then ") };
  };
  const [next, rust] = [await summary(nextBase), await summary(axumBase)];
  expectEqual("upload: Content-Length smaller than the body", rust.line, next.line, `answers: next ${next.all}, axum ${rust.all}`);
}

// The R2 PUT of each side for the same upload. The TypeScript runs here,
// with fetch caught and sent on to the proxy with the headers aws4fetch
// signed (undici adds a few unsigned ones of its own on the real wire).
async function r2Requests() {
  Object.assign(process.env, { R2_ACCOUNT_ID: "parity-account", R2_ACCESS_KEY_ID: gateway.keys.access,
    R2_SECRET_ACCESS_KEY: gateway.keys.secret, R2_BUCKET: BUCKET, OBJECT_SIGNING_SECRET: SECRET });
  const proxyPort = recorded.proxyPort;
  globalThis.fetch = async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    const url = new URL(request.url);
    const body = Buffer.from(await request.arrayBuffer());
    const headers = Object.fromEntries(request.headers);
    const status = await new Promise((resolve, reject) => {
      const sent = http.request({ host: "127.0.0.1", port: proxyPort, method: request.method, path: url.pathname + url.search,
        headers: { ...headers, host: url.host, "content-length": body.length } }, (answer) => { answer.resume(); answer.on("end", () => resolve(answer.statusCode)); });
      sent.on("error", reject);
      sent.end(body);
    });
    return new Response(null, { status });
  };
  const { r2Put } = await import(path.join(ROOT, "lib/r2.server.ts"));
  const { objectStorage } = await import(path.join(ROOT, "lib/object-storage.ts"));
  const tsUser = signIn().userId;
  const name = `${tsUser}/${crypto.randomUUID()}`;
  await r2Put(`meme-uploads/${name}.png`, PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length), "image/png");
  await objectStorage().from("mpe-temporary").upload(name, PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.length), { contentType: "image/png", upsert: false });

  const shape = (entry) => {
    const auth = entry.headers.authorization ?? "";
    const signed = auth.match(/SignedHeaders=([^,]+)/)?.[1];
    const scope = auth.match(/Credential=[^/]+\/(\d{8})\/([^,]+)/);
    return [
      `${entry.method} /${BUCKET}/${entry.key.replace(UUID, "<uuid>")} -> ${entry.status}`,
      `algorithm ${auth.split(" ")[0]}; scope <date>/${scope?.[2]}; date matches x-amz-date ${scope?.[1] === entry.headers["x-amz-date"]?.slice(0, 8)}`,
      `signed headers ${signed}`,
      `content-type ${entry.headers["content-type"]}; x-amz-content-sha256 ${entry.headers["x-amz-content-sha256"]}`,
      `body ${entry.body.length} bytes sha256 ${createHash("sha256").update(entry.body).digest("hex").slice(0, 16)}`,
    ].join("\n").replace(new RegExp(tsUser, "g"), "<user>");
  };
  const axumUser = signIn();
  await compareOnce("r2: an upload for the comparison", { path: "/api/upload", ...post(axumUser, form(["file", ["a.png", "image/png"], PNG])) }, { mask, status: 200 });
  const mpeUser = signIn();
  rules.recordObjects = true;
  const forR2 = await send(axumBase, { path: "/api/mpe/uploads", ...post(mpeUser, form(RIGHTS, ["file", ["a.png", "image/png"], PNG])) });
  expectEqual("r2: an mpe upload through Axum for the comparison", forR2.status, 201);
  rules.recordObjects = false;
  const find = (bucket, user) => recorded.find((entry) => entry.method === "PUT" && entry.key.startsWith(`${bucket}/${user}/`));
  for (const [bucket, rustUser] of [["meme-uploads", axumUser.userId], ["mpe-temporary", mpeUser.userId]]) {
    const ts = find(bucket, tsUser);
    const rust = find(bucket, rustUser);
    if (!ts || !rust) {
      fail(`r2: ${bucket} PUT`, `typescript ${Boolean(ts)}, rust ${Boolean(rust)}`);
      continue;
    }
    expectEqual(`r2: ${bucket} PUT`, shape(rust).replace(new RegExp(rustUser, "g"), "<user>"), shape(ts));
    console.log(shape(ts).replace(/^/gm, "      both: "));
    console.log(`      typescript sent headers: ${Object.keys(ts.headers).sort().join(", ")}`);
    console.log(`      rust sent headers:       ${Object.keys(rust.headers).sort().join(", ")}`);
  }
}

// An ingestion created through Axum, worked by the real worker script. The
// proxy writes the storage.objects row create_media_ingestion requires (no
// code writes it today), and the worker reads the object Axum stored from a
// copy of the gateway's file in a directory of its own.
async function worker() {
  const user = signIn();
  rules.recordObjects = true;
  const request = { path: "/api/mpe/uploads", ...post(user, form(RIGHTS, ["file", ["a.mp4", "video/mp4"], MP4])) };
  const created = await send(axumBase, request);
  // Next, whose objects are on its own disk, still finds no row.
  const refused = await send(nextBase, { ...request, headers: { ...request.headers, cookie: signIn().cookie } });
  expectEqual("worker: the same upload to Next", `${refused.status} ${refused.body}`, '500 {"ok":false,"error":"ingestion_failed"}');
  rules.recordObjects = false;
  const body = JSON.parse(created.body.toString("utf8"));
  expectEqual("worker: Axum answer", `${created.status} ${created.headers["cache-control"]} ${body.ok} ${body.data?.status} ${body.data?.jobIds?.length}`, "201 no-store true queued 1");
  const ingestion = body.data.ingestionId;
  const row = psql(`select mime_type || ' ' || media_kind || ' ' || byte_size || ' ' || sha256 || ' ' || (temporary_storage_key like '${user.userId}/%') || ' ' || (expires_at between now() + interval '23 hours' and now() + interval '24 hours') from public.media_ingestions where id = '${ingestion}'`);
  expectEqual("worker: the ingestion row", row, `video/mp4 video ${MP4.length} ${createHash("sha256").update(MP4).digest("hex")} true true`);
  const key = psql(`select temporary_storage_key from public.media_ingestions where id = '${ingestion}'`);
  const dir = mkdtempSync(path.join(tmpdir(), "mpe-worker-objects-"));
  mkdirSync(path.join(dir, "mpe-temporary", user.userId), { recursive: true });
  docker("cp", `${gateway.name}:/data/${BUCKET}/mpe-temporary/${key}`, path.join(dir, "mpe-temporary", key));
  // Leave only this ingestion's job queued. The worker's maintenance may
  // queue cleanup jobs for other (expired) test ingestions as it starts, so
  // it runs with --drain: every queued job, then this one is checked.
  psql(`update public.processing_jobs set status = 'skipped' where status = 'queued' and ingestion_id <> '${ingestion}'`);
  const node = process.env.WORKER_NODE ?? process.execPath;
  // The worker reads .env files from its working directory: it runs in an empty one.
  execFileSync(node, ["--experimental-strip-types", "--import", path.join(ROOT, "scripts/register-ts-paths.mjs"), path.join(ROOT, "scripts/mpe-media-worker.mjs"), "--drain"], {
    cwd: dir, stdio: "inherit", env: { PATH: process.env.PATH, DATABASE_URL, LOCAL_OBJECT_STORAGE_DIR: dir, MPE_FFPROBE_TIMEOUT_MS: "30000" },
  });
  const job = psql(`select job_type || ' ' || status || ' ' || attempts || ' ' || coalesce(error_code, '-') || ' ' || coalesce(output_json->>'formatName', '-') || ' ' || coalesce(output_json->>'width', '-') from public.processing_jobs where ingestion_id = '${ingestion}' order by created_at limit 1`);
  console.log(`      the job after the worker ran: ${job}`);
  if (job.startsWith("inspect completed")) pass("worker: the job Axum queued was worked", job);
  else fail("worker: the job Axum queued was worked", job);
}

// run() exits the process: stop what this script started on the way out.
process.on("exit", () => {
  axum?.kill("SIGTERM");
  if (gateway) docker("rm", "-f", "-v", gateway.name);
});
process.on("SIGINT", () => process.exit(130));
await startGateway();
const proxy = await startProxy();
recorded.proxyPort = proxy.address().port;
await startAxum(recorded.proxyPort);
await run({ uploadChecks, mpeChecks, limits, storeFailures, shortContentLength, r2Requests, worker });
