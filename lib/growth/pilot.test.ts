import { describe, expect, it } from "vitest";
import { parseGrowthPilotDashboard, summarizeGrowthPilot } from "./pilot";

describe("growth English pilot", () => {
  it("keeps the external interview gate closed until ten real records exist", () => {
    const dashboard = parseGrowthPilotDashboard({
      slots: Array.from({ length: 20 }, (_, index) => ({
        slot: index + 1,
        memeId: index === 0 ? "11111111-1111-4111-8111-111111111111" : null,
        status: index === 0 ? "published" : "open",
        operatorNote: "",
        publishedAt: index === 0 ? "2026-08-18T00:00:00.000Z" : null,
        translationCurrent: index === 0,
        title: index === 0 ? "테스트 밈" : null,
        englishTitle: index === 0 ? "Test meme" : null,
        landingPath: index === 0 ? "/en/memes/test-meme" : null,
      })),
      candidates: [],
      interviewCount: 0,
      interviews: [],
    });

    expect(summarizeGrowthPilot(dashboard)).toEqual({
      totalSlots: 20,
      assigned: 1,
      ready: 1,
      published: 1,
      stale: 0,
      interviews: 0,
      interviewGateMet: false,
      complete: false,
    });
  });

  it("requires all twenty published slots and ten interviews for completion", () => {
    const dashboard = parseGrowthPilotDashboard({
      slots: Array.from({ length: 20 }, (_, index) => ({
        slot: index + 1,
        memeId: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
        status: "published",
        operatorNote: "",
        publishedAt: "2026-08-18T00:00:00.000Z",
        translationCurrent: true,
        title: "테스트 밈",
        englishTitle: "Test meme",
        landingPath: "/en/memes/test-meme",
      })),
      candidates: [],
      interviewCount: 10,
      interviews: [],
    });

    expect(summarizeGrowthPilot(dashboard).complete).toBe(true);
  });

  it("does not count a stale or incomplete translation as a published landing", () => {
    const dashboard = parseGrowthPilotDashboard({
      slots: Array.from({ length: 20 }, (_, index) => ({
        slot: index + 1,
        memeId: index === 0 ? "11111111-1111-4111-8111-111111111111" : null,
        status: index === 0 ? "published" : "open",
        operatorNote: "",
        publishedAt: index === 0 ? "2026-08-18T00:00:00.000Z" : null,
        translationCurrent: false,
        title: index === 0 ? "테스트 밈" : null,
        englishTitle: index === 0 ? "Test meme" : null,
        landingPath: null,
      })),
      candidates: [],
      interviewCount: 10,
      interviews: [],
    });

    expect(summarizeGrowthPilot(dashboard)).toMatchObject({ published: 0, stale: 1, complete: false });
  });

  it("rejects malformed dashboard payloads at the database boundary", () => {
    expect(() =>
      parseGrowthPilotDashboard({ slots: [], candidates: [], interviewCount: -1, interviews: [] }),
    ).toThrow();
  });
});
