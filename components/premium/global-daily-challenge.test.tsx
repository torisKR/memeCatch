// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemeMarketPassport } from "@/components/meme-market-passport";
import { GlobalDailyChallenge } from "@/components/premium/global-daily-challenge";
import { track } from "@/lib/analytics";
import type { QuizQuestion } from "@/lib/quiz";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

const questions: QuizQuestion[] = [
  {
    question: "「Global One」, what does it mean?",
    options: ["The first meaning", "Another meaning", "A third meaning", "A fourth meaning"],
    answerIndex: 0,
    meme: { shortId: "one", slug: "global-one", title: "Global One", originYear: 2024, safetyLevel: "green" },
  },
  {
    question: "「Global Two」, what does it mean?",
    options: ["The first meaning", "Another meaning", "A third meaning", "A fourth meaning"],
    answerIndex: 1,
    meme: { shortId: "two", slug: "global-two", title: "Global Two", originYear: 2024, safetyLevel: "yellow" },
  },
  {
    question: "「Global Three」, what does it mean?",
    options: ["The first meaning", "Another meaning", "A third meaning", "A fourth meaning"],
    answerIndex: 2,
    meme: { shortId: "three", slug: "global-three", title: "Global Three", originYear: 2024, safetyLevel: "gray" },
  },
];

const marketPassport = {
  origin: {
    memeId: "meme-1",
    marketCode: "KR",
    languageTag: "ko",
    role: "origin" as const,
    localTitle: "Global One",
    localAliases: [],
    usageNote: null,
    caution: null,
  },
  profiles: [],
  variants: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => vi.clearAllMocks());

