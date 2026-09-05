import { describe, expect, it } from "vitest";
import {
  buildPlusOutcomeFollowUps,
  parsePlusOutcomeFollowUpRows,
} from "@/lib/plus-outcome-ledger";

function row(index: number, performanceNote: string | null) {
  return {
    id: `receipt-${index}`,
    meme_id: `meme-${index}`,
    completion_date: `2026-08-0${index}`,
    title_snapshot: `Meme ${index}`,
    channel: index % 2 === 0 ? "threads" : "instagram",
    locale: "en",
    artifact_kind: "creator_pack",
    performance_note: performanceNote,
    performance_rating: null,
  };
}

describe("Plus outcome follow-up", () => {
  it("drops malformed private rows and keeps the public follow-up shape", () => {
    expect(
      parsePlusOutcomeFollowUpRows([
        row(1, null),
        { ...row(2, null), title_snapshot: "" },
        { ...row(3, null), locale: "fr" },
      ]),
    ).toEqual([
      {
        receiptId: "receipt-1",
        memeId: "meme-1",
        completionDate: "2026-08-01",
        title: "Meme 1",
        channel: "instagram",
        locale: "en",
        artifactKind: "creator_pack",
        mode: "bulk",
        performanceNote: null,
        performanceRating: null,
      },
    ]);
  });

  it("prioritizes missing performance and caps the list at five recent receipts", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      receiptId: `receipt-${index}`,
      completionDate: `2026-08-${String(index + 1).padStart(2, "0")}`,
      title: `Meme ${index}`,
      memeId: `meme-${index}`,
      channel: "threads" as const,
      locale: "en" as const,
      artifactKind: "caption" as const,
      performanceNote: index < 2 ? "done" : null,
      performanceRating: null,
    }));

    expect(buildPlusOutcomeFollowUps(rows)).toMatchObject({
      status: "ready",
      pendingCount: 5,
      items: [
        { receiptId: "receipt-6", performanceNote: null },
        { receiptId: "receipt-5", performanceNote: null },
        { receiptId: "receipt-4", performanceNote: null },
        { receiptId: "receipt-3", performanceNote: null },
        { receiptId: "receipt-2", performanceNote: null },
      ],
    });
  });
});
