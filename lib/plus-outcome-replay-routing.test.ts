import { describe, expect, it } from "vitest";
import {
  buildPlusOutcomeReplayPath,
  parsePlusOutcomeReplayRequest,
  parsePlusOutcomeReplayShortId,
} from "@/lib/plus-outcome-replay-routing";

describe("plus outcome replay routing", () => {
  it("accepts one public short id and builds an internal premium path", () => {
    expect(parsePlusOutcomeReplayShortId("meme-1_global")).toBe("meme-1_global");
    expect(buildPlusOutcomeReplayPath("meme-1_global", "en")).toBe(
      "/premium?replay=meme-1_global&replay_locale=en&from=outcome_history",
    );
  });

  it("fails closed for duplicate, empty, or URL-shaped values", () => {
    expect(parsePlusOutcomeReplayShortId(["meme-1", "meme-2"])).toBeNull();
    expect(parsePlusOutcomeReplayShortId(" ")).toBeNull();
    expect(parsePlusOutcomeReplayShortId("meme-1/../../private")).toBeNull();
    expect(buildPlusOutcomeReplayPath("meme-1?next=private", "en")).toBeNull();
  });

  it("requires the exact outcome-history source and rejects mixed modes", () => {
    expect(
      parsePlusOutcomeReplayRequest({
        shortId: "meme-1",
        locale: "en",
        source: "outcome_history",
      }),
    ).toEqual({ shortId: "meme-1", locale: "en" });
    expect(
      parsePlusOutcomeReplayRequest({
        shortId: "meme-1",
        locale: "en",
        source: "daily_signal",
      }),
    ).toBeNull();
    expect(
      parsePlusOutcomeReplayRequest({
        shortId: "meme-1",
        locale: "en",
        source: "outcome_history",
        focus: ["daily-meme"],
      }),
    ).toBeNull();
  });
});
