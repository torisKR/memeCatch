#!/usr/bin/env node
// A loopback HTTPS stand-in for the OpenAI Responses API, for the operator's
// GPT drafts. run.sh starts it and points the server at it with
// OPENAI_REVIEW_BASE_URL=https://127.0.0.1:<port>/v1 and its CA in
// AXUM_EXTRA_CA_CERTS (the server's client is HTTPS only). OpenAI is never
// called.
//
//   node server/behaviour/openai-stub.mjs <cert.pem> <key.pem> <port>
//
// POST /v1/responses answers with the draft of the request's
// `text.format.name` as `output_text`.
import { readFileSync } from "node:fs";
import https from "node:https";

const [certPath, keyPath, port] = process.argv.slice(2);
if (!certPath || !keyPath || !port) {
  console.error("usage: openai-stub.mjs <cert.pem> <key.pem> <port>");
  process.exit(2);
}

const DRAFTS = {
  meme_submission_review_draft: `{"usage_context":{"work":"red","sns":"gray","friends":"yellow","family":"green"},"summary":"스텁 요약","description":"스텁 설명\\n둘째 줄","origin":"스텁 유래","safety_level":"red","score":1.0}`,
  korean_review_draft: `{"title":"스텁 제목","summary":"스텁 요약","description":"스텁 설명","origin":"스텁 유래","usage_note":"","caution":"주의"}`,
  meme_translation_review: `{"review_notes":["Note one","Note two","Note three"],"title":"Stub title","summary":"Stub summary","description":"Stub description","origin":"Stub origin","usage_note":"","caution":"Stub caution","aliases":["stub","스텁"],"recommendation":"edit","confidence":"medium","score":1.0}`,
  missing_meme_translation_preview: `{"title":"Stub preview","summary":"Preview summary","description":"Preview description","origin":"Preview origin","usage_note":"Preview usage","caution":"","aliases":["preview"],"recommendation":"approve","confidence":"high","review_notes":[]}`,
};

const server = https.createServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, (request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    if (request.method !== "POST" || request.url !== "/v1/responses") {
      response.writeHead(404);
      response.end();
      return;
    }
    let format = null;
    try {
      format = JSON.parse(Buffer.concat(chunks).toString("utf8")).text?.format?.name ?? null;
    } catch {
      // An unreadable body gets the empty draft.
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ output_text: DRAFTS[format] ?? "{}" }));
  });
});
server.listen(Number(port), "127.0.0.1", () => console.log(`openai stub on https://127.0.0.1:${port}`));
