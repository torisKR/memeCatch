import { describe, expect, it } from "vitest";
import {
  buildPlusActionPremiumPath,
  buildPlusDailySignalPremiumPath,
  buildPlusGlobalDailyPremiumPath,
  isSafePlusDailySignalFocusId,
  parsePlusActionPremiumSource,
  parsePlusDailySignalFocus,
  parsePlusDailySignalLocale,
  parsePlusDailySignalSource,
} from "@/lib/plus-daily-signal-routing";

describe("Plus Daily Signal routing", () => {
  it("builds a stable premium focus path", () => {
    expect(buildPlusDailySignalPremiumPath("meme-1", "en")).toBe(
      "/premium?focus=meme-1&locale=en&from=daily_signal",
    );
  });

  it("accepts one safe focus value and rejects malformed query input", () => {
    expect(parsePlusDailySignalFocus("meme-1")).toBe("meme-1");
    expect(parsePlusDailySignalFocus(["meme-1", "ignored"])).toBeUndefined();
    expect(parsePlusDailySignalFocus("meme 1")).toBeUndefined();
    expect(parsePlusDailySignalFocus(["<script>"])).toBeUndefined();
    expect(isSafePlusDailySignalFocusId("meme_1")).toBe(true);
    expect(isSafePlusDailySignalFocusId("")).toBe(false);
  });

  it("keeps only supported Daily Signal locales", () => {
    expect(parsePlusDailySignalLocale("en")).toBe("en");
    expect(parsePlusDailySignalLocale(["zh-tw", "ignored"])).toBeUndefined();
    expect(parsePlusDailySignalLocale("fr")).toBeUndefined();
  });

  it("requires one exact Daily Signal source marker", () => {
    expect(parsePlusDailySignalSource("daily_signal")).toBe("daily_signal");
    expect(parsePlusDailySignalSource(undefined)).toBeUndefined();
    expect(parsePlusDailySignalSource("premium")).toBeUndefined();
    expect(parsePlusDailySignalSource(["daily_signal", "other"])).toBeUndefined();
  });

  it("accepts only the supported action sources and preserves the global daily path", () => {
    expect(parsePlusActionPremiumSource("global_daily")).toBe("global_daily");
    expect(parsePlusActionPremiumSource(["global_daily", "daily_signal"])).toBeUndefined();
    expect(parsePlusActionPremiumSource("outcome_history")).toBeUndefined();
    expect(buildPlusActionPremiumPath("meme-1", "ja", "global_daily")).toBe(
      "/premium?focus=meme-1&locale=ja&from=global_daily",
    );
    expect(buildPlusGlobalDailyPremiumPath("meme-1", "en")).toBe(
      "/premium?focus=meme-1&locale=en&from=global_daily",
    );
  });
});
