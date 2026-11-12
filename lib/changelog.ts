/**
 * User-facing changelog entries.
 *
 * These entries must never mount a dialog, dim layer, or scroll lock.
 * A future notice has to be an inline dismissible strip.
 */
export type ChangelogEntry = {
  /** Unique id. The newest entry is first. */
  id: string;
  /** Display date */
  date: string;
  /** One-line title */
  title: string;
  /** User-facing change notes */
  items: string[];
  action?: { label: string; href: string };
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-07-22",
    date: "2026-07-22",
    title: "댓글·공감 오픈 & 고객센터 신설",
    items: [
      "이제 밈에 댓글을 남기고 공감 표현을 누를 수 있어요 — 여러분의 밈 이야기를 들려주세요.",
      "고객센터가 생겼어요 — 버그 신고, 콘텐츠 정정 요청, 건의사항을 바로 보낼 수 있어요.",
      "보낸 문의와 운영자 답변을 고객센터에서 모아볼 수 있어요.",
      "업데이트가 배포되면 이렇게 새 소식으로 알려드려요.",
    ],
  },
];

export const LATEST_CHANGELOG_ID: string | null = CHANGELOG[0]?.id ?? null;
