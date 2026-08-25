import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  recognizeImageText,
  requestOpenRouterStructured,
} from "./openrouter.server";

function chatResponse(content: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function rateLimitResponse(payload: unknown = {
  error: { message: "upstream_provider_shared_pool", metadata: { raw: "shared pool exhausted" } },
}) {
  return new Response(JSON.stringify(payload), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "0" },
  });
}

function transientResponse(status: 502 | 503 | 504) {
  return new Response(JSON.stringify({ error: { message: `temporary ${status}` } }), {
    status,
    headers: { "content-type": "application/json", "retry-after": "0" },
  });
}

describe("MPE OpenRouter adapter", () => {
  beforeEach(() => vi.stubEnv("OPENROUTER_API_KEY", "test-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends OCR through Chat Completions with text before the data URI image", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(chatResponse({ segments: [{
      rawText: " 밈 캐치 ", normalizedText: "밈 캐치", language: "ko", confidence: 0.9,
      boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    }] }));

    await expect(recognizeImageText({ bytes: Uint8Array.from([1, 2]), mimeType: "image/png", frameMs: 500 }))
      .resolves.toMatchObject([{ origin: "ocr", startMs: 500, rawText: " 밈 캐치 " }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.headers).toMatchObject({ authorization: "Bearer test-key", "content-type": "application/json" });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "stealth/ox-alpha", response_format: { type: "json_object" } });
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[0].content).toContain("mpe_ocr_segments");
    expect(body.messages[1].content[0]).toMatchObject({ type: "text" });
    expect(body.messages[1].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AQI=" },
    });
  });

  it("rejects OCR JSON that does not pass the server-side schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(chatResponse({ segments: [{ rawText: "missing fields" }] }));
    await expect(recognizeImageText({ bytes: Uint8Array.from([1]), mimeType: "image/png", frameMs: 0 }))
      .rejects.toThrow("openrouter_ocr_invalid");
  });

  it("rejects any structured-draft model other than Ox Alpha", async () => {
    vi.stubEnv("OPENROUTER_MPE_MODEL", "custom/structured-model");
    vi.stubEnv("OPENROUTER_BASE_URL", "https://router.test/v1/");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(chatResponse({ claims: [] }));

    await expect(requestOpenRouterStructured({
      name: "mpe_evidence_draft",
      schema: { type: "object", required: ["claims"] },
      instructions: "Use evidence only.",
      input: JSON.stringify({ evidence: [] }),
      maxOutputTokens: 123,
    })).rejects.toThrow("OPENROUTER_MPE_MODEL must be stealth/ox-alpha");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries Chat Completions up to three attempts after shared-pool rate limits", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(chatResponse({ claims: [] }));

    await expect(requestOpenRouterStructured({
      name: "mpe_evidence_draft",
      schema: { type: "object" },
      instructions: "Use evidence only.",
      input: "{}",
    })).resolves.toEqual({ claims: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([502, 503, 504] as const)("retries transient HTTP %s responses", async (status) => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(transientResponse(status))
      .mockResolvedValueOnce(chatResponse({ claims: [] }));

    await expect(requestOpenRouterStructured({
      name: "mpe_evidence_draft",
      schema: { type: "object" },
      instructions: "Use evidence only.",
      input: "{}",
    })).resolves.toEqual({ claims: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient fetch failures up to three total attempts", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("socket reset"))
      .mockRejectedValueOnce(new TypeError("socket reset"))
      .mockResolvedValueOnce(chatResponse({ claims: [] }));

    const promise = requestOpenRouterStructured({
      name: "mpe_evidence_draft",
      schema: { type: "object" },
      instructions: "Use evidence only.",
      input: "{}",
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ claims: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("caps Retry-After delays and still limits the request to three attempts", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") callback();
      return 0;
    }) as typeof setTimeout);
    const retryAfterResponse = () => new Response(JSON.stringify({ error: { message: "busy" } }), {
      status: 503,
      headers: { "content-type": "application/json", "retry-after": "999" },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockImplementation(async () => retryAfterResponse());

    await expect(requestOpenRouterStructured({
      name: "mpe_evidence_draft",
      schema: { type: "object" },
      instructions: "Use evidence only.",
      input: "{}",
    })).rejects.toThrow("openrouter_structured_failed:503 provider_message=busy");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(timeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 10_000);
    expect(timeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 10_000);
  });

  it("sanitizes provider diagnostics after the final rate-limit attempt", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "super-secret-router-key");
    const finalPayload = {
      error: {
        message: "upstream_provider_shared_pool Bearer super-secret-router-key",
        metadata: { raw: "pool exhausted sk-or-v1-abcdef123456 super-secret-router-key" },
      },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(rateLimitResponse(finalPayload));

    const promise = requestOpenRouterStructured({
      name: "mpe_evidence_draft",
      schema: { type: "object" },
      instructions: "Use evidence only.",
      input: "{}",
    });
    await expect(promise).rejects.toThrow(
      "openrouter_structured_failed:429 provider_message=upstream_provider_shared_pool Bearer [redacted] metadata_raw=pool exhausted [redacted] [redacted]",
    );
    await expect(promise).rejects.not.toThrow("super-secret-router-key");
    await expect(promise).rejects.not.toThrow("sk-or-v1-abcdef123456");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns exact configuration and upstream error codes without live calls", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(recognizeImageText({ bytes: Uint8Array.from([1]), mimeType: "image/png", frameMs: 0 }))
      .rejects.toThrow("OPENROUTER_API_KEY 설정 필요");

    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => rateLimitResponse({ error: "denied" }));
    await expect(recognizeImageText({ bytes: Uint8Array.from([1]), mimeType: "image/png", frameMs: 0 }))
      .rejects.toThrow("openrouter_ocr_failed:429");
  });
});
