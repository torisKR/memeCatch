import type { Metadata } from "next";
import Link from "next/link";

import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import {
  parsePublisherReadinessFocus,
  parsePublisherReadinessPage,
  type PublisherReadinessFocus,
  type PublisherReadinessItem,
} from "@/lib/publisher-readiness";
import { listPublisherReadinessPage } from "@/lib/publisher-readiness.server";
import { evidenceTimestamp } from "@/lib/source-links";
import { PublisherReadinessReviewForm } from "./review-form";

export const metadata: Metadata = {
  title: "퍼블리셔 준비도",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FOCUS_LABELS: Record<PublisherReadinessFocus, string> = {
  source: "공개 출처 없음",
  rights: "권리/전달 근거 확인",
  summary: "요약 없음/제목 반복",
  date: "게시일 확인 필요",
  depth: "고유 설명 부족",
  media: "공개 미디어 확인",
  safety: "안전 검수 확인",
  stale: "삭제·오래된 출처 확인",
  template: "템플릿형 제목 확인",
  copy: "중복 문단 확인",
  review: "사람 검수 확인",
};

const RIGHTS_LABELS: Record<PublisherReadinessItem["rights"]["status"], string> = {
  confirmed_delivery: "전달 근거 확인",
  restricted: "제한 있음",
  unknown: "미확인",
  absent: "출처 없음",
};

const MEDIA_LABELS: Record<PublisherReadinessItem["media"]["status"], string> = {
  renderable: "재생·표시 가능",
  partial: "일부 확인 필요",
  unchecked: "검수 미완료",
  unavailable: "삭제·지역 제한",
  absent: "미디어 없음",
};

const SAFETY_LABELS: Record<PublisherReadinessItem["safety"]["status"], string> = {
  current: "현재 지문 기준 확인",
  stale: "콘텐츠 변경 뒤 재확인 필요",
  unknown: "미확인",
};

const REVIEW_LABELS: Record<PublisherReadinessItem["review"]["status"], string> = {
  current: "사람 검수 완료",
  stale: "사람 검수 만료",
  unreviewed: "사람 검수 미완료",
};

type SearchParams = {
  page?: string | string[];
  focus?: string | string[];
};

function pageHref(page: number, focus: PublisherReadinessFocus | null): string {
  const params = new URLSearchParams({ page: String(page) });
  if (focus) params.set("focus", focus);
  return `/admin/publisher-readiness?${params.toString()}`;
}

function formatPublicationDate(value: string | null): string {
  const timestamp = evidenceTimestamp(value);
  if (!timestamp) return "확인 필요";
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export default async function PublisherReadinessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const page = parsePublisherReadinessPage(raw.page);
  const focus = parsePublisherReadinessFocus(raw.focus);
  const authSearch = {
    page: typeof raw.page === "string" ? raw.page : undefined,
    focus: typeof raw.focus === "string" ? raw.focus : undefined,
  };
  const { supabase } = await requireOperatorPage("/admin/publisher-readiness", authSearch);
  const report = await listPublisherReadinessPage(supabase, { page, focus });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">퍼블리셔 준비도</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          공개 중인 approved/limited 문서를 100개씩 읽어 광고 심사 준비에 필요한 편집·권리·안전
          보완점을 찾습니다. 모든 항목은 광고 검수 보류 진단이며 게시 상태·색인·외부 승인
          판정을 자동으로 변경하지 않습니다.
        </p>
      </header>

      <section aria-labelledby="readiness-summary" className="space-y-3">
        <h2 id="readiness-summary" className="text-lg font-bold">
          검사 범위
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="전체 공개 문서" value={report.totalPublic.toLocaleString("ko-KR")} />
          <Metric label="이번 페이지 검사" value={report.inspectedCount.toLocaleString("ko-KR")} />
          <Metric label="현재 표시" value={`${report.displayedCount.toLocaleString("ko-KR")}건`} />
        </div>
        <p className="text-xs leading-relaxed text-muted">
          전체 수는 공개 코퍼스 전체입니다. 보완점 수와 집중 필터는 이번 페이지에서 검사한
          최대 100개 안에서만 계산하며 전체 코퍼스 통계로 해석하면 안 됩니다.
        </p>
      </section>

      <section aria-labelledby="readiness-focus" className="space-y-3">
        <h2 id="readiness-focus" className="text-lg font-bold">
          현재 페이지 집중 보기
        </h2>
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">보완점</span>
            <select
              name="focus"
              defaultValue={focus ?? ""}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base"
            >
              <option value="">전체 문서</option>
              {Object.entries(FOCUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="page" value={report.page} />
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white"
          >
            적용
          </button>
        </form>
        {focus && (
          <p className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
            <strong>{FOCUS_LABELS[focus]}</strong> 항목을 현재 페이지 안에서만 추렸습니다: {" "}
            {report.displayedCount.toLocaleString("ko-KR")}건
          </p>
        )}
      </section>

      <section aria-labelledby="readiness-results" className="space-y-4">
        <h2 id="readiness-results" className="text-lg font-bold">
          문서별 보완점
        </h2>
        {report.inspectedCount === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
            이 페이지에서 검사할 공개 문서가 없습니다. 전체 수와 페이지 번호를 확인하세요.
          </p>
        ) : report.items.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
            이번 페이지에는 선택한 보완점이 없습니다. 이는 전체 코퍼스의 완료 판정이 아닙니다.
          </p>
        ) : (
          <ul className="space-y-4">
            {report.items.map((item) => (
              <ReadinessCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="퍼블리셔 준비도 페이지 이동" className="flex items-center gap-4 text-sm">
        {report.page > 1 ? (
          <Link href={pageHref(report.page - 1, focus)} className="text-accent-text underline">
            ← 이전
          </Link>
        ) : null}
        <span className="text-muted">
          {report.page.toLocaleString("ko-KR")} / {report.totalPages.toLocaleString("ko-KR")}
        </span>
        {report.page < report.totalPages ? (
          <Link href={pageHref(report.page + 1, focus)} className="text-accent-text underline">
            다음 →
          </Link>
        ) : null}
      </nav>

      <section aria-labelledby="manual-account-checks" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="manual-account-checks" className="text-lg font-bold">
          계정 검토 수동 확인
        </h2>
        <p className="mt-1 text-sm text-muted">
          이 화면은 Google 또는 광고 계정과 통신하지 않으며 실시간 계정 상태를 표시하지 않습니다.
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>AdSense 사이트 화면에서 검토 상태와 최근 안내를 직접 확인합니다.</li>
          <li>공개 ads.txt의 게시자 ID와 계정에 표시된 ID가 같은지 직접 확인합니다.</li>
          <li>장기간 대기 중이면 공식 도움말 또는 문의 채널에서 필요한 후속 조치를 확인합니다.</li>
        </ol>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ReadinessCard({ item }: { item: PublisherReadinessItem }) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{item.title}</h3>
          <p className="mt-1 text-xs text-muted">
            {item.moderationStatus} · 게시일 {formatPublicationDate(item.publishedAt)} · 고유 산문 {" "}
            {item.depth.proseChars.toLocaleString("ko-KR")}자 · 깊이 {item.depth.score}점
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={item.editHref} className="text-accent-text underline">
            편집
          </Link>
          <Link href={item.publicHref} className="text-accent-text underline">
            공개 페이지
          </Link>
          <Link href={item.sourceWorkflowHref} className="text-accent-text underline">
            출처 검수
          </Link>
        </div>
      </div>

      {item.safeSourceUrls.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-sm font-semibold">공개 HTTP(S) 형식 출처</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {item.safeSourceUrls.map((url) => (
              <li key={url} className="truncate">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-text underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Diagnostic label="권리/전달 근거" value={RIGHTS_LABELS[item.rights.status]} />
        <Diagnostic label="공개 미디어" value={MEDIA_LABELS[item.media.status]} />
        <Diagnostic label="안전 검수" value={SAFETY_LABELS[item.safety.status]} />
        <Diagnostic label="사람 검수" value={REVIEW_LABELS[item.review.status]} />
      </dl>

      {item.issues.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          이 페이지에서 검사하는 네 가지 내부 보완점은 발견되지 않았습니다. 외부 심사나 사실 검증의
          완료를 뜻하지 않습니다.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {item.issues.map((issue) => (
            <li key={issue.code} className="rounded-lg bg-surface-2 p-3 text-sm leading-relaxed">
              <strong>{issue.label}</strong>
              <p className="mt-1 text-muted">{issue.explanation}</p>
              <p className="mt-1">다음 작업: {issue.action}</p>
            </li>
          ))}
        </ul>
      )}

      {item.review.status === "current" ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <strong>현재 지문 검수 완료</strong>
          <p className="mt-1 text-muted">
            {item.review.reviewedAt ? formatPublicationDate(item.review.reviewedAt) : "시각 확인 필요"}
            {item.review.note ? ` · ${item.review.note}` : ""}
          </p>
        </div>
      ) : (
        <details className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
          <summary className="cursor-pointer text-sm font-semibold">사람 검수 기록하기</summary>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            이 기록은 관리자 진단과 활성화 전 배치 확인에만 사용합니다. 공개 상태, 색인, 광고 활성화를
            자동 변경하거나 독창성을 자동 인증하지 않습니다. 핵심 본문·출처·권리·안전 정보가 바뀌면
            현재 검수는 만료됩니다.
          </p>
          <PublisherReadinessReviewForm
            memeId={item.id}
            expectedFingerprint={item.fingerprint}
          />
        </details>
      )}
    </li>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
