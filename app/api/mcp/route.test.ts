import { afterEach, describe, expect, it, vi } from "vitest";

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
function request(method: string, params: Record<string, unknown> = {}, origin?: string) {
  return new Request("https://catchmeme.com/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method,
      ...(params.name || params.uri ? { "Mcp-Name": String(params.name || params.uri) } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: meta } }),
  });
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("public MemeCatch MCP endpoint", () => {
  it("serves registered UI resources and never advertises serverless events", async () => {
    const { POST } = await import("./route.js");
    const discovered = await (await POST(request("server/discover"))).json();
    expect(discovered.result.capabilities.events).toBeUndefined();
    const result = await (await POST(request("resources/read", { uri: "ui://memecatch/app-v1.html" }))).json();
    expect(result.result.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(result.result.contents[0].text).toContain("ui/initialize");
    expect((await POST(request("events/list"))).status).toBe(404);
  });
  it("searches actual parsed public data and preserves origin uncertainty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("### 테스트 밈\n- URL: https://catchmeme.com/memes/test1234-title\n- 사용 안전도: ● 써도 됨\n- 한 줄 뜻: 공개 본문 항목\n- 유래: 연도 확인 필요")));
    const { POST } = await import("./route.js");
    const result = await (await POST(request("tools/call", { name: "search_memes", arguments: { query: "테스트" } }))).json();
    expect(result.result.structuredContent.memes[0].origin).toBe("연도 확인 필요");
    expect(result.result.structuredContent.scope).toContain("일부");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("https://catchmeme.com/llms-full.txt", expect.any(Object));
  });
  it("rejects foreign browser origins, malformed requests and oversized bodies", async () => {
    const { POST } = await import("./route.js");
    expect((await POST(request("tools/list", {}, "https://evil.invalid"))).status).toBe(403);
    const malformed = new Request("https://catchmeme.com/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect((await POST(malformed)).status).toBe(400);
    const large = new Request("https://catchmeme.com/api/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "x".repeat(256 * 1024 + 1) });
    expect((await POST(large)).status).toBe(413);
  });
});
