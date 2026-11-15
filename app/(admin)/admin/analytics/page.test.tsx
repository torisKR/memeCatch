import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
import { createClient } from "@/lib/supabase/server";
import Page from "./page";

beforeEach(() => vi.clearAllMocks());
describe("GA4 page authorization", () => {
  it("redirects anonymous visitors before reporting", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) }, rpc } as never);
    await expect(Page()).rejects.toThrow("REDIRECT:/login?next=%2Fadmin%2Fanalytics");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([{ data: false, error: null }, { data: true, error: { message: "denied" } }])("denies nonoperators or failed permission checks", async (permission) => {
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "test" } } }) }, rpc: vi.fn().mockResolvedValue(permission) } as never);
    await expect(Page()).rejects.toThrow("REDIRECT:/");
  });
  it("renders truthful configuration state for an authorized operator", async () => {
    vi.stubEnv("GA4_PROPERTY_ID", "");
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "test" } } }) }, rpc: vi.fn().mockResolvedValue({ data: true, error: null }) } as never);
    try {
      const html = renderToStaticMarkup(await Page());
      expect(html).toContain("GA4 연결 설정 필요");
      expect(html).toContain('action="/admin/analytics"');
      expect(html).toContain("다시 조회");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
