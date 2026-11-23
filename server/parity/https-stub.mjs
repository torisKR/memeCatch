#!/usr/bin/env node
// A local HTTPS stand-in for an outside service (the saved-state email
// provider), for ops.mjs. It records every request and answers by recipient:
// an address with "+fail" gets 503, one with "+slow" gets no answer for 9 s
// (past the 8 s limit of the TypeScript), any other 200. No real service is
// ever called. See README.md in this directory.
//
//   node server/parity/https-stub.mjs <cert.pem> <key.pem> [port]
//
// GET /__requests returns what was recorded since the last such call, as a
// JSON array, and forgets it.
import { readFileSync } from "node:fs";
import https from "node:https";

const [certPath, keyPath, port = "3443"] = process.argv.slice(2);
if (!certPath || !keyPath) {
  console.error("usage: https-stub.mjs <cert.pem> <key.pem> [port]");
  process.exit(2);
}

// The headers a provider sees that the sender chooses.
const RECORDED_HEADERS = ["content-type", "authorization", "content-length"];
let recorded = [];

const server = https.createServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, (request, response) => {
  if (request.method === "GET" && request.url === "/__requests") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(recorded));
    recorded = [];
    return;
  }
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const headers = Object.fromEntries(RECORDED_HEADERS.map((name) => [name, request.headers[name] ?? null]));
    recorded.push({ method: request.method, url: request.url, headers, body });
    let recipient = "";
    try {
      recipient = String(JSON.parse(body).to?.[0] ?? "");
    } catch {}
    if (recipient.includes("+slow")) {
      setTimeout(() => response.end(), 9_000).unref();
      return;
    }
    const status = recipient.includes("+fail") ? 503 : 200;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "stub", status }));
  });
});
server.listen(Number(port), "127.0.0.1", () => console.log(`https stub on 127.0.0.1:${port}`));
