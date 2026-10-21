import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createTrendDraftCompletion } from "./draft-completion.server";

const completionInput = {
  name: "memecatch_evidence_draft" as const,
  instructions: "Use supplied evidence only.",
  jsonSchema: { type: "object", additionalProperties: false },
  input: {
    untrustedSourceData: true as const,
    candidateName: "새 표현",
    suppliedAliases: [],
    evidence: [],
    constraints: {
      operatorReviewRequired: true as const,
      rankingMathAllowed: false as const,
      unsupportedFactsAllowed: false as const,
    },
  },
};

describe("createTrendDraftCompletion", () => {
  it("is disabled by default and in production without the existing provider key", () => {
    expect(createTrendDraftCompletion({})).toBeUndefined();
    expect(createTrendDraftCompletion({
      NODE_ENV: "production",
      RADAR_AI_DRAFT_ENABLED: "true",
    })).toBeUndefined();
  });

  it.each([
    "http://example.com/v1",
    "https://example.com/v1",
    "ftp://127.0.0.1/v1",
    "http://user:password@127.0.0.1:10100/v1",
  ])("rejects unsafe local provider URL %s", (baseUrl) => {
    expect(createTrendDraftCompletion({
      NODE_ENV: "development",
      RADAR_AI_DRAFT_ENABLED: "true",
      OPENCODEX_CONTENT_BASE_URL: baseUrl,
      OPENCODEX_CONTENT_MODEL: "local-model",
    })).toBeUndefined();
  });

  it("allows only a loopback provider outside production and returns parsed JSON", async () => {
    const request = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
    }), { status: 200 }));
    const complete = createTrendDraftCompletion({
      NODE_ENV: "test",
      RADAR_AI_DRAFT_ENABLED: "true",
      OPENCODEX_CONTENT_BASE_URL: "http://127.0.0.1:10100/v1/",
      OPENCODEX_CONTENT_MODEL: "local-model",
      OPENCODEX_CONTENT_API_KEY: "local-secret",
    }, request as unknown as typeof fetch);

    await expect(complete?.(completionInput)).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledOnce();
    const [url, init] = request.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:10100/v1/chat/completions");
    expect(init?.headers).toEqual(expect.objectContaining({ authorization: "Bearer local-secret" }));
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      model: "local-model",
      temperature: 0.2,
      response_format: expect.objectContaining({ type: "json_schema" }),
    }));
  });

  it("uses the fixed OpenRouter origin in production and never leaks a key in failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response("provider detail containing secret", { status: 429 }));
    const complete = createTrendDraftCompletion({
      NODE_ENV: "production",
      RADAR_AI_DRAFT_ENABLED: "true",
      OPENROUTER_API_KEY: "do-not-log-this",
      OPENCODEX_CONTENT_BASE_URL: "http://127.0.0.1:10100/v1",
      OPENCODEX_CONTENT_MODEL: "ignored-local-model",
    }, request as unknown as typeof fetch);

    await expect(complete?.(completionInput)).rejects.toThrow("TREND_DRAFT_PROVIDER_HTTP_429");
    expect(String(request.mock.calls[0][0])).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.stringify(error.mock.calls)).not.toContain("do-not-log-this");
    expect(JSON.stringify(error.mock.calls)).not.toContain("provider detail");
    error.mockRestore();
  });

  it("rejects malformed provider responses with bounded, stable errors", async () => {
    const missingContent = createTrendDraftCompletion({
      NODE_ENV: "test",
      RADAR_AI_DRAFT_ENABLED: "true",
      OPENCODEX_CONTENT_BASE_URL: "http://localhost:10100/v1",
      OPENCODEX_CONTENT_MODEL: "local-model",
    }, async () => new Response(JSON.stringify({ choices: [] })));
    await expect(missingContent?.(completionInput)).rejects.toThrow("TREND_DRAFT_PROVIDER_INVALID_RESPONSE");

    const invalidJson = createTrendDraftCompletion({
      NODE_ENV: "test",
      RADAR_AI_DRAFT_ENABLED: "true",
      OPENCODEX_CONTENT_BASE_URL: "http://localhost:10100/v1",
      OPENCODEX_CONTENT_MODEL: "local-model",
    }, async () => new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] })));
    await expect(invalidJson?.(completionInput)).rejects.toThrow(SyntaxError);
  });
});
