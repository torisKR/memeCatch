import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), complete: vi.fn(), matches: vi.fn() }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://catchmeme.com" }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("@/lib/video-production/oauth.server", () => ({
  completeYouTubeOAuth: mocks.complete,
  oauthStateMatchesCookie: mocks.matches,
  YOUTUBE_OAUTH_STATE_COOKIE: "memecatch_youtube_oauth_state",
}));

import { GET } from "./route";

function request(query = "state=opaque&code=code", cookie = "opaque") {
  return new NextRequest(`https://attacker-controlled-host.invalid/api/admin/video-productions/youtube/callback?${query}`, {
    headers: cookie ? { cookie: `memecatch_youtube_oauth_state=${cookie}` } : {},
  });
}

beforeEach(() => {
  mocks.matches.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "operator-id" } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.complete.mockResolvedValue({ channelId: `UC${"a".repeat(22)}`, title: "밈캐치", connectionStatus: "connected" });
});

describe("GET YouTube OAuth callback", () => {
  it("rejects browser state mismatch before auth and redirects only to the fixed canonical admin URL", async () => {
    mocks.matches.mockReturnValue(false);
    const response = await GET(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://catchmeme.com/admin/video-productions?youtube=reauth");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("binds completion to the authenticated operator and clears the one-time cookie", async () => {
    const response = await GET(request());
    expect(mocks.complete).toHaveBeenCalledWith({ operatorId: "operator-id", state: "opaque", code: "code", providerError: undefined });
    expect(response.headers.get("location")).toBe("https://catchmeme.com/admin/video-productions?youtube=connected");
    expect(response.headers.get("set-cookie")).toContain("memecatch_youtube_oauth_state=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("consumes a matching state even when Google returns access_denied, then uses a safe fixed redirect", async () => {
    mocks.complete.mockRejectedValue(new Error("youtube_reauthentication_required"));
    const response = await GET(request("state=opaque&error=access_denied"));
    expect(mocks.complete).toHaveBeenCalledWith({ operatorId: "operator-id", state: "opaque", code: undefined, providerError: "access_denied" });
    expect(response.headers.get("location")).toBe("https://catchmeme.com/admin/video-productions?youtube=reauth");
  });

  it("fails closed if the callback session is missing or is no longer an operator", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await GET(request())).headers.get("location")).toContain("youtube=reauth");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await GET(request())).headers.get("location")).toContain("youtube=reauth");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
