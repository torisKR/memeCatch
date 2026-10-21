import { citableSources, type CitableSourceInput } from "@/lib/source-links";
import { sourcePlatformFromReference } from "@/lib/source-platform";
import { TrackedBlock } from "@/components/tracked-block";

/**
 * "무엇을 근거로 썼나" — 이 문서가 참조한 출처를 서지 정보(제목·발행처·자료 수집일)와
 * 함께 명시하는 자료 목록. 링크 목록은 개별 주장에 대한 검증 완료나
 * 독립적인 1차 출처임을 인증하지 않는다.
 *
 * 원칙:
 *  - 제목이 있는 출처만 싣는다. URL만 있는 항목은 근거 목록이 되지 못한다
 *    (제목을 URL에서 지어내지 않는다 — 없는 사실 생성 금지).
 *  - 실을 게 하나도 없으면 섹션 자체를 렌더하지 않는다(빈 헤딩 금지).
 *  - captured_at은 저장된 자료 수집 시각이다. 원문 발행일·최초 연결일·검증일로
 *    해석하지 않는다. 재수집 때 갱신될 수 있는 시각의 의미를 유지한다.
 */
export function SourceEvidence({
  sources,
  shortId,
  defaultOpen = false,
}: {
  sources: CitableSourceInput[];
  /** 이 문서의 공개 short_id — 계측 이벤트가 어떤 문서를 가리키는지 식별한다(개인정보 아님). */
  shortId: string;
  defaultOpen?: boolean;
}) {
  const cited = citableSources(sources);
  if (cited.length === 0) return null;

  return (
    <details open={defaultOpen} className="border-t border-border">
      <summary className="min-h-11 cursor-pointer py-4 font-semibold focus-visible:outline-offset-4">
        참고한 자료 {cited.length}개
      </summary>
      <ol className="mt-3 space-y-3">
        {cited.map((source, i) => (
          <li
            key={source.url}
            className="flex gap-3 border-b border-border pb-3 last:border-0"
          >
            <span aria-hidden className="stat-mono shrink-0 pt-0.5 text-xs text-muted">
              #{String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              {/* 출처 이탈 계측(HG-006 B안) — 개인정보 없음: 문서 short_id + 정규화 플랫폼명만. */}
              <TrackedBlock
                event="meme_source_opened"
                params={{
                  short_id: shortId,
                  platform: sourcePlatformFromReference({ url: source.url }) ?? "other",
                }}
              >
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-start gap-1 font-medium underline decoration-border underline-offset-2 transition-colors hover:text-foreground hover:decoration-flame-500"
                >
                  {source.title}
                  <span aria-hidden className="text-xs">↗</span>
                </a>
              </TrackedBlock>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {source.publisher && <span>{source.publisher}</span>}
                {source.capturedAt && (
                  <>
                    {source.publisher && <span aria-hidden>·</span>}
                    <span>
                      자료 수집일{" "}
                      <time
                        dateTime={source.capturedAt}
                        className="tabular-nums"
                      >
                        {new Date(source.capturedAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          timeZone: "Asia/Seoul",
                        })}
                      </time>
                    </span>
                  </>
                )}
                {source.isContext && (
                  <>
                    <span aria-hidden>·</span>
                    <span>맥락 확인용 보조 자료</span>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
