import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.1",
  rateLimit: () => ({ ok: true }),
}));

import { POST } from "./route";

const id = "00000000-0000-4000-8000-000000000001";

async function principalAt(instant: string): Promise<string> {
  vi.setSystemTime(new Date(instant));
  await POST(new Request(`https://memecatch.test/api/memes/${id}/view`, {
    method: "POST",
    headers: { origin: "https://memecatch.test", "user-agent": "test-browser" },
  }), { params: Promise.resolve({ id }) });
  return rpc.mock.calls.at(-1)?.[1].p_principal_hash as string;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("MEMECATCH_SIGNING_SECRET", "test-service-secret");
  rpc.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("meme view principal day", () => {
  it("uses the same principal across UTC midnight within one Seoul day", async () => {
    expect(await principalAt("2026-09-05T23:59:00.000Z"))
      .toBe(await principalAt("2026-09-06T00:01:00.000Z"));
  });

  it("rotates the principal at Seoul midnight", async () => {
    expect(await principalAt("2026-09-06T14:59:00.000Z"))
      .not.toBe(await principalAt("2026-09-06T15:01:00.000Z"));
  });
});
