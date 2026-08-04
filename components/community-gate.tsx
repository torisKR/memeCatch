import { REACTIONS } from "@/lib/labels";

/**
 * 레인 F — 커뮤니티 플래그(communityEnabled=false) 시 노출하는 "준비 중" 안내.
 * 서버·클라이언트 어디서든 렌더 가능한 순수 표현 컴포넌트.
 */
export function CommunityGate({
  title = "댓글은 곧 열려요",
  description = "커뮤니티 기능을 차근차근 준비하고 있어요. 열리면 이 자리에서 바로 만나요.",
  showReactionHint = true,
}: {
  title?: string;
  description?: string;
  showReactionHint?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="instrument-grid rounded-2xl border border-border bg-surface-2 p-6 text-center"
    >
      <svg
        className="mx-auto h-8 w-8 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path
          d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.9-.9L3 20l1-4.4A8.5 8.5 0 1 1 21 11.5Z"
          strokeLinejoin="round"
        />
        <path d="M8.5 10.5h7M8.5 13.5h4" strokeLinecap="round" />
      </svg>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-base text-muted">{description}</p>
      {showReactionHint && (
        <div className="mt-4">
          <p className="text-base text-muted">
            지금은 반응 버튼으로 마음을 남길 수 있어요.
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2" aria-label="반응 종류">
            {Object.entries(REACTIONS).map(([key, r]) => (
              <li
                key={key}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-sm text-muted"
              >
                <span aria-hidden>{r.emoji}</span>
                {r.user}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
