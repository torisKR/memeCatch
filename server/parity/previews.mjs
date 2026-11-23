#!/usr/bin/env node
// POST /api/explore/previews: sends the same requests to Next and to Axum and
// compares status, headers and body. parity.mjs sends no request body, so
// this route has its own script. See README.md in this directory.
//
//   node server/parity/previews.mjs <next-base-url> <axum-base-url>
//
// Seed the database first (tests/fixtures/r1_reviewer.sql, r1_seed.sql and
// previews_seed.sql). Each run uses fresh client addresses (X-Forwarded-For),
// so the 120-per-minute limit of an earlier run does not carry over; the
// 1,200-per-minute limit for all clients does, so leave a minute between runs.
import http from "node:http";

const [nextBase, axumBase] = process.argv.slice(2);
if (!nextBase || !axumBase) {
  console.error("usage: previews.mjs <next-base-url> <axum-base-url>");
  process.exit(2);
}

const IGNORED_HEADERS = new Set(["date", "connection", "keep-alive", "transfer-encoding", "x-nextjs-cache"]);
const next = new URL(nextBase);
const run = Date.now() % 250;
const ip = (n) => `198.51.${run}.${n}`;
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

function post(base, { headers = {}, body = "", chunked = false }) {
  const { hostname, port } = new URL(base);
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname,
        port,
        path: "/api/explore/previews",
        method: "POST",
        headers: { host: next.host, "user-agent": "memecatch-parity", ...headers, ...(chunked ? {} : { "content-length": payload.length }) },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const fields = [`status: ${response.statusCode}`, `body: ${Buffer.concat(chunks).toString("utf8")}`];
          for (const [name, values] of Object.entries(response.headersDistinct)) {
            if (!IGNORED_HEADERS.has(name)) fields.push(`${name}: ${values.join("\n")}`);
          }
          resolve(fields.sort().join("\n"));
        });
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end(payload);
  });
}

const preview = (n) => `a3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seeded = Array.from({ length: 15 }, (_, index) => preview(index + 1));
const ids = (list) => JSON.stringify({ ids: list });
const from = (n, headers = SAME_ORIGIN) => ({ "content-type": "application/json", "x-forwarded-for": ip(n), ...headers });
// Next's own request URL: its protocol, "localhost" and its port.
const ownOrigin = `http://localhost:${next.port}`;

const cases = [
  // What is shown for each seeded meme, and the order of the answer.
  ["every seeded case", { headers: from(1), body: ids(seeded) }],
  ["the same ids in reverse", { headers: from(1), body: ids([...seeded].reverse()) }],
  ["one id", { headers: from(1), body: ids([preview(1)]) }],
  ["an id given twice and in upper case", { headers: from(1), body: ids([preview(1), preview(1), preview(14).toUpperCase(), preview(4)]) }],
  ["ids no meme has", { headers: from(1), body: ids(["00000000-0000-4000-8000-000000000000"]) }],
  ["a pending meme and a rejected one", { headers: from(1), body: ids([preview(12), "a1000000-0000-4000-8000-000000000010"]) }],
  ["memes of the text corpus", { headers: from(1), body: ids(["a1000000-0000-4000-8000-000000000001", "a1000000-0000-4000-8000-000000000002", "a1000000-0000-4000-8000-000000000008"]) }],
  ["24 ids", { headers: from(1), body: ids(Array.from({ length: 24 }, (_, index) => preview(index + 1))) }],
  ["other fields beside ids", { headers: from(1), body: JSON.stringify({ ids: [preview(1)], urls: ["https://evil.example"], limit: 1 }) }],
  ["ids twice in the object", { headers: from(1), body: `{"ids":["x"],"ids":["${preview(8)}"]}` }],
  ["byte order mark before the json", { headers: from(1), body: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(ids([preview(1)]))]) }],
  ["no content type", { headers: { "x-forwarded-for": ip(1), ...SAME_ORIGIN }, body: ids([preview(1)]) }],
  // Who may ask.
  ["no origin and no sec-fetch-site", { headers: from(2, {}), body: ids([preview(1)]) }],
  ["sec-fetch-site: same-site", { headers: from(2, { "sec-fetch-site": "same-site" }), body: ids([preview(1)]) }],
  ["sec-fetch-site: cross-site", { headers: from(2, { "sec-fetch-site": "cross-site" }), body: ids([preview(1)]) }],
  ["origin of the site url", { headers: from(2, { origin: next.origin }), body: ids([preview(1)]) }],
  ["origin of next's own request url", { headers: from(2, { origin: ownOrigin }), body: ids([preview(1)]) }],
  ["that origin over https, with x-forwarded-proto", { headers: from(2, { origin: ownOrigin.replace("http:", "https:"), "x-forwarded-proto": "https" }), body: ids([preview(1)]) }],
  ["that origin over https, without x-forwarded-proto", { headers: from(2, { origin: ownOrigin.replace("http:", "https:") }), body: ids([preview(1)]) }],
  ["the http origin with x-forwarded-proto: https", { headers: from(2, { origin: ownOrigin, "x-forwarded-proto": "https" }), body: ids([preview(1)]) }],
  ["x-forwarded-proto: http, https", { headers: from(2, { origin: ownOrigin.replace("http:", "https:"), "x-forwarded-proto": "http, https" }), body: ids([preview(1)]) }],
  ["another port", { headers: from(2, { origin: "http://localhost:1" }), body: ids([preview(1)]) }],
  ["the origin in upper case", { headers: from(2, { origin: ownOrigin.toUpperCase() }), body: ids([preview(1)]) }],
  ["the origin with a trailing slash", { headers: from(2, { origin: `${ownOrigin}/` }), body: ids([preview(1)]) }],
  ["origin: null", { headers: from(2, { origin: "null" }), body: ids([preview(1)]) }],
  ["a foreign origin with sec-fetch-site: same-origin", { headers: from(2, { origin: "https://evil.example", ...SAME_ORIGIN }), body: ids([preview(1)]) }],
  ["an empty origin with sec-fetch-site: same-origin", { headers: from(2, { origin: "", ...SAME_ORIGIN }), body: ids([preview(1)]) }],
  ["the origin named by host and x-forwarded-host", { headers: from(2, { origin: "http://example.test", "x-forwarded-host": "example.test" }), body: ids([preview(1)]) }],
  // Bodies that are refused.
  ["no ids", { headers: from(3), body: ids([]) }],
  ["25 ids", { headers: from(3), body: ids(Array.from({ length: 25 }, (_, index) => preview(index + 1))) }],
  ["an id that is not a uuid", { headers: from(3), body: ids([preview(1), "not-a-uuid"]) }],
  ["a uuid without hyphens", { headers: from(3), body: ids([preview(1).replaceAll("-", "")]) }],
  ["a uuid with a space after it", { headers: from(3), body: ids([`${preview(1)} `]) }],
  ["an id that is a number", { headers: from(3), body: JSON.stringify({ ids: [preview(1), 1] }) }],
  ["ids that is a string", { headers: from(3), body: JSON.stringify({ ids: preview(1) }) }],
  ["ids that is an object", { headers: from(3), body: JSON.stringify({ ids: { 0: preview(1), length: 1 } }) }],
  ["an object without ids", { headers: from(3), body: "{}" }],
  ["an array", { headers: from(3), body: JSON.stringify([preview(1)]) }],
  ["null", { headers: from(3), body: "null" }],
  ["a string", { headers: from(3), body: JSON.stringify(preview(1)) }],
  ["malformed json", { headers: from(3), body: '{"ids":[' }],
  ["empty body", { headers: from(3) }],
  ["invalid utf-8", { headers: from(3), body: Buffer.concat([Buffer.from('{"ids":["'), Buffer.from([0xff, 0xfe]), Buffer.from('"]}')]) }],
  ["exactly 2048 bytes", { headers: from(3), body: ids([preview(1)]).padEnd(2048, " ") }],
  ["2049 bytes, declared", { headers: from(3), body: ids([preview(1)]).padEnd(2049, " ") }],
  ["2049 bytes, chunked", { headers: from(3), body: ids([preview(1)]).padEnd(2049, " "), chunked: true }],
  ["2048 bytes, chunked", { headers: from(3), body: ids([preview(1)]).padEnd(2048, " "), chunked: true }],
  ["a refused origin with a refused body", { headers: from(3, {}), body: "{" }],
];

