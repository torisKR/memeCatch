import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Corpus } from "../../../integrations/memecatch-chatgpt/src/corpus.mjs";
import { dispatch, validateRequest, isLegacyRequest, VERSION } from "../../../integrations/memecatch-chatgpt/src/protocol.mjs";

export const runtime = "nodejs";
export const maxDuration = 30;
const corpus = new Corpus({ fetcher: (...args) => fetch(...args) });
const uiHtml = readFileSync(join(process.cwd(), "integrations/memecatch-chatgpt/ui/app.html"), "utf8");
const allowedOrigins = new Set(["https://chatgpt.com", "https://catchmeme.com"]);
const responseHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const MAX_BODY = 256 * 1024;

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  let bytes = 0;
  const parts = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) throw Object.assign(new Error("Request too large."), { code: -32600, status: 413 });
      parts.push(value);
    }
    return Buffer.concat(parts).toString("utf8");
  } finally { await reader.cancel().catch(() => {}); }
}

export async function POST(request) {
  let message;
  try {
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins.has(origin)) return Response.json({ error: "Origin not allowed." }, { status: 403, headers: responseHeaders });
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return Response.json({ error: "Use application/json." }, { status: 415, headers: responseHeaders });
    const raw = await readBody(request);
    try { message = JSON.parse(raw); }
    catch { throw Object.assign(new Error("Invalid JSON."), { code: -32700, status: 400 }); }
    const headers = Object.fromEntries(request.headers.entries());
    validateRequest(message, headers);
    if (message.method.startsWith("events/")) return Response.json({ jsonrpc: "2.0", ...(message.id != null ? { id: message.id } : {}), error: { code: -32601, message: "Events require the separately authenticated persistent server." } }, { status: 404, headers: responseHeaders });
    if (message.id === undefined) return new Response(null, { status: 202, headers: responseHeaders });
    const result = await dispatch(message, { corpus, broker: null, owner: null, uiHtml });
    if (isLegacyRequest(message, headers)) delete result.resultType;
    return Response.json({ jsonrpc: "2.0", id: message.id, result }, { headers: responseHeaders });
  } catch (error) {
    const known = Number.isInteger(error.code);
    return Response.json({ jsonrpc: "2.0", ...(message?.id != null ? { id: message.id } : {}), error: { code: known ? error.code : -32603, message: known ? error.message : "Internal server error.", ...(error.data ? { data: error.data } : {}) } }, { status: error.status || 200, headers: responseHeaders });
  }
}

export function GET() {
  return Response.json({ service: "memecatch", protocolVersion: VERSION, events: "disabled", usage: "POST JSON-RPC requests to this endpoint." }, { status: 405, headers: { ...responseHeaders, Allow: "POST" } });
}
