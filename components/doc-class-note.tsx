/**
 * HG-008 B안 — doc_class='event' 문서 안내.
 * 사건·인물·게임 고유명사 등 밈이 아닌데 밈캐치에 실린 9건(표본 근거:
 * artifacts/renewal/loop-023/sample-review-synthesis.md §3)에 정직한 라벨을 붙인다.
 * URL은 유지하되(HG-008 B, 비공개 전환 대신) 「이건 밈이 아니다」를 먼저 밝힌다.
 * safety-gray 톤(사어·이미 늦음과 같은 중립 정보 톤) — 위험 신호가 아니라 분류 안내.
 */
export function DocClassNote({ docClass }: { docClass?: string | null }) {
  if (docClass !== "event") return null;

  return (
    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-safety-gray-bg px-3 py-1 text-sm font-semibold text-safety-gray">
      <span aria-hidden className="leading-none">
        ◌
      </span>
      밈이 아니라 인터넷 문화 사건 기록이에요
    </p>
  );
}
