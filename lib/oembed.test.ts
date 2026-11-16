import { afterEach, describe, expect, it, vi } from "vitest";
import { getOEmbed } from "@/lib/oembed";

afterEach(() => vi.unstubAllGlobals());

describe("Instagram oEmbed availability", () => {
  const url = "https://www.instagram.com/p/THISDOESNOTEXIST123/";

  it("classifies Meta's missing-resource response as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      error: { code: 24, error_subcode: 2207045, message: "The requested resource does not exist" },
    }, { status: 400 })));

    await expect(getOEmbed(url)).rejects.toMatchObject({ status: 404, code: "UPSTREAM_ERROR" });
  });

  it.each([
    { code: 24, error_subcode: 1234 },
    { code: 100, error_subcode: 2207045 },
    { code: 4 },
  ])("does not mistake other Meta errors for deleted content: %o", async (error) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error }, { status: 400 })));

    await expect(getOEmbed(url)).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
  });
});
