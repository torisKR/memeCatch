import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateMemeConcepts: vi.fn(),
  rateLimit: vi.fn(() => ({ ok: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "127.0.0.1", rateLimit: mocks.rateLimit }));
vi.mock("@/lib/meme-studio.server", () => ({
  MEME_TONES: ["wholesome", "sarcastic", "absurd", "hype"],
  MEME_FORMATS: ["image-macro", "reaction", "caption"],
  generateMemeConcepts: mocks.generateMemeConcepts,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/meme-studio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("meme studio caption concept API", () => {
  it("rejects invalid topic, tone, and format before generation", async () => {
    const response = await POST(request({ topic: "x", tone: "angry", format: "video" }));
    expect(response.status).toBe(400);
    expect(mocks.generateMemeConcepts).not.toHaveBeenCalled();
  });

  it("forwards a trimmed valid concept request", async () => {
    mocks.generateMemeConcepts.mockResolvedValueOnce({ mode: "template", concepts: [] });
    const response = await POST(request({ topic: "  고양이 밈  ", tone: "hype", format: "reaction" }));
    expect(response.status).toBe(200);
    expect(mocks.generateMemeConcepts).toHaveBeenCalledWith(
      { topic: "고양이 밈", tone: "hype", format: "reaction" },
    );
  });

  it("never writes memes — Studio stays JSON-only", async () => {
    mocks.generateMemeConcepts.mockResolvedValueOnce({ mode: "template", concepts: [{ caption: "테스트" }] });
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "app/api/meme-studio/route.ts"), "utf8");
    expect(source).not.toMatch(/from\(["']memes["']\)/);

    const response = await POST(request({ topic: "고양이 밈", tone: "hype", format: "reaction" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mode: "template",
      concepts: [{ caption: "테스트" }],
    });
    expect(mocks.generateMemeConcepts).toHaveBeenCalledTimes(1);
  });
});
