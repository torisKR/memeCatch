import type { ReactNode } from "react";

const REVIEW_FIELDS = ["TITLE", "DEFINITION", "MEANING", "ORIGIN", "USAGE", "SAFETY"] as const;

type ReviewField = (typeof REVIEW_FIELDS)[number];

type ReviewNote = {
  readonly field: ReviewField;
  readonly reason: string;
};

const REVIEW_FIELD_LABELS: Record<ReviewField, string> = {
  TITLE: "제목",
  DEFINITION: "뜻",
  MEANING: "의미",
  ORIGIN: "유래",
  USAGE: "사용법",
  SAFETY: "안전성",
};

export function reviewNotesFromDraft(draft: Record<string, unknown>): ReviewNote[] {
  const rawNotes = draft.reviewNotes;
  if (!Array.isArray(rawNotes)) return [];

  return rawNotes.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const field = "field" in entry && typeof entry.field === "string" ? entry.field : "";
    const reason = "reason" in entry && typeof entry.reason === "string" ? entry.reason.trim() : "";
    if (!REVIEW_FIELDS.includes(field as ReviewField) || !reason) return [];
    return [{ field: field as ReviewField, reason }];
  });
}

export function MpeReviewTransparency({ draft, confidence }: {
  readonly draft: Record<string, unknown>;
  readonly confidence: number | null;
}): ReactNode {
  const notes = reviewNotesFromDraft(draft);

  return (
    <section className="mt-4 rounded-lg border border-safety-yellow bg-safety-yellow-bg p-4" aria-labelledby="mpe-transparency-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="mpe-transparency-title" className="font-semibold text-safety-yellow">
          자동 분석 참고 신호
        </h3>
        {confidence === null ? (
          <span className="text-sm font-medium text-safety-yellow">참고값 없음</span>
        ) : (
          <span className="stat-mono text-sm font-semibold text-safety-yellow">
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        이 값과 아래 메모는 자동 분석을 돕는 참고 정보예요. 사실 확인이나 권리 승인을 대신하지 않아요.
      </p>
      {notes.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="자동 분석 보류 메모">
          {notes.map((note, index) => (
            <li key={`${note.field}-${index}`} className="rounded-md bg-background/70 p-3 text-sm">
              <strong>{REVIEW_FIELD_LABELS[note.field]} 확인 필요</strong>
              <span className="mt-1 block leading-relaxed text-muted">{note.reason}</span>
            </li>
          ))}
        </ul>
      )}
      {notes.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          추가 보류 메모가 없어요. 그래도 운영자 사실·권리 검수는 필요해요.
        </p>
      )}
    </section>
  );
}
