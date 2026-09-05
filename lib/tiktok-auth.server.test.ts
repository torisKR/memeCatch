import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  bindUpdate: vi.fn(),
  generateLink: vi.fn(),
  identityInsert: vi.fn(),
  identitySelect: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { generateLink: mocks.generateLink } },
    from: () => ({
      insert: mocks.identityInsert,
      select: () => ({
        eq: () => ({ maybeSingle: mocks.identitySelect }),
      }),
      update: () => ({
        eq: () => ({ is: mocks.bindUpdate }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signOut: mocks.signOut, verifyOtp: mocks.verifyOtp },
  }),
}));

import {
  isValidTikTokOAuthState,
  signInWithTikTokCode,
} from "@/lib/tiktok-auth.server";

beforeEach(() => {
  process.env.TIKTOK_CLIENT_KEY = "test-client";
  process.env.TIKTOK_CLIENT_SECRET = "test-secret";
  mocks.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: "hashed-token" } },
    error: null,
  });
  mocks.verifyOtp.mockResolvedValue({
    data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
    error: null,
  });
  mocks.identityInsert.mockResolvedValue({ error: null });
  mocks.identitySelect.mockResolvedValue({
    data: {
      internal_email: `${"a".repeat(64)}@auth.memecatch.internal`,
      user_id: "00000000-0000-4000-8000-000000000001",
    },
    error: null,
  });
  mocks.bindUpdate.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.TIKTOK_CLIENT_KEY;
  delete process.env.TIKTOK_CLIENT_SECRET;
});

describe("TikTok OAuth security", () => {
  it("compares the one-time state without accepting missing or altered values", () => {
    const state = "fixed-length-random-state";
    expect(isValidTikTokOAuthState(state, state)).toBe(true);
    expect(isValidTikTokOAuthState(state, `${state}x`)).toBe(false);
    expect(isValidTikTokOAuthState(state, "fixed-length-random-statuX")).toBe(false);
    expect(isValidTikTokOAuthState(undefined, state)).toBe(false);
    expect(isValidTikTokOAuthState(state, null)).toBe(false);
  });

  it("requires the basic profile scope before creating a Supabase session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: "access-token",
        open_id: "open-id",
        scope: "video.list",
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      signInWithTikTokCode("code", "https://preview.example/auth/tiktok/callback"),
    ).rejects.toThrow("TikTok basic profile permission was not granted");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it("keeps granted scopes server-side for optional video import checks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          access_token: "access-token",
          open_id: "open-id",
          scope: "user.info.basic,video.list",
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: {
            user: {
              open_id: "open-id",
              display_name: "Creator",
              avatar_url: "https://p16-sign.tiktokcdn.com/avatar.jpeg",
            },
          },
          error: { code: "ok" },
        }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const session = await signInWithTikTokCode(
      "code",
      "https://preview.example/auth/tiktok/callback",
    );

    expect([...session.scopes]).toEqual(["user.info.basic", "video.list"]);
    expect(session.accessToken).toBe("access-token");
    expect(mocks.identityInsert).toHaveBeenCalledWith({
      provider_subject: expect.stringMatching(/^[0-9a-f]{64}$/),
      internal_email: expect.stringMatching(
        /^[0-9a-f]{64}@auth\.memecatch\.internal$/,
      ),
    });
    expect(mocks.generateLink).toHaveBeenCalledOnce();
    expect(mocks.generateLink).toHaveBeenCalledWith(expect.objectContaining({
      email: `${"a".repeat(64)}@auth.memecatch.internal`,
    }));
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hashed-token",
      type: "magiclink",
    });
  });

  it("rejects a provider subject already bound to another user", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          access_token: "access-token",
          open_id: "open-id",
          scope: "user.info.basic",
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: { user: { open_id: "open-id", display_name: "Creator" } },
          error: { code: "ok" },
        }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    mocks.identitySelect
      .mockResolvedValueOnce({
        data: {
          internal_email: `${"a".repeat(64)}@auth.memecatch.internal`,
          user_id: "00000000-0000-4000-8000-000000000002",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user_id: "00000000-0000-4000-8000-000000000002" },
        error: null,
      });

    await expect(
      signInWithTikTokCode("code", "https://preview.example/auth/tiktok/callback"),
    ).rejects.toThrow("Supabase TikTok identity binding failed");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("reuses the winning reservation when first-login inserts race", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        open_id: "open-id",
        scope: "user.info.basic",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { user: { open_id: "open-id", display_name: "Creator" } },
        error: { code: "ok" },
      }), { status: 200 })));
    mocks.identityInsert.mockResolvedValueOnce({
      error: { code: "23505" },
    });

    await expect(
      signInWithTikTokCode("code", "https://preview.example/auth/tiktok/callback"),
    ).resolves.toMatchObject({
      userId: "00000000-0000-4000-8000-000000000001",
    });
    expect(mocks.generateLink).toHaveBeenCalledWith(expect.objectContaining({
      email: `${"a".repeat(64)}@auth.memecatch.internal`,
    }));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
