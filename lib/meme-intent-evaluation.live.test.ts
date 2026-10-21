import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { classifyMemeIntent } from "./meme-intent.server";
import {
  evaluateMemeIntentCases,
  MEME_INTENT_EVALUATION_CASES,
  summarizeMemeIntentEvaluation,
} from "./meme-intent-evaluation";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("retired provider evaluation path", () => {
  it("stays offline even when legacy live-evaluation settings remain", async () => {
    vi.stubEnv("MEME_LAYA_LIVE_EVAL", "true");
    vi.stubEnv("MEME_LAYA_ROUTING_ENABLED", "true");
    vi.stubEnv("AI_GATEWAY_API_KEY", "legacy-secret");
    const fetchMock = vi.fn(() => Promise.reject(new Error("must not run")));
    vi.stubGlobal("fetch", fetchMock);

    const outcomes = await evaluateMemeIntentCases({
      cases: MEME_INTENT_EVALUATION_CASES,
      classify: classifyMemeIntent,
    });

    expect(summarizeMemeIntentEvaluation(outcomes).approval).toBe("approved");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
