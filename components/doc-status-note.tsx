import Link from "next/link";
import { contentDepth, type ContentDepthInput } from "@/lib/content-depth";

/**
 * 정리 진행 중 안내 — lib/content-depth.ts가 '얇음'으로 판정한 문서에만 붙는다.
 *
 * 얇은 문서는 색인에서 빠지지만(page.tsx의 robots, sitemap) 페이지는 200으로 살아
 * 있다. 그 상태를 독자에게 숨기면 방치된 스텁으로 읽히므로, 무엇이 아직 없고
 * 어떻게 채워지는지를 밝히고 제보 경로를 연다. 확인된 사실만 싣는다는 편집 원칙을
 * 드러내는 자리이기도 하다(없는 내용을 지어내 분량을 채우지 않는 이유).
 *
 * 충실한 문서에는 렌더하지 않는다 — 모든 문서에 붙는 순간 의미 없는 템플릿이 된다.
 */
export function DocStatusNote({
  meme,
  title,
}: {
  meme: ContentDepthInput;
  title: string;
}) {
  const depth = contentDepth(meme);
  if (!depth.isThin) return null;

  // 무엇이 비었는지 실제 신호로 지목한다(일반 문구 대신 이 문서의 상태 서술).
  const missing: string[] = [];
  if (depth.signals.originChars === 0) missing.push("유래");
  if (depth.signals.usageExampleCount === 0) missing.push("사용 예문");
  if (depth.signals.sourceCount === 0) missing.push("출처");

  return (
    <aside
      aria-labelledby="doc-status-title"
      className="rounded-2xl border border-border bg-surface-2 p-5"
    >
      <h2 id="doc-status-title" className="flex items-center gap-2 text-base font-bold">
        <span aria-hidden>✎</span> 아직 정리 중인 문서예요
      </h2>
      <p className="mt-2 text-base leading-relaxed">
        {missing.length > 0 ? (
          <>
            <strong className="font-semibold">{missing.join("·")}</strong> 확인이 끝나지
            않아 이 문서는 지금까지 확인된 내용만 담고 있어요.
          </>
        ) : (
          <>이 문서는 아직 내용을 보강하는 중이에요.</>
        )}{" "}
        추측으로 채우지 않고, 근거를 확인한 만큼만 단계적으로 공개해요.
      </p>
      <p className="mt-2 text-sm text-muted">
        「{title}」을(를) 실제로 써 보셨다면 알려 주세요. 검수를 거쳐 이 문서에 반영해요.
      </p>
      <Link
        href={`/submit?name=${encodeURIComponent(title)}`}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-surface px-4 py-2.5 text-base font-semibold underline underline-offset-2 transition-colors hover:text-foreground"
      >
        아는 내용 제보하기
      </Link>
    </aside>
  );
}
