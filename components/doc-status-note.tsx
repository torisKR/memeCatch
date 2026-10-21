import Link from "next/link";
import { contentDepth, type ContentDepthInput } from "@/lib/content-depth";
import { TrackedBlock } from "@/components/tracked-block";

/**
 * 콘텐츠 상태 안내 — lib/content-depth.ts가 '얇음'으로 판정한 문서에만 붙는다.
 *
 * 얇은 문서는 색인에서 빠지지만 페이지는 200으로 살아 있다. 독자에게 실제로
 * 확인이 필요한 항목만 짚고 제보 경로를 연다.
 *
 * 충실한 문서에는 렌더하지 않는다 — 모든 문서에 붙는 순간 의미 없는 템플릿이 된다.
 */
export function DocStatusNote({
  meme,
  title,
  shortId,
}: {
  meme: ContentDepthInput;
  title: string;
  /** 이 문서의 공개 short_id — 정정 제보 CTA 계측용(개인정보 아님). */
  shortId: string;
}) {
  const depth = contentDepth(meme);
  if (!depth.isThin) return null;

  // 실제로 비어 있는 항목만 표시한다.
  const missing: string[] = [];
  if (depth.signals.originChars === 0) missing.push("유래");
  if (depth.signals.usageExampleCount === 0) missing.push("사용 예문");
  if (depth.signals.sourceCount === 0) missing.push("출처");
  if (missing.length === 0) return null;

  return (
    <aside
      aria-labelledby="doc-status-title"
      className="rounded-2xl border border-border bg-surface-2 p-5"
    >
      <h2 id="doc-status-title" className="flex items-center gap-2 text-base font-bold">
        <span aria-hidden>◌</span> 추가 확인이 필요한 내용
      </h2>
      {missing.length > 0 && (
        <p className="mt-2 text-base leading-relaxed">
          <strong className="font-semibold">{missing.join("·")}</strong> 정보가 아직
          확인되지 않았어요.
        </p>
      )}
      {/* 정정 제보 진입 계측(HG-006 B안) — 개인정보 없음: 문서 short_id + 진입 위치만. */}
      <TrackedBlock
        event="correction_report_started"
        params={{ short_id: shortId, from: "doc_status" }}
      >
        <Link
          href={`/submit?name=${encodeURIComponent(title)}`}
          rel="nofollow"
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-surface px-4 py-2.5 text-base font-semibold underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {title} 정보 제보하기
        </Link>
      </TrackedBlock>
    </aside>
  );
}
