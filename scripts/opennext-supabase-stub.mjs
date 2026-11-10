import { createServer } from "node:http";

const port = Number(process.env.STUB_PORT || 8799);
const modes = new Map([
  ["okmem001", "row"],
  ["fail0001", "error"],
]);

function meme(shortId) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    short_id: shortId,
    slug: shortId === "okmem001" ? "ok-meme" : `${shortId}-slug`,
    title: "확인된 밈",
    summary: "확인된 요약입니다. 스모크가 성공 문서를 구분하는 데 씁니다.",
    description: "확인된 설명입니다.",
    origin: "확인된 유래입니다.",
    usage_note: "",
    caution: null,
    usage_context: null,
    origin_year: 2020,
    year_precision: "unknown",
    moderation_status: "approved",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    sentiment: "funny",
    origin_kind: "community",
    media_type: "text",
    difficulty: "beginner",
    doc_class: "standard",
    published_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-02T00:00:00.000Z",
    created_at: "2024-01-01T00:00:00.000Z",
    safety_reviewed_at: null,
    trend_score: 1,
    aliases: [],
    usage_examples: [],
    revival_years: [],
    meme_contents: [],
    meme_sources: [],
    meme_tags_map: [],
    meme_market_profiles: [],
    meme_translations: [],
  };
}

function send(response, status, body, extra = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extra,
  });
  response.end(payload);
}

function shortIdFrom(url) {
  const value = url.searchParams.get("short_id") ?? "";
  const match = /^eq\.(.+)$/.exec(value);
  return match ? decodeURIComponent(match[1]) : null;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/health") {
    send(response, 200, { ok: true });
    return;
  }
  if (request.method === "POST" && url.pathname === "/__control") {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      for (const [shortId, mode] of Object.entries(body)) {
        if (mode !== "row" && mode !== "empty" && mode !== "error") {
          send(response, 400, { ok: false });
          return;
        }
        modes.set(shortId, mode);
      }
      send(response, 200, { ok: true });
    });
    return;
  }
  if (url.pathname.startsWith("/auth/")) {
    send(response, 401, { error: "invalid_token", message: "stub" });
    return;
  }
  if (request.method === "HEAD") {
    response.writeHead(200, { "content-range": "*/0", "content-type": "application/json" });
    response.end();
    return;
  }
  if (url.pathname.includes("/rpc/")) {
    send(response, 200, []);
    return;
  }

  const shortId = shortIdFrom(url);
  const mode = shortId ? modes.get(shortId) ?? "empty" : "empty";
  if (shortId && mode === "error") {
    send(response, 500, { code: "57014", message: "stub outage" });
    return;
  }
  const wantsObject = (request.headers.accept ?? "").includes("application/vnd.pgrst.object+json");
  if (mode === "row" && shortId) {
    send(response, 200, wantsObject ? meme(shortId) : [meme(shortId)]);
    return;
  }
  if (wantsObject) {
    send(response, 406, {
      code: "PGRST116",
      details: null,
      hint: null,
      message: "JSON object requested, multiple (or no) rows returned",
    });
    return;
  }
  send(response, 200, []);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`supabase stub listening on ${port}`);
});
