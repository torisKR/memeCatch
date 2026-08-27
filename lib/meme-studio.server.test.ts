import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  return {
    configured: vi.fn(() => false),
    model: vi.fn(() => "stealth/ox-alpha"),
    request: vi.fn(),
    rpc,
    createAdminClient: vi.fn(() => ({ rpc })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mpe/openrouter.server", () => ({
  DEFAULT_MPE_MODEL: "stealth/ox-alpha",
  getMpeVisionModel: mocks.model,
  isOpenRouterConfigured: mocks.configured,
  OPENROUTER_BUDGET_RESERVATION_FAILED: "openrouter_budget_reservation_failed",
  OPENROUTER_DAILY_BUDGET_EXHAUSTED: "openrouter_daily_budget_exhausted",
  requestOpenRouterStructured: mocks.request,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { generateMemeConcepts, isMemeStudioAiEnabled } from "@/lib/meme-studio.server";

const aiConcepts = [0, 1, 2].map((index) => ({
  headline: `AI ${index}`,
  caption: `caption ${index}`,
  why_it_works: "reason",
  usage_context: "context",
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(false);
  mocks.model.mockReturnValue("stealth/ox-alpha");
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });
});

describe("meme studio deterministic concepts", () => {
  it("changes output for both tone and requested format", async () => {
    const image = await generateMemeConcepts({ topic: "고양이", tone: "hype", format: "image-macro" });
    const reaction = await generateMemeConcepts({ topic: "고양이", tone: "hype", format: "reaction" });
    const sarcastic = await generateMemeConcepts({ topic: "고양이", tone: "sarcastic", format: "reaction" });
    expect(image.concepts[0].caption).not.toBe(reaction.concepts[0].caption);
    expect(reaction.concepts[0].caption).toContain("내 반응:");
    expect(sarcastic.concepts[0].caption).not.toBe(reaction.concepts[0].caption);
  });

  it("keeps deterministic template UI copy Korean and free of typographic dashes", async () => {
    for (const tone of ["wholesome", "sarcastic", "absurd", "hype"] as const) {
      const { concepts } = await generateMemeConcepts({ topic: "고양이\u2014강아지", tone, format: "caption" });
      for (const concept of concepts) {
        const copy = Object.values(concept).join(" ");
        expect(copy).toMatch(/[가-힣]/);
        expect(copy).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });

  it("enables the AI label only for configured exact Ox Alpha", () => {
    mocks.configured.mockReturnValue(true);
    expect(isMemeStudioAiEnabled()).toBe(true);
    mocks.model.mockImplementationOnce(() => { throw new Error("wrong model"); });
    expect(isMemeStudioAiEnabled()).toBe(false);
  });

  it("reserves only the Studio budget for exact Ox Alpha before returning AI concepts", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.request.mockImplementationOnce(async (input) => {
      await input.reserveRequest();
      return { concepts: aiConcepts };
    });

    await expect(generateMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" }))
      .resolves.toEqual({ mode: "ai", concepts: aiConcepts });
    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_meme_studio_daily_ai_request", {
      p_provider: "openrouter",
      p_model: "stealth/ox-alpha",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("reserve_openrouter_daily_request", expect.anything());
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({
      name: "meme_concepts",
      reserveRequest: expect.any(Function),
    }));
  });

  it("keeps the deterministic template when the daily free budget is exhausted", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configured.mockReturnValue(true);
    mocks.rpc.mockResolvedValueOnce({ error: { details: "meme_studio_daily_ai_budget_exhausted" } });
    mocks.request.mockImplementationOnce(async (input) => {
      await input.reserveRequest();
      return { concepts: aiConcepts };
    });

    const result = await generateMemeConcepts({ topic: "고양이", tone: "hype", format: "reaction" });
    expect(result.mode).toBe("template");
    expect(result.concepts).toHaveLength(3);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_meme_studio_daily_ai_request", {
      p_provider: "openrouter",
      p_model: "stealth/ox-alpha",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("reserve_openrouter_daily_request", expect.anything());
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("records a deployment signal and keeps the template when the Studio quota RPC is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configured.mockReturnValue(true);
    mocks.rpc.mockResolvedValueOnce({
      error: { code: "PGRST202", message: "Could not find reserve_meme_studio_daily_ai_request" },
    });
    mocks.request.mockImplementationOnce(async (input) => {
      await input.reserveRequest();
      return { concepts: aiConcepts };
    });

    await expect(generateMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" }))
      .resolves.toMatchObject({ mode: "template" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("reserve_openrouter_daily_request", expect.anything());
    expect(consoleError).toHaveBeenCalledWith("meme_studio_ai_quota_rpc_missing");
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("PGRST202"));
  });

  it("keeps the deterministic template when Ox Alpha temporarily fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configured.mockReturnValue(true);
    mocks.request.mockRejectedValue(new Error("openrouter_structured_failed:503"));

    const input = { topic: "고양이", tone: "hype", format: "reaction" } as const;
    const first = await generateMemeConcepts(input);
    const second = await generateMemeConcepts(input);
    expect(first).toEqual(second);
    expect(first.mode).toBe("template");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("records a stable AI failure code without exposing provider details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configured.mockReturnValue(true);
    mocks.request.mockRejectedValueOnce(new Error("openrouter_structured_failed:402 provider_message=secret"));

    await expect(generateMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" }))
      .resolves.toMatchObject({ mode: "template" });
    expect(consoleError).toHaveBeenCalledWith(
      "meme_studio_ai_generation_failed",
      "openrouter_structured_failed:402",
    );
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("secret"));
  });

  it("records stable empty and invalid response codes", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.configured.mockReturnValue(true);
    mocks.request
      .mockRejectedValueOnce(new Error("openrouter_structured_failed_empty"))
      .mockResolvedValueOnce({ concepts: { not: "an array" } });

    await generateMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" });
    await generateMemeConcepts({ topic: "강아지", tone: "hype", format: "caption" });

    expect(consoleError).toHaveBeenNthCalledWith(
      1,
      "meme_studio_ai_generation_failed",
      "openrouter_structured_failed_empty",
    );
    expect(consoleError).toHaveBeenNthCalledWith(
      2,
      "meme_studio_ai_generation_failed",
      "openrouter_structured_invalid",
    );
  });

  it("requires exactly three valid AI concepts", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.request.mockResolvedValueOnce({ concepts: [...aiConcepts, aiConcepts[0]] });

    await expect(generateMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" }))
      .resolves.toMatchObject({ mode: "template" });
  });

  it("normalizes typographic dashes from AI output before display", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.request.mockResolvedValueOnce({
      concepts: aiConcepts.map((concept, index) => index === 0
        ? { ...concept, caption: "앞\u2014뒤\u2013문구" }
        : concept),
    });

    const result = await generateMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" });
    expect(result.mode).toBe("ai");
    expect(result.concepts[0].caption).toBe("앞-뒤-문구");
  });

  it("does not create a service-role client when OpenRouter is not configured", async () => {
    await expect(generateMemeConcepts({ topic: "고양이", tone: "hype", format: "caption" }))
      .resolves.toMatchObject({ mode: "template" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
