import { citableSources, type CitableSourceInput } from "@/lib/source-links";
import { sourcePlatformFromReference } from "@/lib/source-platform";
import { TrackedBlock } from "@/components/tracked-block";

/**
 * "무엇을 근거로 썼나" — 이 문서가 참조한 출처를 서지 정보(제목·발행처·확인일)와
 * 함께 명시하는 근거 목록. 유래 문단 아래의 짧은 인라인 링크와 달리, 심사자·독자가
 * 주장과 출처를 1:1로 대조할 수 있게 펼쳐 보여 준다(E-E-A-T).
 *
 * 원칙:
 *  - 제목이 있는 출처만 싣는다. URL만 있는 항목은 근거 목록이 되지 못한다
 *    (제목을 URL에서 지어내지 않는다 — 없는 사실 생성 금지).
 *  - 실을 게 하나도 없으면 섹션 자체를 렌더하지 않는다(빈 헤딩 금지).
 *  - 날짜는 '발행일'이 아니라 밈캐치가 확인한 '확인일'로만 표기한다.
 *    원문 발행일은 수집하지 않으므로 발행일이라 적으면 사실 왜곡이 된다.
 */
export function SourceEvidence({
  sources,
  shortId,
}: {
  sources: CitableSourceInput[];
  /** 이 문서의 공개 short_id — 계측 이벤트가 어떤 문서를 가리키는지 식별한다(개인정보 아님). */
  shortId: string;
}) {
  const cited = citableSources(sources);
  if (cited.length === 0) return null;

  return (
    <section
      aria-labelledby="source-evidence-title"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="source-evidence-title" className="text-lg font-bold">
        이 문서가 참고한 자료
      </h2>
      <p className="mt-1 text-sm text-muted">
        아래 자료를 확인해 뜻·유래를 정리했어요. 원문에서 직접 확인할 수 있어요.
      </p>
      <ol className="mt-3 space-y-3">
        {cited.map((source, i) => (
          <li
            key={source.url}
            className="instrument-grid flex gap-3 rounded-xl border border-border p-4"
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
                      확인{" "}
                      <time
                        dateTime={source.capturedAt}
                        className="stat-mono text-(--signal-cyan)"
                      >
                        {new Date(source.capturedAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
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
    </section>
  );
}
