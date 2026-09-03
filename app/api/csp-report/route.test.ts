import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn((): { ok: boolean; retryAfterSec?: number } => ({ ok: true })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.20",
  rateLimit: mocks.rateLimit,
}));

import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  mocks.rateLimit.mockReset();
  mocks.rateLimit.mockReturnValue({ ok: true });
});

describe("CSP report API", () => {
  it("drops oversized bodies without parsing or logging", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await POST(new Request("https://catchmeme.com/api/csp-report", {
      method: "POST",
      headers: { "content-length": String(17 * 1024) },
      body: "not-json",
    }));

    expect(response.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("bounds report fan-out and removes control characters from logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reports = Array.from({ length: 25 }, (_, index) => ({
      body: {
        "effective-directive": `script-src\nforged-${index}\u2028more`,
        "blocked-uri": `https://example.test/${index}\r\n[FAKE]`,
        "document-uri": `https://catchmeme.com/${index}`,
      },
    }));

    const response = await POST(new Request("https://catchmeme.com/api/csp-report", {
      method: "POST",
      body: JSON.stringify(reports),
    }));

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(20);
    for (const [message] of warn.mock.calls) {
      expect(message).not.toMatch(/[\r\n\u2028\u2029]/);
    }
  });

  it("rate limits before reading or logging the report", async () => {
    mocks.rateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 12 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await POST(new Request("https://catchmeme.com/api/csp-report", {
      method: "POST",
      body: "not-json",
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      "csp-report:203.0.113.20",
      { limit: 60, windowMs: 60_000 },
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
