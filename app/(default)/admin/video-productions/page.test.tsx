import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoProductionWorkspace } from "@/lib/video-production/workspace-types";

vi.mock("server-only", () => ({}));
vi.mock("@/app/(default)/admin/require-operator", () => ({ requireOperatorPage: vi.fn() }));
vi.mock("@/lib/video-production/workspace.server", () => ({ getVideoProductionWorkspace: vi.fn() }));
vi.mock("@/components/admin/video-production-console", () => ({
  VideoProductionConsole: ({ workspace }: { workspace: VideoProductionWorkspace }) => <div data-state={workspace.state}>video console</div>,
}));

import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { getVideoProductionWorkspace } from "@/lib/video-production/workspace.server";
import Page, { dynamic, metadata } from "./page";

const emptyWorkspace: VideoProductionWorkspace = {
  state: "setup_required", candidates: [], productions: [], channels: [], publications: [],
  oauth_configured: false, draft_provider_configured: false, setup_notes: ["설정 필요"], expected_channel_id: "UCBxN8lUb-5dDuOPv-szpF4g",
};

describe("video productions admin page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOperatorPage).mockResolvedValue({} as never);
    vi.mocked(getVideoProductionWorkspace).mockResolvedValue(emptyWorkspace);
  });

  it("guards the route before loading production data", async () => {
    vi.mocked(requireOperatorPage).mockRejectedValue(new Error("anonymous"));
    await expect(Page()).rejects.toThrow("anonymous");
    expect(getVideoProductionWorkspace).not.toHaveBeenCalled();
  });

  it("loads the workspace after authorization and renders the console", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(requireOperatorPage).toHaveBeenCalledWith("/admin/video-productions");
    expect(getVideoProductionWorkspace).toHaveBeenCalledOnce();
    expect(html).toContain('data-state="setup_required"');
  });

  it("is dynamically rendered and excluded from indexing", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
