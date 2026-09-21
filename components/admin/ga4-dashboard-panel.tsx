import Link from "next/link";
import type { GA4Report } from "@/lib/ga4-admin";
import { GA4ReportPanel } from "./ga4-report-panel";

export function GA4DashboardPanel({ report }: { report: GA4Report }) {
  if (report.status !== "ready") return <GA4ReportPanel report={report} />;
  const maxViews = Math.max(1, ...report.daily.map((row) => row.screenPageViews));
  const cards = [
    ["오늘 방문 세션", report.today?.sessions],
    ["오늘 활성 사용자", report.today?.activeUsers],
    ["오늘 페이지·화면 조회", report.today?.screenPageViews],
    ["최근 14일 활성 사용자", report.totals?.activeUsers],
  ] as const;
  return <section aria-labelledby="ga4-dashboard" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="ga4-dashboard" className="text-lg font-bold">방문 분석 · GA4</h2>
      <Link href="/admin/analytics" className="text-sm text-accent-text underline">28일 상세 리포트</Link>
    </div>
    <p className="text-sm text-muted">속성 시간대: {report.timeZone ?? "제공되지 않음"} · 조회 시각: {report.fetchedAt}</p>
    <p className="text-sm text-muted">오늘은 집계 중인 부분 데이터이며 처리 지연으로 변경될 수 있어요. 실시간 접속자 수가 아닌 GA4 보고서 세션입니다. 최근 14일은 어제까지의 날짜를 기준으로 합니다.</p>
    {report.thresholded && <p role="status" className="text-sm text-muted">Google 개인정보 보호 기준에 따라 일부 데이터가 제한될 수 있어요.</p>}
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface p-5"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 text-2xl font-bold tabular-nums">{value === undefined ? (label.startsWith("오늘") ? "오늘 데이터 없음" : "기간 데이터 없음") : value.toLocaleString("ko-KR")}</dd></div>)}
    </dl>
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-bold">최근 14일 페이지·화면 조회 추이 · 어제까지</h3>
      {report.historicalEmpty && <p className="mt-2 text-sm text-muted">기간 데이터 없음</p>}
      <p className="mt-1 text-sm text-muted">GA4 screenPageViews · Google이 반환한 날짜만 표시하며 누락 날짜를 0으로 채우지 않습니다.</p>
      <div aria-hidden="true" className="mt-4 flex h-24 items-end gap-1">
        {report.daily.map((row) => <div key={row.date} className="flex-1 rounded-t bg-accent-strong/80" style={{ height: `${Math.max(row.screenPageViews > 0 ? 3 : 1, row.screenPageViews / maxViews * 88)}px` }} title={`${row.date} · ${row.screenPageViews}`} />)}
      </div>
      <details className="mt-3 text-sm"><summary className="cursor-pointer">날짜별 수치 보기</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-left"><caption className="sr-only">GA4 최근 14일 일별 조회·세션</caption><thead><tr><th scope="col">날짜</th><th scope="col">페이지·화면 조회</th><th scope="col">세션</th></tr></thead><tbody>{report.daily.map((row) => <tr key={row.date}><th scope="row" className="py-1 text-left font-normal">{row.date}</th><td>{row.screenPageViews.toLocaleString("ko-KR")}</td><td>{row.sessions.toLocaleString("ko-KR")}</td></tr>)}</tbody></table></div></details>
      <div className="mt-2 flex justify-between text-xs text-muted"><span>{report.daily[0]?.date}</span><span>{report.daily.at(-1)?.date}</span></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {([
        ["유입 채널", report.channels ?? [], "sessions", "세션"],
        ["인기 페이지", report.pages ?? [], "screenPageViews", "페이지·화면 조회"],
      ] as const).map(([title, rows, metric, label]) => <div key={title} className="min-w-0 rounded-xl border border-border bg-surface p-5"><h3 className="font-bold">{title} · 최근 14일 상위 10개</h3>{rows.length === 0 ? <p className="mt-2 text-sm text-muted">반환된 데이터가 없어요.</p> : <div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm"><thead><tr><th scope="col">{title}</th><th scope="col" className="text-right">{label}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name} className="border-t border-border"><th scope="row" className="break-all py-2 pr-3 text-left font-normal">{row.name}</th><td className="text-right tabular-nums">{row[metric].toLocaleString("ko-KR")}</td></tr>)}</tbody></table></div>}</div>)}
    </div>
  </section>;
}
