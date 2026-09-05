import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  generateAdminMemeConcepts: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/meme-studio.server", () => ({
  MEME_TONES: ["wholesome", "sarcastic", "absurd", "hype"],
  MEME_FORMATS: ["image-macro", "reaction", "caption"],
  generateAdminMemeConcepts: mocks.generateAdminMemeConcepts,
}));
vi.mock("@/lib/meme-country", () => ({
  isMemeCountryCode: (value: string) => ["KR", "US", "JP", "GB", "BR", "MX", "CN", "TW", "DE", "FR"].includes(value),
}));

import { POST } from "./route";

function authClient(user: { id: string } | null, role?: string) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: role === "operator", error: null }),
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/admin/meme-studio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("admin meme studio API", () => {
  it("rejects signed-out and non-operator callers before Bedrock generation", async () => {
    mocks.createClient.mockResolvedValueOnce(authClient(null));
    expect((await POST(request({ topic: "퇴근 밈", tone: "hype", format: "caption", country: "KR" }))).status)
      .toBe(401);

    mocks.createClient.mockResolvedValueOnce(authClient({ id: "member" }, "user"));
    expect((await POST(request({ topic: "퇴근 밈", tone: "hype", format: "caption", country: "KR" }))).status)
      .toBe(403);
    expect(mocks.generateAdminMemeConcepts).not.toHaveBeenCalled();
  });

  it("validates input before Bedrock generation", async () => {
    mocks.createClient.mockResolvedValueOnce(authClient({ id: "operator" }, "operator"));
    const response = await POST(request({ topic: "x", tone: "angry", format: "video", country: "ZZ" }));
    expect(response.status).toBe(400);
    expect(mocks.generateAdminMemeConcepts).not.toHaveBeenCalled();
  });

  it("rejects an unsupported country with otherwise valid input", async () => {
    mocks.createClient.mockResolvedValueOnce(authClient({ id: "operator" }, "operator"));
    const response = await POST(request({
      topic: "퇴근 밈",
      tone: "hype",
      format: "caption",
      country: "ZZ",
    }));
    expect(response.status).toBe(400);
    expect(mocks.generateAdminMemeConcepts).not.toHaveBeenCalled();
  });

  it("returns exactly the Bedrock-compatible result for an operator", async () => {
    mocks.createClient.mockResolvedValueOnce(authClient({ id: "operator" }, "operator"));
    mocks.generateAdminMemeConcepts.mockResolvedValueOnce({
      mode: "ai",
      provider: "bedrock",
      concepts: [0, 1, 2].map((index) => ({ headline: `초안 ${index}` })),
    });
    const response = await POST(request({ topic: "  퇴근 밈  ", tone: "hype", format: "caption", country: "US" }));
    expect(response.status).toBe(200);
    expect(mocks.generateAdminMemeConcepts).toHaveBeenCalledWith({
      topic: "퇴근 밈",
      tone: "hype",
      format: "caption",
      country: "US",
    });
    await expect(response.json()).resolves.toMatchObject({ mode: "ai", provider: "bedrock" });
  });

  it("returns a stable 503 without provider details when generation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createClient.mockResolvedValueOnce(authClient({ id: "operator" }, "operator"));
    mocks.generateAdminMemeConcepts.mockRejectedValueOnce(new Error("private provider detail"));

    const response = await POST(request({
      topic: "퇴근 밈",
      tone: "hype",
      format: "caption",
      country: "FR",
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "bedrock_unavailable" });
    expect(consoleError).toHaveBeenCalledWith("meme_studio_bedrock_unavailable");
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("private"));
  });
});