describe("GlobalDailyChallenge", () => {
  it.each([
    ["ko", "오늘의 글로벌 밈 3문제", "/login?next=%2Fdaily"],
    ["en", "Three global memes for today", "/en/pricing"],
    ["ja", "今日のグローバルミーム3問", "/ja/pricing"],
    ["zh", "今天的全球迷因：3道题", "/zh/pricing"],
    ["zh-tw", "今天的全球迷因：3 道題", "/zh-tw/pricing"],
  ] as const)("renders the localized gate for %s", (locale, title, href) => {
    render(
      <GlobalDailyChallenge
        locale={locale}
        challengeDate="2026-08-09"
        state={locale === "ko" ? "signed_out" : "locked"}
        questions={questions}
     />,
   );
   expect(screen.getByRole("region", { name: title })).toBeTruthy();
    expect(document.querySelector("[data-global-daily-next-step]")).toBeNull();
    expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-08-09");
    if (locale === "ko") {
      expect(screen.getByRole("link", { name: "로그인하고 시작하기" }).getAttribute("href")).toBe(href);
    } else {
      expect(screen.getByRole("link", { name: /Plus/ }).getAttribute("href")).toBe(href);
    }
  });

  it("posts only the locale once after the third question and shows the streak", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          completed: true,
          alreadyCompleted: false,
          challengeDate: "2026-08-09",
          locale: "en",
          currentStreak: 2,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GlobalDailyChallenge
        locale="en"
        displayLocale="th"
        challengeDate="2026-08-09"
        state="ready"
        questions={questions}
        showReviewShelf
        marketPassport={<MemeMarketPassport locale="en" passport={marketPassport} />}
      />,
    );
    expect(document.querySelector("[data-global-daily-market-passport]")).toBeNull();
    const region = screen.getByRole("region", { name: "Three global memes for today" });
    expect(region.getAttribute("lang")).toBe("en-US");
    expect(region.getAttribute("data-global-daily-content-locale")).toBe("en");
    expect(region.getAttribute("data-global-daily-display-locale")).toBe("th");
    expect(screen.getByText("Content language: English")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start the first question" }));
    expect(track).toHaveBeenCalledWith(
      "global_daily_start",
      expect.objectContaining({ locale: "en", display_locale: "th" }),
    );

    for (const [answer, nextName] of [["The first meaning", "Next question"], ["Another meaning", "Next question"], ["A third meaning", "Finish and save streak"]] as const) {
      fireEvent.click(screen.getByRole("button", { name: answer }));
      fireEvent.click(screen.getByRole("button", { name: nextName }));
    }

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plus/global-daily/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ locale: "en" }),
      }),
    );
    expect(track).toHaveBeenCalledWith(
      "global_daily_complete",
      expect.objectContaining({ locale: "en", display_locale: "th", score: 3 }),
    );
    expect(document.querySelector("[data-global-daily-market-passport]")).toBeTruthy();
    const reviewItems = Array.from(
      document.querySelectorAll<HTMLElement>("[data-global-daily-review-item]"),
    );
    expect(reviewItems).toHaveLength(3);
    expect(reviewItems.map((item) => item.dataset.globalDailyReviewItem)).toEqual(["one", "two", "three"]);
    expect(reviewItems[0]?.textContent).toContain("The first meaning");
    expect(reviewItems[0]?.textContent).toContain("Generally usable");
    expect(reviewItems[1]?.textContent).toContain("Another meaning");
    expect(reviewItems[1]?.textContent).toContain("Check context");
    expect(reviewItems[2]?.textContent).toContain("A third meaning");
    expect(reviewItems[2]?.textContent).toContain("Mostly dated");
    expect(screen.getByRole("link", { name: "Open the Use Kit: Global One" }).className).toContain("min-h-11");
    expect(screen.getByRole("link", { name: "Open the Use Kit: Global One" }).getAttribute("href")).toBe(
      "/en/memes/one-global-one#meme-use-kit-title",
    );
    expect(screen.getByRole("link", { name: "Open the Use Kit: Global Two" }).getAttribute("href")).toBe(
      "/en/memes/two-global-two#meme-use-kit-title",
    );
    expect(screen.getByRole("link", { name: "Open the Use Kit: Global Three" }).getAttribute("href")).toBe(
      "/en/memes/three-global-three#meme-use-kit-title",
    );
    expect(screen.getAllByRole("link", { name: /Open the Use Kit:/ })).toHaveLength(3);
   expect(screen.getByRole("status").textContent).toContain("2-day streak");
   expect(screen.getByRole("status").textContent).toContain("3 of 3 correct");
 });

  it("keeps UI-only gate links on the unprefixed locale-aware routes", () => {
    render(
      <GlobalDailyChallenge
        locale="en"
        displayLocale="th"
        challengeDate="2026-08-09"
        state="signed_out"
        questions={questions}
      />,
    );

    expect(screen.getByRole("link", { name: "Sign in to start" }).getAttribute("href")).toBe(
      "/login?next=%2Fdaily",
    );

    cleanup();
    render(
      <GlobalDailyChallenge
        locale="en"
        displayLocale="th"
        challengeDate="2026-08-09"
        state="locked"
        questions={questions}
      />,
    );

    expect(screen.getByRole("link", { name: "Open today’s meme with Plus" }).getAttribute("href")).toBe(
      "/pricing",
    );
  });

  it("keeps the localized use handoff when the challenge is already completed", () => {
    render(
      <GlobalDailyChallenge
        locale="ja"
        challengeDate="2026-08-09"
        state="completed"
        questions={questions}
        currentStreak={4}
        showReviewShelf
        marketPassport={<MemeMarketPassport locale="ja" passport={marketPassport} />}
      />,
    );

    expect(document.querySelector("[data-global-daily-next-step]")).toBeNull();
    expect(document.querySelector("[data-global-daily-market-passport]")).toBeTruthy();
    expect(screen.getByText("今日の3つを復習")).toBeTruthy();
    expect(document.querySelector("[data-market-passport]")).toBeNull();
    expect(screen.getByRole("link", { name: "活用キットを開く: Global One" }).getAttribute("href")).toBe(
      "/ja/memes/one-global-one#meme-use-kit-title",
    );
    expect(document.querySelectorAll("[data-global-daily-review-item]")).toHaveLength(3);
    expect(screen.getByText("Global Two")).toBeTruthy();
    expect(screen.getByText("Global Three")).toBeTruthy();
    expect(screen.getByRole("link", { name: "活用キットを開く: Global Two" }).getAttribute("href")).toBe(
      "/ja/memes/two-global-two#meme-use-kit-title",
    );
  });

  it("does not reveal the completion passport before the challenge is finished", () => {
    render(
      <GlobalDailyChallenge
        locale="en"
        challengeDate="2026-08-09"
        state="ready"
        questions={questions}
        marketPassport={<MemeMarketPassport locale="en" passport={marketPassport} />}
      />,
    );

    expect(document.querySelector("[data-global-daily-market-passport]")).toBeNull();
  });

  it("keeps the review shelf opt-in so standalone daily stays unchanged", () => {
    render(
      <GlobalDailyChallenge
        locale="en"
        challengeDate="2026-08-09"
        state="completed"
        questions={questions}
        currentStreak={4}
      />,
    );

    expect(document.querySelector("[data-global-daily-review-shelf]")).toBeNull();
  });

  it("shows a One-Cut handoff only for server-approved review items", () => {
    render(
      <GlobalDailyChallenge
        locale="en"
        challengeDate="2026-08-09"
        state="completed"
        questions={questions}
        currentStreak={4}
        showReviewShelf
        oneCutHandoffByMemeId={{
          one: "/premium?focus=meme-one&locale=en&from=global_daily#plus-global-action-inbox-title",
          two: "https://example.com/should-not-render",
        }}
      />,
    );

    const oneCutLinks = screen.getAllByRole("link", { name: /Prepare One-Cut:/ });
    expect(oneCutLinks).toHaveLength(1);
    expect(oneCutLinks[0]?.getAttribute("href")).toBe(
      "/premium?focus=meme-one&locale=en&from=global_daily#plus-global-action-inbox-title",
    );
    expect(document.querySelector('[data-global-daily-one-cut="two"]')).toBeNull();
  });

  it.each([
    ["ko", "/memes/one-global-one"],
    ["en", "/en/memes/one-global-one"],
    ["ja", "/ja/memes/one-global-one"],
    ["zh", "/zh/memes/one-global-one"],
    ["zh-tw", "/zh-tw/memes/one-global-one"],
  ] as const)("keeps the Use Kit link localized for %s", (locale, expectedHref) => {
    render(
      <GlobalDailyChallenge
        locale={locale}
        challengeDate="2026-08-09"
        state="completed"
        questions={questions}
        currentStreak={4}
        showReviewShelf
      />,
    );

    expect(
      document.querySelector<HTMLAnchorElement>("[data-global-daily-review-shelf] a")?.getAttribute("href"),
    ).toBe(`${expectedHref}#meme-use-kit-title`);
  });

  it("fails closed when a review question has an invalid answer index", () => {
    const malformedQuestions = [
      { ...questions[0], answerIndex: questions[0].options.length },
      ...questions.slice(1),
    ];

    render(
      <GlobalDailyChallenge
        locale="en"
        challengeDate="2026-08-09"
        state="completed"
        questions={malformedQuestions}
        currentStreak={4}
        showReviewShelf
      />,
    );

    expect(document.querySelector("[data-global-daily-review-shelf]")).toBeNull();
    expect(document.querySelector("[data-global-daily-next-step]")).toBeNull();
  });

  it("does not show a fake success state when the schedule is unavailable", () => {
    render(
      <GlobalDailyChallenge
        locale="en"
        challengeDate="2026-08-09"
        state="unavailable"
        questions={[]}
      />,
    );
    expect(screen.getByText("Today’s global meme is being prepared")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Finish|Start/ })).toBeNull();
  });
});
