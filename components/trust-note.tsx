import Link from "next/link";
import { evidenceTimestamp, summarizeEvidence, type EvidenceSourceInput } from "@/lib/source-links";
import { TrackedBlock } from "@/components/tracked-block";
import { houseOriginalPublicLabel, trustCopyKind } from "@/lib/house-original";

/**
 * 신뢰 신호 — "이 설명을 무엇으로 확인했나"를 실제 근거 상태에 맞춰 말한다.
 *
 * 이전에는 본문이 있기만 하면 문서마다 똑같이 "밈캐치 검수팀 확인"을 출력했다.
 * 공개 문서의 34.1%(1,330건)는 근거 출처가 하나도 없어서, 확인한 적 없는 문서가
 * 확인을 주장하는 상태였다. 근거가 없으면 없다고 말하는 것이 이 컴포넌트의 존재
 * 이유다 — 부족함을 숨기지 않되 무엇이 부족한지 구체적으로 밝힌다.
 *
 * 네 상태만 쓴다(1인 운영이 유지할 수 있는 최소 단위):
 *   자체 제작  → 밈캐치가 만든 밈. 인터넷 원본 부재를 결함으로 말하지 않는다.
 *   0건        → 근거 미연결. 검수 주장을 하지 않고 제보 경로를 연다.
 *   맥락 출처만 → 위키 자료가 연결돼 있음을 밝힌다.
 *   일반 출처 있음 → 연결된 자료 수만 센다. 제목만으로 원본·보도 검증을 주장하지 않는다.
 *
 * 충실도('보강 중')는 바로 위 DocStatusNote가 이미 크게 말하고 있어 여기서
 * 반복하지 않는다. 같은 사실을 두 번 쓰면 둘 다 배경이 된다.
 */
export function TrustNote({
  sources,
  updatedAt,
  moderationStatus,
  title,
  shortId,
  originKind,
}: {
  sources: EvidenceSourceInput[];
  updatedAt: string;
  moderationStatus: string;
  title: string;
  /** 이 문서의 공개 short_id — 정정 제보 CTA 계측용(개인정보 아님). */
  shortId: string;
  originKind?: string | null;
}) {
  const evidence = summarizeEvidence(sources);
  const storedUpdate = evidenceTimestamp(updatedAt);
  const updated = storedUpdate ? (
    <time dateTime={storedUpdate}>
      {new Date(storedUpdate).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Seoul",
      })}
    </time>
  ) : <span>기록 미확인</span>;

  if (trustCopyKind(originKind) === "house_original") {
    return (
      <div className="border-t border-border pt-3 text-sm text-muted">
        <p>
          <span
            aria-hidden
            className="signal-live inline-block size-1.5 rounded-full bg-(--signal-cyan) align-middle"
          />{" "}
          <span className="font-semibold text-foreground">{houseOriginalPublicLabel()}</span>{" "}
          — 밈캐치가 만들고 권리를 보유한 표현이에요. 마지막 업데이트 {updated}
        </p>
        <TrackedBlock
          event="correction_report_started"
          params={{ short_id: shortId, from: "trust_note_house_original" }}
        >
          <Link
            href={`/submit?name=${encodeURIComponent(title)}`}
            rel="nofollow"
            className="mt-2 inline-flex min-h-11 items-center underline underline-offset-2 transition-colors hover:text-foreground"
          >
            다른 곳에서 이 표현이 무단으로 쓰이면 알려 주세요
          </Link>
        </TrackedBlock>
      </div>
    );
  }

  if (evidence.total === 0) {
    return (
      <div className="border-t border-border pt-3 text-sm text-muted">
        <p>
          <span aria-hidden>–</span>{" "}
          <span className="font-semibold text-foreground">근거 출처 준비 중</span> — 이
          문서는 아직 확인된 출처가 연결되지 않았어요. 마지막 업데이트 {updated}
        </p>
        {/* 정정 제보 진입 계측(HG-006 B안) — 개인정보 없음: 문서 short_id + 진입 위치만. */}
        <TrackedBlock
          event="correction_report_started"
          params={{ short_id: shortId, from: "trust_note" }}
        >
          <Link
            href={`/submit?name=${encodeURIComponent(title)}`}
            rel="nofollow"
            className="mt-2 inline-flex min-h-11 items-center underline underline-offset-2 transition-colors hover:text-foreground"
          >
            출처를 아시면 알려 주세요
          </Link>
        </TrackedBlock>
      </div>
    );
  }

  const isContextOnly = evidence.primary === 0;
  // primary가 있어도 전부 제목·작성자 없는 맨 URL이면 「원본·보도 확인」을 주장하지
  // 않는다(루프 023 — 그런 행이 출처 전체의 62.4%다). 링크가 있다는 사실만 말한다.
  const isBareOnly = !isContextOnly && evidence.identifiedPrimary === 0;

  return (
    <p className="border-t border-border pt-3 text-sm text-muted">
      {isContextOnly || isBareOnly ? (
        <span aria-hidden>▲</span>
      ) : (
        <span
          aria-hidden
          className="signal-live inline-block size-1.5 rounded-full bg-(--signal-cyan) align-middle"
        />
      )}{" "}
      {isContextOnly ? (
        <>
          <span className="font-semibold text-foreground">
            맥락 자료 {evidence.context}개 연결
          </span>{" "}
          — 원본은 아직 찾는 중이에요.
        </>
      ) : isBareOnly ? (
        <>
          <span className="font-semibold text-foreground">
            출처 링크 {evidence.total}개 수집
          </span>{" "}
          — 어떤 자료인지 서지 확인 중이에요.
        </>
      ) : (
        <>
          <span className="stat-mono font-semibold text-foreground">
            근거 링크 {evidence.total}개 연결
          </span>
          {evidence.total > evidence.identifiedPrimary && (
            <> (서지 정보가 있는 일반 자료 {evidence.identifiedPrimary}개)</>
          )}
        </>
      )}
      {moderationStatus === "limited" && <> · 출처 확인 중인 문서예요.</>} · 마지막
      업데이트 {updated}
    </p>
  );
}
