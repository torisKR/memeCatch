#!/usr/bin/env node
// A local HTTPS stand-in for the OpenAI Responses API, for the operator's GPT
// drafts (admin-actions.mjs). Both servers reach it through
// OPENAI_REVIEW_BASE_URL=https://127.0.0.1:<port>/v1 with the stub's CA
// (NODE_EXTRA_CA_CERTS for Next, AXUM_EXTRA_CA_CERTS for Axum). OpenAI is
// never called.
//
//   node server/parity/openai-stub.mjs <cert.pem> <key.pem> [port]
//
// POST /v1/responses answers by a marker in the request's `input`:
// "[stub:500]" a 500 with an error message, "[stub:empty]" no text,
// "[stub:text]" text that is not JSON, "[stub:blocks]" the draft in an
// output block; otherwise the draft as `output_text`. The draft depends on
// `text.format.name`. GET /__requests returns what was recorded since the
// last such call (method, url, authorization, content-type, body) and forgets it.
import { readFileSync } from "node:fs";
import https from "node:https";

const [certPath, keyPath, port = "3444"] = process.argv.slice(2);
if (!certPath || !keyPath) {
  console.error("usage: openai-stub.mjs <cert.pem> <key.pem> [port]");
  process.exit(2);
}

// Keys out of alphabetical order and a number written 1.0: the servers must
// pass the answer on as JSON.parse and JSON.stringify would.
const DRAFTS = {
  meme_submission_review_draft: `{"usage_context":{"work":"red","sns":"gray","friends":"yellow","family":"green"},"summary":"스텁 요약","description":"스텁 설명\\n둘째 줄","origin":"스텁 유래","safety_level":"red","score":1.0}`,
  korean_review_draft: `{"title":"스텁 제목","summary":"스텁 요약","description":"스텁 설명","origin":"스텁 유래","usage_note":"","caution":"주의"}`,
  meme_translation_review: `{"review_notes":["Note one","Note two","Note three"],"title":"Stub title","summary":"Stub summary","description":"Stub description","origin":"Stub origin","usage_note":"","caution":"Stub caution","aliases":["stub","스텁"],"recommendation":"edit","confidence":"medium","score":1.0}`,
  missing_meme_translation_preview: `{"title":"Stub preview","summary":"Preview summary","description":"Preview description","origin":"Preview origin","usage_note":"Preview usage","caution":"","aliases":["preview"],"recommendation":"approve","confidence":"high","review_notes":[]}`,
};

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
    recorded.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization ?? null,
      contentType: request.headers["content-type"] ?? null,
      body,
    });
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      // Recorded as it came.
    }
    const input = String(parsed.input ?? "");
    const draft = DRAFTS[parsed.text?.format?.name] ?? "{}";
    const answer = (status, value) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(value));
    };
    if (input.includes("[stub:500]")) return answer(500, { error: { message: "stub overloaded ".repeat(30) } });
    if (input.includes("[stub:empty]")) return answer(200, { output: [] });
    if (input.includes("[stub:text]")) return answer(200, { output_text: "not json" });
    if (input.includes("[stub:blocks]")) return answer(200, { output: [{ content: [{ type: "output_text", text: ` ${draft} ` }] }] });
    return answer(200, { output_text: draft });
  });
});
server.listen(Number(port), "127.0.0.1", () => console.log(`openai stub on https://127.0.0.1:${port}`));