let failed = 0;
async function compare(label, request) {
  const [fromNext, fromAxum] = [await post(nextBase, request), await post(axumBase, request)];
  const status = fromNext.match(/^status: (\d+)$/m)[1];
  if (fromNext === fromAxum) {
    console.log(`ok    ${label}  ${status}`);
  } else {
    failed += 1;
    console.log(`DIFF  ${label}\n  next:\n${fromNext.replace(/^/gm, "    ")}\n  axum:\n${fromAxum.replace(/^/gm, "    ")}`);
  }
}

for (const [label, request] of cases) await compare(label, request);

// The limits. A request counts before its body is read, so these send a
// body that is refused: no database work.
async function fill(label, request, count) {
  for (let i = 1; i <= count; i += 1) {
    const [fromNext, fromAxum] = await Promise.all([post(nextBase, request(i)), post(axumBase, request(i))]);
    if (fromNext !== fromAxum || !fromNext.includes("status: 400")) {
      failed += 1;
      console.log(`DIFF  request ${i} ${label}\n  next:\n${fromNext}\n  axum:\n${fromAxum}`);
    }
  }
  console.log(`      (${count} requests ${label}: all 400 on both)`);
}
const refused = (n) => ({ headers: from(n), body: "{}" });

// 120 a minute for one client address.
await fill("from one address", () => refused(4), 119);
await compare("request 120 from that address (last one allowed)", refused(4));
await compare("request 121 from that address (refused)", refused(4));
await compare("a request that would be shown, from that address", { headers: from(4), body: ids([preview(1)]) });
await compare("another address at the same time", refused(5));
await compare("an untrusted origin from the limited address (403 comes first)", { headers: from(4, {}), body: "{}" });

// 1,200 a minute for everyone. The requests above count too, on both servers
// alike, so fill until the first refusal and compare where it falls.
let sent = 0;
let refusedAt = null;
while (refusedAt === null && sent < 1300) {
  sent += 1;
  const request = refused(100 + (sent % 150));
  const [fromNext, fromAxum] = await Promise.all([post(nextBase, request), post(axumBase, request)]);
  if (fromNext !== fromAxum) {
    failed += 1;
    console.log(`DIFF  request ${sent} of the fill for all clients\n  next:\n${fromNext}\n  axum:\n${fromAxum}`);
    break;
  }
  if (fromNext.includes("status: 429")) refusedAt = sent;
}
console.log(refusedAt === null
  ? `DIFF  no refusal for all clients within ${sent} requests`
  : `ok    limit for all clients: both refuse from request ${refusedAt} of the fill`);
if (refusedAt === null) failed += 1;
await compare("a fresh address once the limit for all clients is reached", refused(99));

console.log(failed ? `\n${failed} differences` : "\nall requests answered identically");
process.exit(failed ? 1 : 0);
