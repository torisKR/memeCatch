import { createServer } from "node:http";

const port = Number(process.env.PORT || 4311);

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function json(response, payload) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(404).end();
    return;
  }

  if (request.url !== "/v1/chat/completions") {
    response.writeHead(404).end();
    return;
  }

  const payload = JSON.parse((await body(request)).toString("utf8"));
  const system = payload.messages?.find((message) => message.role === "system")?.content || "";
  if (system.includes("mpe_ocr_segments")) {
    json(response, { choices: [{ message: { content: JSON.stringify({ segments: [{
      rawText: "로컬 OCR 문구",
      normalizedText: "로컬 OCR 문구",
      language: "ko",
      confidence: 0.99,
      boundingBox: null,
    }] }) } }] });
    return;
  }

  if (system.includes("mpe_evidence_draft")) {
    const userContent = payload.messages?.find((message) => message.role === "user")?.content;
    const input = typeof userContent === "string"
      ? userContent
      : userContent?.find((part) => part.type === "text")?.text;
    const evidence = JSON.parse(input).evidence;
    const cited = evidence.find((item) => item.kind !== "ingestion" && item.text?.trim());
    json(response, { choices: [{ message: { content: JSON.stringify({ claims: [{
      field: "TITLE",
      text: "로컬 E2E 밈",
      evidenceIds: [cited?.id],
      confidence: 0.9,
      needsReview: false,
    }] }) } }] });
    return;
  }

  response.writeHead(422, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { message: "unsupported schema" } }));
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`mpe local provider stub listening on ${port}\n`);
});
