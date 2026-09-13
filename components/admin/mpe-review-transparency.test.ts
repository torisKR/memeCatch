import { describe, expect, it } from "vitest";
import { reviewNotesFromDraft } from "./mpe-review-transparency";

describe("reviewNotesFromDraft", () => {
  it("returns field and reason entries from the persisted draft contract", () => {
    const notes = reviewNotesFromDraft({
      reviewNotes: [
        { field: "ORIGIN", reason: "최초 유래를 확인할 근거가 부족해요." },
        { field: "SAFETY", reason: "안전성 판단을 보류했어요." },
      ],
    });

    expect(notes).toEqual([
      { field: "ORIGIN", reason: "최초 유래를 확인할 근거가 부족해요." },
      { field: "SAFETY", reason: "안전성 판단을 보류했어요." },
    ]);
  });

  it("returns no notes for legacy drafts or malformed optional entries", () => {
    expect(reviewNotesFromDraft({ claims: [] })).toEqual([]);
    expect(reviewNotesFromDraft({
      reviewNotes: [
        { field: "ORIGIN", reason: "" },
        { field: "NOT_A_FIELD", reason: "무시해야 해요." },
        "not an object",
        null,
      ],
    })).toEqual([]);
  });
});
