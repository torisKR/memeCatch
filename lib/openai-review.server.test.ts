import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  getOpenAiReviewModel,
  isOpenAiReviewConfigured,
  OPENAI_REVIEW_REASONING_EFFORT,
  requestOpenAiStructured,
} from "@/lib/openai-review.server";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["approved"],
  properties: { approved: { type: "boolean" } },
} as const;

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_REVIEW_MODEL", "");
  vi.stubEnv("OPENAI_REVIEW_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("OpenAI admin review client", () => {
  it("uses GPT-5.6 Sol high and parses structured Responses output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ output_text: '{"approved":true}' }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestOpenAiStructured<{ approved: boolean }>({
        name: "review_result",
        schema,
        instructions: "Review the item.",
        input: "Item",
      }),
    ).resolves.toEqual({ approved: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(body.model).toBe("gpt-5.6-sol");
    expect(body.reasoning).toEqual({ effort: "high" });
    expect(body.store).toBe(false);
    expect(body.text).toEqual({
      format: {
        type: "json_schema",
        name: "review_result",
        strict: true,
        schema,
      },
    });
    expect(getOpenAiReviewModel()).toBe("gpt-5.6-sol");
    expect(OPENAI_REVIEW_REASONING_EFFORT).toBe("high");
  });

  it("keeps the administrator review model fixed even when an old override remains", () => {
    vi.stubEnv("OPENAI_REVIEW_MODEL", "some-other-model");

    expect(getOpenAiReviewModel()).toBe("gpt-5.6-sol");
  });

  it("reads the raw Responses output shape and reports missing configuration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: [{ content: [{ type: "output_text", text: '{"approved":false}' }] }],
      }),
    }));

    await expect(
      requestOpenAiStructured<{ approved: boolean }>({
        name: "review_result",
        schema,
        instructions: "Review the item.",
        input: "Item",
      }),
    ).resolves.toEqual({ approved: false });

    vi.stubEnv("OPENAI_API_KEY", "");
    expect(isOpenAiReviewConfigured()).toBe(false);
    await expect(
      requestOpenAiStructured({
        name: "review_result",
        schema,
        instructions: "Review the item.",
        input: "Item",
      }),
    ).rejects.toThrow("OPENAI_API_KEY 설정 필요");
  });
});
