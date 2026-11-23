#!/usr/bin/env node
// POST /api/csp-report: sends the same requests to Next and to Axum and
// compares status and headers. parity.mjs sends no request body, so this
// route has its own script. See README.md in this directory.
//
//   node server/parity/csp-report.mjs <next-base-url> <axum-base-url>
//
// Each run uses fresh client addresses (X-Forwarded-For), so the 60-per-minute
// limit of an earlier run does not carry over. Both servers log one
// `[CSP-VIOLATION] ...` line per accepted report; compare the two logs
// afterwards to check that part.
import http from "node:http";

const [nextBase, axumBase] = process.argv.slice(2);
if (!nextBase || !axumBase) {
  console.error("usage: csp-report.mjs <next-base-url> <axum-base-url>");
  process.exit(2);
}

const IGNORED_HEADERS = new Set(["date", "connection", "keep-alive", "transfer-encoding", "x-nextjs-cache"]);
const hostHeader = new URL(nextBase).host;
const run = Date.now() % 250;
const ip = (n) => `198.51.${run}.${n}`;
const REPORT = "application/csp-report";
const legacy = (fields) => JSON.stringify({ "csp-report": fields });

function post(base, { headers = {}, body = "", chunked = false }) {
  const { hostname, port } = new URL(base);
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname,
        port,
        path: "/api/csp-report",
        method: "POST",
        headers: { host: hostHeader, "user-agent": "memecatch-parity", ...headers, ...(chunked ? {} : { "content-length": payload.length }) },
      },
      (response) => {
        let bytes = 0;
        response.on("data", (chunk) => (bytes += chunk.length));
        response.on("end", () => {
          const fields = [`status: ${response.statusCode}`, `body bytes: ${bytes}`];
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

const long = "x".repeat(299);
const cases = [
  ["accepted legacy report", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: legacy({ "document-uri": "https://catchmeme.com/", "blocked-uri": "https://evil.example/x.js", "violated-directive": "script-src-elem", "effective-directive": "script-src", disposition: "report" }) }],
  ["accepted reporting api batch", { headers: { "content-type": "application/reports+json; charset=utf-8", "x-forwarded-for": ip(1) }, body: JSON.stringify([{ type: "csp-violation", body: { "blocked-uri": "inline", "violated-directive": "style-src" } }, { type: "other", body: {} }, null, 3, "text", []]) }],
  ["fields that need escaping and cutting", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: legacy({ "blocked-uri": 'a"b\\c\nd\u0085e f', "document-uri": `${long}😀`, "violated-directive": `${long}"`, disposition: 7 }) }],
  ["null body falls back to legacy key", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: JSON.stringify({ body: null, "csp-report": { "blocked-uri": "from-legacy", "effective-directive": null, "violated-directive": "img-src" } }) }],
  ["report fields on the record itself", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: JSON.stringify({ "blocked-uri": "on-record", "document-uri": "" }) }],
  ["25 reports, 20 logged", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ body: { "blocked-uri": `batch-${i}` } }))) }],
  ["byte order mark before the json", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(legacy({ "blocked-uri": "after-bom" }))]) }],
  ["invalid utf-8 inside a field", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: Buffer.concat([Buffer.from('{"blocked-uri":"bad-'), Buffer.from([0xff, 0xc3]), Buffer.from('-utf8"}')]) }],
  ["exactly 16 KiB", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: legacy({ "blocked-uri": "at-limit", pad: "p".repeat(16384 - legacy({ "blocked-uri": "at-limit", pad: "" }).length) }) }],
  ["oversized body, declared", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: legacy({ "blocked-uri": "too-big", pad: "p".repeat(16384) }) }],
  ["oversized body, chunked", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: legacy({ "blocked-uri": "too-big-chunked", pad: "p".repeat(40000) }), chunked: true }],
  ["16 KiB of bytes that decode to more", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: Buffer.concat([Buffer.from('{"blocked-uri":"'), Buffer.alloc(8000, 0xff), Buffer.from('"}')]) }],
  ["malformed json", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: '{"csp-report":' }],
  ["json that is not a report", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) }, body: '"just a string"' }],
  ["empty body", { headers: { "content-type": REPORT, "x-forwarded-for": ip(1) } }],
  ["wrong content type", { headers: { "content-type": "application/json", "x-forwarded-for": ip(1) }, body: legacy({ "blocked-uri": "wrong-type" }) }],
  ["content type in another case", { headers: { "content-type": "Application/CSP-Report", "x-forwarded-for": ip(1) }, body: legacy({ "blocked-uri": "wrong-case" }) }],
  ["no content type", { headers: { "x-forwarded-for": ip(1) }, body: legacy({ "blocked-uri": "no-type" }) }],
];

