import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getPlusOutcomeSnapshotCopy,
  PLUS_OUTCOME_SNAPSHOT_COPY,
  PlusOutcomeSnapshot,
} from "@/components/premium/plus-outcome-snapshot";
import { PLUS_OUTCOME_COPY } from "@/lib/plus-outcome-copy";
import { buildPlusOutcomeWinningReplay } from "@/lib/plus-outcome-ledger";

const noDailyCompletion = {
  status: "available" as const,
  completedMemeIds: [] as string[],
  completedTodayCount: 0,
};

const completion = {
  status: "available" as const,
  completedMemeIds: ["private-meme-id"],
  completedTodayCount: 2,
  currentStreak: 4,
};

const summary = {
  status: "ready" as const,
  fromDate: "2026-08-03",
  toDate: "2026-08-09",
  timezone: "Asia/Seoul" as const,
  totalReceipts: 3,
  totalCompletions: 4,
  pendingReceiptCount: 1,
  awaitingPerformanceCount: 2,
  byChannel: [{ key: "threads" as const, count: 2 }],
  byLocale: [{ key: "en" as const, count: 2 }],
  byArtifactKind: [{ key: "creator_pack" as const, count: 2 }],
};

describe("PlusOutcomeSnapshot", () => {
  it("uses English copy for UI-only locales without inventing a public content locale", () => {
    expect(getPlusOutcomeSnapshotCopy("th").title).toBe(PLUS_OUTCOME_SNAPSHOT_COPY.en.title);
  });

  it("puts private outcome value before the action inbox without leaking receipt fields", () => {
    const html = renderToStaticMarkup(
      <PlusOutcomeSnapshot
        summary={summary}
        completion={completion}
        ratings={[
          { memeId: "private-meme-id", completionDate: "2026-08-09", channel: "threads", rating: "hit" },
        ]}
        resultEvidence={{ status: "ready", count: 2 }}
        ratingsStatus="ready"
        copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
        outcomeCopy={PLUS_OUTCOME_COPY.en}
      />,
    );

    expect(html).toContain('data-plus-outcome-snapshot="ready"');
    expect(html).toContain("What you actually created");
    expect(html).toContain("2 used today · 4-day streak");
    expect(html).toContain("3 uses");
    expect(html).toContain("2 waiting for performance");
    expect(html).toContain("1 recent ratings");
    expect(html).toContain("2 saved results");
    expect(html).toContain("Open saved results");
    expect(html).toContain('href="#plus-outcome-history-title"');
    expect(html).toContain("Threads");
    expect(html).toContain("English");
    expect(html).toContain("Creator Pack");
    expect(html).not.toContain("private-meme-id");
    expect(html).not.toContain("result_url");
    expect(html).not.toContain("performance_note");
  });

  it("offers only the latest eligible seven-day self-rated hit for replay", () => {
    const winningReplay = buildPlusOutcomeWinningReplay(summary, {
      status: "ready",
      pendingCount: 0,
      items: [
        {
          receiptId: "old-private-receipt",
          completionDate: "2026-08-05",
          title: "Older hit",
          channel: "threads",
          locale: "en",
          artifactKind: "caption",
          performanceRating: "hit",
          hasPerformanceNote: false,
          href: "/en/memes/old",
          linkStatus: "localized",
          replayShortId: "old-meme",
        },
        {
          receiptId: "new-private-receipt",
          completionDate: "2026-08-09",
          title: "Latest hit",
          channel: "youtube",
          locale: "ja",
          artifactKind: "creator_pack",
          performanceRating: "hit",
          hasPerformanceNote: true,
          href: "/ja/memes/latest",
          linkStatus: "localized",
          replayShortId: "latest-meme",
        },
        {
          receiptId: "neutral-private-receipt",
          completionDate: "2026-08-09",
          title: "Neutral use",
          channel: "threads",
          locale: "en",
          artifactKind: "caption",
          performanceRating: "neutral",
          hasPerformanceNote: false,
          href: "/en/memes/neutral",
          linkStatus: "localized",
          replayShortId: "neutral-meme",
        },
      ],
    }, noDailyCompletion);

    expect(winningReplay).toEqual({
      title: "Latest hit",
      completionDate: "2026-08-09",
      channel: "youtube",
      locale: "ja",
      artifactKind: "creator_pack",
      href: "/premium?replay=latest-meme&replay_locale=ja&from=outcome_history",
    });
    expect(winningReplay).not.toHaveProperty("receiptId");
  });

  it("fails closed when today's completion is present or unavailable", () => {
    const history = {
      status: "ready" as const,
      pendingCount: 0,
      items: [
        {
          receiptId: "private-receipt",
          completionDate: "2026-08-09",
          title: "Latest hit",
          channel: "threads" as const,
          locale: "en" as const,
          artifactKind: "caption" as const,
          performanceRating: "hit" as const,
          hasPerformanceNote: false,
          href: "/en/memes/latest",
          linkStatus: "localized" as const,
          replayShortId: "latest-meme",
        },
      ],
    };

    expect(
      buildPlusOutcomeWinningReplay(summary, history, {
        ...noDailyCompletion,
        completedMemeIds: ["completed-today"],
        completedTodayCount: 1,
      }),
    ).toBeNull();
    expect(
      buildPlusOutcomeWinningReplay(summary, history, {
        ...noDailyCompletion,
        status: "unavailable",
      }),
    ).toBeNull();
  });

  it("renders a private, honest replay CTA without exposing receipt or result fields", () => {
    const html = renderToStaticMarkup(
      <PlusOutcomeSnapshot
        summary={summary}
        completion={completion}
        ratings={[]}
        resultEvidence={{ status: "empty", count: 0 }}
        ratingsStatus="empty"
        copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
        outcomeCopy={PLUS_OUTCOME_COPY.en}
        winningReplay={{
          title: "Latest hit",
          completionDate: "2026-08-09",
          channel: "youtube",
          locale: "ja",
          artifactKind: "creator_pack",
          href: "/premium?replay=latest-meme&replay_locale=ja&from=outcome_history",
        }}
      />,
    );

    expect(html).toContain("data-plus-outcome-winning-replay");
    expect(html).toContain("Recreate a use you marked as working");
    expect(html).toContain("Latest hit");
    expect(html).toContain("日本語");
    expect(html).toContain("Creator Pack");
    expect(html).toContain("This is based on your rating, not verified public performance.");
    expect(html).toContain('data-plus-outcome-winning-replay-action');
    expect(html).toContain(
      "/premium?replay=latest-meme&amp;replay_locale=ja&amp;from=outcome_history",
    );
    expect(html).not.toContain("new-private-receipt");
    expect(html).not.toContain("result_url");
    expect(html).not.toContain("performance_note");
  });

  it("does not turn an empty or unavailable read into fake metrics", () => {
    const empty = renderToStaticMarkup(
      <PlusOutcomeSnapshot
        summary={{
          ...summary,
          status: "empty",
          totalReceipts: 0,
          totalCompletions: 0,
          pendingReceiptCount: 0,
          awaitingPerformanceCount: 0,
          byChannel: [],
          byLocale: [],
          byArtifactKind: [],
        }}
        completion={{ ...completion, completedMemeIds: [], completedTodayCount: 0, currentStreak: 0 }}
        ratings={[]}
        resultEvidence={{ status: "empty", count: 0 }}
        ratingsStatus="empty"
        copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
        outcomeCopy={PLUS_OUTCOME_COPY.en}
      />,
    );
    expect(empty).toContain('data-plus-outcome-snapshot="empty"');
    expect(empty).toContain("No use recorded yet");
    expect(empty).toContain("Open today’s Action Inbox");
    expect(empty).not.toContain("0 uses");

    const unavailable = renderToStaticMarkup(
      <PlusOutcomeSnapshot
        summary={{ ...summary, status: "unavailable", fromDate: null, toDate: null }}
        completion={{ ...completion, status: "unavailable" }}
        ratings={[]}
        resultEvidence={{ status: "unavailable", count: 0 }}
        ratingsStatus="unavailable"
        copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
        outcomeCopy={PLUS_OUTCOME_COPY.en}
      />,
    );
    expect(unavailable).toContain('data-plus-outcome-snapshot="unavailable"');
    expect(unavailable).toContain("outcome snapshot is unavailable");
    expect(unavailable).not.toContain("4-day streak");
  });

  it("shows zero only for an empty History and fails closed for unavailable or locked History", () => {
    const readyWithEmptyHistory = renderToStaticMarkup(
      <PlusOutcomeSnapshot
        summary={summary}
        completion={completion}
        ratings={[]}
        resultEvidence={{ status: "empty", count: 0 }}
        ratingsStatus="empty"
        copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
        outcomeCopy={PLUS_OUTCOME_COPY.en}
      />,
    );
    expect(readyWithEmptyHistory).toContain('data-plus-outcome-snapshot="ready"');
    expect(readyWithEmptyHistory).toContain("0 saved results");
    expect(readyWithEmptyHistory).not.toContain("Open saved results");

    for (const resultEvidenceStatus of ["unavailable", "locked"] as const) {
      const unavailableHistory = renderToStaticMarkup(
        <PlusOutcomeSnapshot
          summary={summary}
          completion={completion}
          ratings={[]}
          resultEvidence={{ status: resultEvidenceStatus, count: 0 }}
          ratingsStatus="empty"
          copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
          outcomeCopy={PLUS_OUTCOME_COPY.en}
        />,
      );
      expect(unavailableHistory).toContain('data-plus-outcome-snapshot="unavailable"');
      expect(unavailableHistory).not.toContain("0 saved results");
    }
  });

  it("keeps a positive saved-result proof visible when other outcome signals are empty", () => {
    const html = renderToStaticMarkup(
      <PlusOutcomeSnapshot
        summary={{
          ...summary,
          status: "empty",
          totalReceipts: 0,
          totalCompletions: 0,
          pendingReceiptCount: 0,
          awaitingPerformanceCount: 0,
          byChannel: [],
          byLocale: [],
          byArtifactKind: [],
        }}
        completion={{ ...completion, completedMemeIds: [], completedTodayCount: 0, currentStreak: 0 }}
        ratings={[]}
        resultEvidence={{ status: "ready", count: 2 }}
        ratingsStatus="empty"
        copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
        outcomeCopy={PLUS_OUTCOME_COPY.en}
      />,
    );
    expect(html).toContain('data-plus-outcome-snapshot="ready"');
    expect(html).toContain("2 saved results");
    expect(html).toContain("Open saved results");
  });

  it("shows a successful zero-result History as ready without offering a History CTA", () => {
    const html = renderToStaticMarkup(
      <PlusOutcomeSnapshot
        summary={{
          ...summary,
          status: "empty",
          totalReceipts: 0,
          totalCompletions: 0,
          pendingReceiptCount: 0,
          awaitingPerformanceCount: 0,
          byChannel: [],
          byLocale: [],
          byArtifactKind: [],
        }}
        completion={{ ...completion, completedMemeIds: [], completedTodayCount: 0, currentStreak: 0 }}
        ratings={[]}
        resultEvidence={{ status: "ready", count: 0 }}
        ratingsStatus="empty"
        copy={PLUS_OUTCOME_SNAPSHOT_COPY.en}
        outcomeCopy={PLUS_OUTCOME_COPY.en}
      />,
    );
    expect(html).toContain('data-plus-outcome-snapshot="ready"');
    expect(html).toContain("0 saved results");
    expect(html).not.toContain("Open saved results");
  });
});
