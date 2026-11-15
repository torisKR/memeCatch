import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("auth callback redirect", () => {
  it("keeps a valid same-origin return path", async () => {
    const response = await GET(
      new NextRequest("https://catchmeme.com/auth/callback?code=ok&next=%2Fexplore%3Fsort%3Drecent"),
    );

    expect(response.headers.get("location")).toBe(
      "https://catchmeme.com/explore?sort=recent",
    );
  });

  it("keeps the password-reset callback destination", async () => {
    const response = await GET(
      new NextRequest("https://catchmeme.com/auth/callback?code=ok&next=%2Freset-password"),
    );

    expect(response.headers.get("location")).toBe(
      "https://catchmeme.com/reset-password",
    );
  });

  it.each([
    "%2F%5Cevil.example%2Fphishing",
    "%2F%252F%252Fevil.example%2Fphishing",
    "%2F%252e%252e%2F%2Fevil.example%2Fphishing",
  ])("rejects an encoded cross-origin return path: %s", async (next) => {
    const response = await GET(
      new NextRequest(`https://catchmeme.com/auth/callback?code=ok&next=${next}`),
    );

    expect(response.headers.get("location")).toBe("https://catchmeme.com/");
  });

  it("does not trust the request origin when building the success redirect", async () => {
    const response = await GET(
      new NextRequest("https://evil.example/auth/callback?code=ok&next=%2Fexplore"),
    );

    expect(response.headers.get("location")).toBe("https://catchmeme.com/explore");
  });

  it("does not trust the request origin when building the error redirect", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("invalid code") });

    const response = await GET(
      new NextRequest("https://evil.example/auth/callback?code=bad"),
    );

    expect(response.headers.get("location")).toBe(
      "https://catchmeme.com/login?error=auth",
    );
  });
});