let failed = 0;
async function compare(label, request) {
  const next = await post(nextBase, request);
  const axum = await post(axumBase, request);
  const status = next.match(/^status: (\d+)$/m)[1];
  const retryAfter = next.match(/^retry-after: (.*)$/m)?.[1];
  if (next === axum) {
    console.log(`ok    ${label}  ${status}${retryAfter ? `  retry-after: ${retryAfter}` : ""}`);
  } else {
    failed += 1;
    console.log(`DIFF  ${label}\n  next:\n${next.replace(/^/gm, "    ")}\n  axum:\n${axum.replace(/^/gm, "    ")}`);
  }
}

for (const [label, request] of cases) await compare(label, request);

// The limit: 60 requests a minute for one client address, taken from the
// first entry of X-Forwarded-For.
async function fill(label, requestFor, count) {
  for (let i = 1; i <= count; i += 1) {
    const [next, axum] = [await post(nextBase, requestFor(i)), await post(axumBase, requestFor(i))];
    if (next !== axum || next.includes("retry-after")) {
      failed += 1;
      console.log(`DIFF  request ${i} ${label}\n  next:\n${next}\n  axum:\n${axum}`);
    }
  }
  console.log(`      (${count} requests ${label}: all 204 without retry-after on both)`);
}
const withHeaders = (request, headers) => ({ ...request, headers: { "content-type": REPORT, ...headers } });

const limited = { headers: { "content-type": REPORT, "x-forwarded-for": ip(2) }, body: legacy({ "blocked-uri": "rate-limit" }) };
await fill("from one address", () => limited, 59);
await compare("request 60 from that address (last one allowed)", limited);
await compare("request 61 from that address (refused)", limited);
await compare("same address behind another proxy hop", withHeaders(limited, { "x-forwarded-for": `${ip(2)}, 10.0.0.1` }));
await compare("another address at the same time", withHeaders(limited, { "x-forwarded-for": ip(3) }));

// X-Real-IP is the key only when X-Forwarded-For is there with an empty
// first entry.
const viaRealIp = withHeaders(limited, { "x-forwarded-for": ` , ${ip(5)}`, "x-real-ip": ip(4) });
await fill("with an empty first x-forwarded-for entry and one x-real-ip", () => viaRealIp, 60);
await compare("request 61 with that x-real-ip (refused)", viaRealIp);
await compare("that x-real-ip address as the forwarded client (same bucket)", withHeaders(limited, { "x-forwarded-for": ip(4) }));
await compare("empty first entry and another x-real-ip", withHeaders(limited, { "x-forwarded-for": ",", "x-real-ip": ip(6) }));

// No X-Forwarded-For at all: Next fills it in with the address of the TCP
// peer, this machine for both servers, so X-Real-IP is not consulted. This
// one bucket cannot be made fresh: if a request without the header reached
// either server in the last minute, the lines below show it. Run again a
// minute later.
const noForwarded = (n) => withHeaders(limited, { "x-real-ip": ip(100 + n) });
await fill("without x-forwarded-for, each with a different x-real-ip", noForwarded, 59);
await compare("request 60 without x-forwarded-for (last one allowed)", noForwarded(60));
await compare("request 61 without x-forwarded-for (refused: keyed by the peer address)", noForwarded(61));
await compare("the peer address 127.0.0.1 as the forwarded client (same bucket)", withHeaders(limited, { "x-forwarded-for": "127.0.0.1" }));

console.log(failed ? `\n${failed} differences` : "\nall requests answered identically");
process.exit(failed ? 1 : 0);
