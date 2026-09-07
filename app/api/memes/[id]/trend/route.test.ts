import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  entitlement: vi.fn(),
  data: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: state.entitlement,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => table === "memes"
      ? {
          select: () => ({
            eq: () => ({
              in: () => ({ maybeSingle: async () => ({ data: { id: "00000000-0000-4000-8000-000000000001" }, error: null }) }),
            }),
          }),
        }
      : {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: async () => ({ data: state.data, error: null }),
              }),
            }),
          }),
        },
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  state.entitlement.mockResolvedValue({ signedIn: true, isPremium: true });
  state.data = [
    { date: "2026-07-20", trend_score: 20, views: 2, reactions: 1, comments: 0, saves: 1 },
    { date: "2026-08-18", trend_score: 40, views: 5, reactions: 3, comments: 1, saves: 2 },
  ];
});

describe("Plus trend route", () => {
  it("returns deterministic 30 and 90 day observed summaries", async () => {
    const response = await GET(
      new Request("https://memecatch.test/api/memes/00000000-0000-4000-8000-000000000001/trend"),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      locked: false,
      summaries: [
        { days: 30, direction: "up", confidence: "low", sampleCount: 2, coveragePercent: 7, lastObservedAt: "2026-08-18", startScore: 20, endScore: 40 },
        { days: 90, direction: "up", confidence: "low", sampleCount: 2, coveragePercent: 2, lastObservedAt: "2026-08-18", startScore: 20, endScore: 40 },
      ],
    });
  });
});
