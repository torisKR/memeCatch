import { describe, expect, it, vi } from "vitest";
import { createAdminWebMcpTools } from "./webmcp-admin";

const memeId = "10000000-0000-4000-8000-000000000001";

function setup() {
  const deps = {
    navigate: vi.fn(),
    checkDuplicates: vi.fn().mockResolvedValue({ ok: true, data: { matches: [] } }),
    registerCatalog: vi.fn().mockResolvedValue({
      ok: true,
      data: { status: "created", memeId, shortId: "abcd1234", slug: "test" },
    }),
    transitionStatus: vi.fn().mockResolvedValue({ ok: true }),
  };
  const tools = createAdminWebMcpTools(deps);
  const get = (name: string) => {
    const found = tools.find((candidate) => candidate.name === name);
    if (!found) throw new Error(`missing tool: ${name}`);
    return found;
  };
  return { deps, get };
}

describe("admin WebMCP tools", () => {
  it("delegates duplicate checks to the authenticated server action", async () => {
    const { deps, get } = setup();
    await get("memecatch.admin.check_catalog_duplicates").execute(
      { title: "테스트", sourceUrls: ["https://example.com/original"] },
      { signal: new AbortController().signal },
    );
    expect(deps.checkDuplicates).toHaveBeenCalledWith({
      title: "테스트",
      sourceUrls: ["https://example.com/original"],
    });
  });

  it("does not expose publish, reject, or delete as review transitions", async () => {
    const { deps, get } = setup();
    const result = await get("memecatch.admin.advance_catalog_review").execute(
      { memeId, to: "approved" },
      { signal: new AbortController().signal },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "unsupported_transition" } });
    expect(deps.transitionStatus).not.toHaveBeenCalled();
  });

  it("opens the editor only for a UUID-shaped meme id", async () => {
    const { deps, get } = setup();
    await get("memecatch.admin.open_meme_editor").execute(
      { memeId },
      { signal: new AbortController().signal },
    );
    expect(deps.navigate).toHaveBeenCalledWith(`/admin/memes/${memeId}`);

    const bad = await get("memecatch.admin.open_meme_editor").execute(
      { memeId: "../../memes" },
      { signal: new AbortController().signal },
    );
    expect(bad).toMatchObject({ ok: false, error: { code: "invalid_meme_id" } });
  });

  it("marks mutation boundaries accurately in tool metadata", () => {
    const { get } = setup();
    expect(get("memecatch.admin.register_catalog_meme").annotations).toMatchObject({ readOnlyHint: false });
    expect(get("memecatch.admin.advance_catalog_review").description).toContain("승인·제한 공개·반려·삭제는 지원하지 않으며");
  });

  it("does not begin a registration when execution is already cancelled", async () => {
    const { deps, get } = setup();
    const controller = new AbortController();
    controller.abort();
    const result = await get("memecatch.admin.register_catalog_meme").execute(
      {},
      { signal: controller.signal },
    );
    expect(result).toMatchObject({ ok: false, error: { code: "cancelled" } });
    expect(deps.registerCatalog).not.toHaveBeenCalled();
  });
});
