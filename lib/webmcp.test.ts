import { describe, expect, it, vi } from "vitest";
import { createPublicWebMcpTools, registerWebMcpTools } from "./webmcp";

function tool(name: string) {
  const found = createPublicWebMcpTools(vi.fn()).find((candidate) => candidate.name === name);
  if (!found) throw new Error(`missing tool: ${name}`);
  return found;
}

describe("public WebMCP tools", () => {
  it("encodes search input instead of interpolating executable markup", async () => {
    const navigate = vi.fn();
    const search = createPublicWebMcpTools(navigate).find((candidate) => candidate.name === "memecatch.search")!;
    await search.execute({ query: "<script>alert(1)</script> & 밈" }, { signal: new AbortController().signal });
    expect(navigate).toHaveBeenCalledWith("/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E%20%26%20%EB%B0%88");
  });

  it("rejects invalid filter values and unsafe detail keys", async () => {
    await expect(tool("memecatch.filter_memes").execute(
      { category: "../../admin" },
      { signal: new AbortController().signal },
    )).resolves.toMatchObject({ ok: false, error: { code: "invalid_category" } });
    await expect(tool("memecatch.open_meme").execute(
      { key: "../../admin" },
      { signal: new AbortController().signal },
    )).resolves.toMatchObject({ ok: false, error: { code: "invalid_meme_key" } });
  });

  it("uses the public explore page's display-category tokens", async () => {
    const navigate = vi.fn();
    const filter = createPublicWebMcpTools(navigate).find((candidate) => candidate.name === "memecatch.filter_memes")!;
    await filter.execute(
      { category: "ai-meme", sort: "recent" },
      { signal: new AbortController().signal },
    );
    expect(navigate).toHaveBeenCalledWith("/explore?category=ai-meme&sort=recent");
  });

  it("uses one abort signal for registration and stops after cancellation", async () => {
    const controller = new AbortController();
    const registerTool = vi.fn<WebMcpModelContext["registerTool"]>(async () => {
      controller.abort();
    });
    await registerWebMcpTools(
      { registerTool } as unknown as WebMcpModelContext,
      [tool("memecatch.navigate"), tool("memecatch.search")],
      controller.signal,
    );
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(registerTool.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });
});
