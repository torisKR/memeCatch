import { CATEGORIES, type CategoryIcon, type MemeCategory } from "@/lib/labels";

/**
 * 카테고리 소프트 틴트 칩 (DESIGN §11 검증 대안 A).
 * 옅은 틴트 배경 + 어두운 텍스트 + 중립 아이콘 — 원색 채움/흰 글씨 금지(WCAG AA).
 * 색만 의존 금지: 아이콘 + 라벨 병행(색약 대응). 다크는 CSS 변수로 자동 전환.
 * tone/label/icon은 labels.ts가 단일 소스. 다른 레인(필터·그리드)이 import.
 */
const TONE: Record<MemeCategory, string> = {
  phrase: "bg-cat-phrase-bg text-cat-phrase-text",
  dance: "bg-cat-dance-bg text-cat-dance-text",
  song: "bg-cat-song-bg text-cat-song-text",
  image: "bg-cat-image-bg text-cat-image-text",
  comment: "bg-cat-comment-bg text-cat-comment-text",
  challenge: "bg-cat-challenge-bg text-cat-challenge-text",
};

export function CategoryTag({
  category,
  className = "",
}: {
  category: MemeCategory;
  className?: string;
}) {
  const meta = CATEGORIES[category];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold leading-none ${TONE[category]} ${className}`}
    >
      <CategoryGlyph icon={meta.icon} className="size-3.5 shrink-0" />
      {meta.user}
    </span>
  );
}

/** 중립 stroke 아이콘 — currentColor(=틴트 텍스트색) 상속, 불꽃/이모지 금지 */
export function CategoryGlyph({
  icon,
  className,
}: {
  icon: CategoryIcon;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {GLYPHS[icon]}
    </svg>
  );
}

const GLYPHS: Record<CategoryIcon, React.ReactNode> = {
  // 유행어 — 말풍선
  speech: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5Z" />,
  // 댄스 — 이어붙인 겹음표(동작 강조)
  dance: (
    <>
      <path d="M9 17V6.5l9-2.5V14" />
      <circle cx="6.5" cy="17" r="2.5" />
      <circle cx="15.5" cy="14" r="2.5" />
    </>
  ),
  // 노래 — 홑음표(♪)
  note: (
    <>
      <path d="M9 18V5l9-2v11" />
      <circle cx="6.5" cy="18" r="2.5" />
    </>
  ),
  // 짤 — 사진 프레임
  frame: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="m4 17 5-4.5L14 17l3-2.5 3 2.5" />
    </>
  ),
  // 댓글 밈 — 점 3개 말풍선
  comment: (
    <>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5Z" />
      <circle cx="8.5" cy="10.5" r=".65" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.5" r=".65" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.5" r=".65" fill="currentColor" stroke="none" />
    </>
  ),
  // 챌린지 — 깃발(불꽃 아님, 생명게이지와 분리)
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2 3.5 2 3.5H6" />
    </>
  ),
};
