#!/usr/bin/env node
// Writes the Converse request bodies the real generateBedrockMemeConcepts
// (lib/meme-studio-bedrock.server.ts, through the AWS SDK) sends for a set of
// inputs, for src/routes/studio/bedrock.rs to be compared with. The SDK is
// pointed at an HTTP/2 stub on 127.0.0.1 (it speaks HTTP/2 to Bedrock
// Runtime) with made-up keys. Run it in a container without a network, so
// nothing can reach AWS whatever the SDK does:
//
//   docker run --rm --network none -v "$PWD":/w:ro -w /w node:22-bookworm-slim \
//     node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
//     server/parity/meme-studio-bedrock-fixture.mjs > server/tests/fixtures/meme_studio_bedrock.json
import http2 from "node:http2";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const bodies = [];
const server = http2.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    bodies.push({ path: request.headers[":path"], body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
    response.writeHead(500, { "content-type": "application/json" }).end('{"message":"stub"}');
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
Object.assign(process.env, {
  BEDROCK_MEME_STUDIO_ENABLED: "true",
  AWS_ACCESS_KEY_ID: "AKIDFIXTURE",
  AWS_SECRET_ACCESS_KEY: "fixture-secret",
  AWS_REGION: "ap-northeast-2",
  AWS_ENDPOINT_URL_BEDROCK_RUNTIME: `http://127.0.0.1:${server.address().port}`,
});
const { generateBedrockMemeConcepts } = await import(path.join(ROOT, "lib/meme-studio-bedrock.server.ts"));

const inputs = [
  ["출근길", "absurd", "caption", "KR"],
  ["  월요일   아침\t회의  ", "sarcastic", "image-macro", "US"],
  ["고양이 \"집사\" \\ 경계", "wholesome", "reaction", "JP"],
  ["rain delay", "hype", "caption", "GB"],
  ["Pix 송금", "absurd", "reaction", "BR"],
  ["주말 계획", "wholesome", "image-macro", "MX"],
  ["배달 앱", "hype", "caption", "CN"],
  ["스쿠터 출근", "sarcastic", "reaction", "TW"],
  ["회의 예약", "absurd", "image-macro", "DE"],
  ["점심시간 — 경계", "wholesome", "caption", "FR"],
];
const out = [];
for (const [topic, tone, format, country] of inputs) {
  const before = bodies.length;
  await generateBedrockMemeConcepts({ topic, tone, format, country }, { reserveCost: async () => {} }).catch(() => {});
  if (bodies.length !== before + 1) throw new Error(`no request for ${topic}`);
  out.push({ input: { topic, tone, format, country }, ...bodies.at(-1) });
}
server.close();
process.stdout.write(`${JSON.stringify(out)}\n`);
