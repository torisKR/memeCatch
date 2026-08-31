import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  return {
    generateBedrock: vi.fn(),
    rpc,
    createAdminClient: vi.fn(() => ({ rpc })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/meme-studio-bedrock.server", () => ({
  BEDROCK_MEME_STUDIO_MODEL_ID: "apac.amazon.nova-micro-v1:0",
  BedrockMemeStudioError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  generateBedrockMemeConcepts: mocks.generateBedrock,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import {
  generateAdminMemeConcepts,
  generateMemeConcepts,
} from "@/lib/meme-studio.server";

const concepts = [0, 1, 2].map((index) => ({
  headline: `AI ${index}`,
  caption: `caption ${index}`,
  why_it_works: "reason",
  usage_context: "context",
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
});

describe("meme studio concepts", () => {
  it("keeps the public Studio deterministic and never reaches Bedrock or a budget client", async () => {
    const input = { topic: "고양이", tone: "hype", format: "reaction" } as const;
    expect(await generateMemeConcepts(input)).toEqual(await generateMemeConcepts(input));
    expect(await generateMemeConcepts(input)).toMatchObject({ mode: "template" });
    expect(mocks.generateBedrock).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("changes public output for requested tone and format while keeping exactly 3 concepts", async () => {
    const image = await generateMemeConcepts({ topic: "고양이", tone: "hype", format: "image-macro" });
    const reaction = await generateMemeConcepts({ topic: "고양이", tone: "sarcastic", format: "reaction" });
    expect(image.concepts).toHaveLength(3);
    expect(reaction.concepts).toHaveLength(3);
    expect(image.concepts[0].caption).not.toBe(reaction.concepts[0].caption);
  });

  it("reserves the $100 ledger before returning Bedrock concepts to an admin", async () => {
    mocks.generateBedrock.mockImplementationOnce(async (_input, deps) => {
      await deps.reserveCost(123_456);
      return {
        concepts,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        reservedNanoUsd: 123_456,
      };
    });

    await expect(generateAdminMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" }))
      .resolves.toEqual({ mode: "ai", provider: "bedrock", concepts });
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_bedrock_meme_studio_budget", {
      p_model_profile: "apac.amazon.nova-micro-v1:0",
      p_estimated_cost_nano_usd: 123_456,
    });
  });

  it("fails closed on budget rejection and still returns exactly 3 template concepts", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ error: { message: "budget exhausted" } });
    mocks.generateBedrock.mockImplementationOnce(async (_input, deps) => {
      await deps.reserveCost(123_456);
      throw new Error("generation must not continue");
    });

    const result = await generateAdminMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" });
    expect(result.mode).toBe("template");
    expect(result.concepts).toHaveLength(3);
    expect(consoleError).toHaveBeenCalledWith("meme_studio_bedrock_fallback", "unexpected");
  });

  it("normalizes Bedrock copy and falls back without exposing provider details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.generateBedrock
      .mockResolvedValueOnce({
        concepts: concepts.map((concept, index) => index === 0
          ? { ...concept, caption: "앞\u2014뒤\u2013문구" }
          : concept),
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        reservedNanoUsd: 1,
      })
      .mockRejectedValueOnce(new Error("secret provider detail"));

    const first = await generateAdminMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" });
    expect(first.concepts[0].caption).toBe("앞-뒤-문구");
    await expect(generateAdminMemeConcepts({ topic: "강아지", tone: "hype", format: "caption" }))
      .resolves.toMatchObject({ mode: "template" });
    expect(consoleError).toHaveBeenCalledWith("meme_studio_bedrock_fallback", "unexpected");
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("secret"));
  });
});
