import Link from "next/link";
import { summarizeEvidence, type SourceLink } from "@/lib/source-links";

/**
 * 신뢰 신호 — "이 설명을 무엇으로 확인했나"를 실제 근거 상태에 맞춰 말한다.
 *
 * 이전에는 본문이 있기만 하면 문서마다 똑같이 "밈캐치 검수팀 확인"을 출력했다.
 * 공개 문서의 34.1%(1,330건)는 근거 출처가 하나도 없어서, 확인한 적 없는 문서가
 * 확인을 주장하는 상태였다. 근거가 없으면 없다고 말하는 것이 이 컴포넌트의 존재
 * 이유다 — 부족함을 숨기지 않되 무엇이 부족한지 구체적으로 밝힌다.
 *
 * 세 상태만 쓴다(1인 운영이 유지할 수 있는 최소 단위):
 *   0건        → 근거 미연결. 검수 주장을 하지 않고 제보 경로를 연다.
 *   맥락 출처만 → 위키로 맥락만 확인. 원본은 아직 못 찾았다고 밝힌다.
 *   원본 있음   → 확인한 근거 수를 센다.
 *
 * 충실도('보강 중')는 바로 위 DocStatusNote가 이미 크게 말하고 있어 여기서
 * 반복하지 않는다. 같은 사실을 두 번 쓰면 둘 다 배경이 된다.
 */
export function TrustNote({
  sources,
  updatedAt,
  moderationStatus,
  title,
}: {
  sources: SourceLink[];
  updatedAt: string;
  moderationStatus: string;
  title: string;
}) {
  const evidence = summarizeEvidence(sources);
  const updated = (
    <time dateTime={updatedAt}>
      {new Date(updatedAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
    </time>
  );

  if (evidence.total === 0) {
    return (
      <div className="border-t border-border pt-3 text-sm text-muted">
        <p>
          <span aria-hidden>◌</span>{" "}
          <span className="font-semibold text-foreground">근거 출처 준비 중</span> — 이
          문서는 아직 확인된 출처가 연결되지 않았어요. 마지막 업데이트 {updated}
        </p>
        <Link
          href={`/submit?name=${encodeURIComponent(title)}`}
          className="mt-2 inline-flex min-h-11 items-center underline underline-offset-2 transition-colors hover:text-foreground"
        >
          출처를 아시면 알려 주세요
        </Link>
      </div>
    );
  }

  const isContextOnly = evidence.primary === 0;

  return (
    <p className="border-t border-border pt-3 text-sm text-muted">
      <span aria-hidden>{isContextOnly ? "▲" : "●"}</span>{" "}
      {isContextOnly ? (
        <>
          <span className="font-semibold text-foreground">
            맥락 출처 {evidence.context}개로 확인
          </span>{" "}
          — 원본은 아직 찾는 중이에요.
        </>
      ) : (
        <>
          <span className="font-semibold text-foreground">
            근거 출처 {evidence.total}개 확인
          </span>
          {evidence.context > 0 && <> (원본·보도 {evidence.primary}개)</>}
        </>
      )}
      {moderationStatus === "limited" && <> · 출처 확인 중인 문서예요.</>} · 마지막
      업데이트 {updated}
    </p>
  );
}
