import { describe, expect, it } from "vitest";
import {
  PLUS_DAILY_SHARE_PACK_LOCALES,
  buildPlusDailySharePack,
  creatorDraftFamilyForChannel,
} from "@/lib/plus-daily-share-pack";
import type { MemeUseKitFacts } from "@/lib/meme-use-kit";

const facts: MemeUseKitFacts = {
  title: "Signal meme",
  summary: "A reviewed meaning.",
  usageNote: "Use it with close friends.",
  caution: "Do not target a real person.",
  safetyLevel: "yellow",
  lifecycleStatus: "rising",
};

describe("buildPlusDailySharePack", () => {
  it.each([
    ["ko", "/memes/a1b2c3-%EC%9B%90%EC%98%81%EC%A0%81%20%EC%82%AC%EA%B3%A0", "/memes/a1b2c3/export", "유행 상태: 급상승", "안전 신호: 맥락 확인"],
    ["en", "/en/memes/a1b2c3-signal%20meme", "/memes/a1b2c3/export?locale=en", "Trend: Rising", "Safety: Check context"],
    ["ja", "/ja/memes/a1b2c3-%E3%82%B7%E3%82%B0%E3%83%8A%E3%83%AB", "/memes/a1b2c3/export?locale=ja", "トレンド: 急上昇", "安全シグナル: 文脈を確認"],
    ["zh", "/zh/memes/a1b2c3-%E4%BF%A1%E5%8F%B7%E8%BF%B7%E5%9B%A0", "/memes/a1b2c3/export?locale=zh", "流行状态: 快速上升", "安全信号: 请确认语境"],
    ["zh-tw", "/zh-tw/memes/a1b2c3-%E8%A8%8A%E8%99%9F%E8%BF%B7%E5%9B%A0", "/memes/a1b2c3/export?locale=zh-tw", "流行狀態: 快速上升", "安全訊號: 請確認語境"],
  ] as const)(
    "builds deterministic %s copy and locale-safe paths",
    (locale, detailPath, expectedExportPath, trendLine, safetyLine) => {
      const slug = {
        ko: "원영적 사고",
        en: "signal meme",
        ja: "シグナル",
        zh: "信号迷因",
        "zh-tw": "訊號迷因",
      }[locale];
      const input = { locale, shortId: "a1b2c3", slug, facts };

      const first = buildPlusDailySharePack(input);
      const second = buildPlusDailySharePack(input);

      expect(first).toEqual(second);
      expect(first.caption).toBe(`Signal meme\nA reviewed meaning.\n${trendLine}`);
      expect(first.safetyNote).toContain(safetyLine);
      expect(first.safetyNote).toContain(facts.usageNote);
      expect(first.safetyNote).toContain(facts.caution);
      expect(first.detailPath).toBe(detailPath);
      expect(first.exportPath).toBe(expectedExportPath);
      expect(first.shareText).toBe(
        `${first.caption}\n\n${first.safetyNote}\n\n${first.detailPath}`,
      );
    },
  );

  it("supports platform-independent copy from a user gesture without browser APIs", () => {
    expect(PLUS_DAILY_SHARE_PACK_LOCALES).toEqual(["ko", "en", "ja", "zh", "zh-tw"]);

    const pack = buildPlusDailySharePack({
      locale: "en",
      shortId: "share/id",
      slug: "reviewed slug",
      facts,
    });

    expect(pack.exportPath).toBe("/memes/share%2Fid/export?locale=en");
    expect(pack.shareText).not.toMatch(/navigator|clipboard|twitter|facebook|instagram/i);
  });

  it("uses only reviewed facts and excludes unrelated AI, user, and private-note fields", () => {
    const untrustedText = "DO NOT SHARE THIS";
    const factsWithUntrustedExtras = {
      ...facts,
      aiSuggestion: untrustedText,
      userInput: untrustedText,
      privateNote: untrustedText,
    } as MemeUseKitFacts;

    const pack = buildPlusDailySharePack({
      locale: "ko",
      shortId: "safe1",
      slug: "검수 밈",
      facts: factsWithUntrustedExtras,
    });

    expect(Object.values(pack).join("\n")).not.toContain(untrustedText);
    expect(pack.caption).toContain(facts.title);
    expect(pack.caption).toContain(facts.summary);
  });

  it("adds a selected reviewed usage example without generating new copy", () => {
    const pack = buildPlusDailySharePack({
      locale: "en",
      shortId: "example1",
      slug: "example-meme",
      facts,
      usageExample: {
        situation: "Team chat",
        text: "Use this when the deadline changes again.",
      },
    });

    expect(pack.shareText).toContain("Use it like this · Team chat");
    expect(pack.shareText).toContain("Use this when the deadline changes again.");
    expect(pack.shareText).toContain("/en/memes/example1-example-meme");
  });

  it("orders the same reviewed draft for the selected channel family", () => {
    expect(creatorDraftFamilyForChannel("instagram")).toBe("visual_short_form");
    expect(creatorDraftFamilyForChannel("x")).toBe("short_social");
    expect(creatorDraftFamilyForChannel("messaging")).toBe("conversation");
    expect(creatorDraftFamilyForChannel("blog")).toBe("long_form");
    expect(creatorDraftFamilyForChannel("other")).toBe("general");

    const shortSocial = buildPlusDailySharePack({
      locale: "en",
      shortId: "channel1",
      slug: "channel-meme",
      facts,
      channel: "x",
    });
    const longForm = buildPlusDailySharePack({
      locale: "en",
      shortId: "channel1",
      slug: "channel-meme",
      facts,
      channel: "blog",
    });

    expect(shortSocial.shareText).not.toBe(longForm.shareText);
    expect(shortSocial.shareText.indexOf(shortSocial.detailPath)).toBeLessThan(
      shortSocial.shareText.indexOf(shortSocial.safetyNote),
    );
    expect(longForm.shareText.indexOf(longForm.safetyNote)).toBeLessThan(
      longForm.shareText.indexOf(longForm.detailPath),
    );
  });
});
