import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), begin: vi.fn(), validate: vi.fn(), trusted: vi.fn(), expected: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("@/lib/video-production/oauth.server", () => ({
  beginYouTubeOAuth: mocks.begin,
  getExpectedYouTubeChannelId: mocks.expected,
  hasTrustedYouTubeOAuthOrigin: mocks.trusted,
  validateExpectedYouTubeChannelId: mocks.validate,
  YOUTUBE_OAUTH_STATE_COOKIE: "memecatch_youtube_oauth_state",
  YOUTUBE_OAUTH_STATE_TTL_SECONDS: 600,
}));

import { POST } from "./route";

function request(body: unknown, origin = "https://catchmeme.com") {
  return new Request("https://catchmeme.com/api/admin/video-productions/youtube/connect", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string | undefined>, origin = "https://catchmeme.com", declaredLength?: string) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) parameters.set(key, value);
  const body = parameters.toString();
  return new Request("https://catchmeme.com/api/admin/video-productions/youtube/connect", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/x-www-form-urlencoded",
      ...(declaredLength ? { "content-length": declaredLength } : {}),
    },
    body,
  });
}

beforeEach(() => {
  mocks.trusted.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "operator-id" } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.validate.mockImplementation((value) => value);
  mocks.expected.mockReturnValue(`UC${"a".repeat(22)}`);
  mocks.begin.mockResolvedValue({ authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=opaque&response_type=code&client_id=client.apps.googleusercontent.com", state: "opaque" });
});

describe("POST YouTube OAuth connect", () => {
  it("requires a trusted origin before authentication or state creation", async () => {
    mocks.trusted.mockReturnValue(false);
    const response = await POST(request({ expected_channel_id: `UC${"a".repeat(22)}`, consent: true }, "https://evil.invalid"));
    expect(response.status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("fails closed for missing user and non-operator", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await POST(request({ expected_channel_id: `UC${"a".repeat(22)}`, consent: true }))).status).toBe(401);
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request({ expected_channel_id: `UC${"a".repeat(22)}`, consent: true }))).status).toBe(403);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("accepts only the expected channel field and returns an HttpOnly secure ten-minute binding cookie", async () => {
    const expected = `UC${"a".repeat(22)}`;
    const response = await POST(request({ expected_channel_id: expected, consent: true }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(expect.objectContaining({ authorizationUrl: expect.stringContaining("accounts.google.com"), expiresInSeconds: 600 }));
    expect(mocks.validate).toHaveBeenCalledWith(expected);
    expect(mocks.begin).toHaveBeenCalledWith("operator-id", expected);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("memecatch_youtube_oauth_state=opaque");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Max-Age=600");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("accepts the real native form protocol and navigates with 303 only to Google's fixed authorization endpoint", async () => {
    const expected = `UC${"a".repeat(22)}`;
    const response = await POST(formRequest({ expected_channel_id: expected, consent: "true" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=opaque&response_type=code&client_id=client.apps.googleusercontent.com");
    expect(response.headers.get("set-cookie")).toContain("memecatch_youtube_oauth_state=opaque");
    expect(mocks.begin).toHaveBeenCalledWith("operator-id", expected);
  });

  it.each([
    { expected_channel_id: `UC${"a".repeat(22)}` },
    { expected_channel_id: `UC${"a".repeat(22)}`, consent: false },
  ])("requires explicit literal consent for JSON callers", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it.each([
    { expected_channel_id: `UC${"a".repeat(22)}` },
    { expected_channel_id: `UC${"a".repeat(22)}`, consent: "false" },
  ])("requires explicit literal consent for native form callers", async (fields) => {
    expect((await POST(formRequest(fields))).status).toBe(400);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("rejects extra body fields before beginning OAuth", async () => {
    const response = await POST(request({ expected_channel_id: `UC${"a".repeat(22)}`, consent: true, redirect_uri: "https://evil.invalid" }));
    expect(response.status).toBe(400);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("rejects another syntactically valid channel instead of allowing identity rebinding", async () => {
    mocks.validate.mockReturnValue(`UC${"b".repeat(22)}`);
    const response = await POST(request({ expected_channel_id: `UC${"b".repeat(22)}`, consent: true }));
    expect(response.status).toBe(400);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("rejects declared oversize form bodies before OAuth state creation", async () => {
    const response = await POST(formRequest({ expected_channel_id: `UC${"a".repeat(22)}`, consent: "true" }, "https://catchmeme.com", "1025"));
    expect(response.status).toBe(413);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("refuses navigation when the OAuth helper returns a non-allowlisted URL", async () => {
    mocks.begin.mockResolvedValue({ authorizationUrl: "https://evil.invalid/oauth?state=opaque", state: "opaque" });
    const response = await POST(formRequest({ expected_channel_id: `UC${"a".repeat(22)}`, consent: "true" }));
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
