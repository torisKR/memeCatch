import type { GA4Report } from "@/lib/ga4-admin";

const labels = {
  activeUsers: "활성 사용자",
  sessions: "세션",
  screenPageViews: "페이지·화면 조회",
  eventCount: "이벤트",
} as const;
const errors = {
  authentication: "Google 인증에 실패했어요. 서비스 계정 키를 확인해 주세요.",
  permission: "GA4 접근 권한이 없어요. Data API 활성화와 속성의 서비스 계정 Viewer 권한을 확인해 주세요.",
  quota: "Google API 할당량에 도달했어요. 잠시 후 다시 조회해 주세요.",
  unavailable: "Google Analytics에 연결할 수 없어요. 잠시 후 다시 조회해 주세요.",
  invalid_response: "Google 응답을 검증할 수 없어 통계를 표시하지 않았어요.",
};

export function GA4ReportPanel({ report }: { report: GA4Report }) {
  if (report.status === "ready" && !report.totals) return <GA4ReportPanel report={{ status: "empty" }} />;
  if (report.status !== "ready") {
    return (
      <section role="status" className="space-y-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">{report.status === "missing_config" ? "GA4 연결 설정 필요" : report.status === "empty" ? "조회 기간 데이터 없음" : "GA4 리포트 사용 불가"}</h2>
        {report.status === "missing_config" ? <>
          <p className="text-sm text-muted">서버 환경변수를 설정해야 실제 리포트를 조회할 수 있어요. NEXT_PUBLIC_GA_ID는 수집용 측정 ID이며 보고서 접근 권한이 아닙니다.</p>
          <ul className="list-inside list-disc text-sm">{report.missing.map((name) => <li key={name}><code>{name}</code></li>)}</ul>
          <p className="text-sm text-muted">GA4 속성의 숫자 ID와 서비스 계정 자격 증명을 서버에만 등록하고, Google Analytics Data API를 활성화한 뒤 서비스 계정에 속성 Viewer 권한을 부여해 주세요. 비밀 키를 공개 환경변수에 넣지 마세요.</p>
        </> : <p className="text-sm text-muted">{report.status === "invalid_config" ? "서버의 GA4 속성 ID 또는 서비스 계정 설정 형식이 올바르지 않아요." : report.status === "empty" ? "Google이 이 기간의 행을 반환하지 않았어요. 수집 상태와 속성을 확인해 주세요. 빈 결과를 0으로 대체하지 않습니다." : errors[report.reason]}</p>}
      </section>
    );
  }
  return <div className="space-y-5">
    <p className="text-sm text-muted">속성 시간대: {report.timeZone ?? "제공되지 않음"} · 조회 시각: {report.fetchedAt}</p>
    {report.thresholded && <p role="status" className="rounded-lg border border-border p-3 text-sm">Google 개인정보 보호 기준에 따라 일부 데이터가 제한될 수 있어요.</p>}
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => <div key={key} className="rounded-xl border border-border bg-surface p-4"><dt className="text-sm text-muted">{labels[key]}</dt><dd className="mt-2 text-2xl font-bold tabular-nums">{report.totals![key].toLocaleString("ko-KR")}</dd></div>)}
    </dl>
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="p-4 text-left font-semibold">일별 통계 · Google이 반환한 날짜만 표시</caption>
        <thead><tr className="border-b border-border"><th scope="col" className="p-3">날짜</th>{Object.values(labels).map((label) => <th scope="col" key={label} className="p-3 text-right">{label}</th>)}</tr></thead>
        <tbody>{report.daily.map((row) => <tr key={row.date} className="border-b border-border last:border-0"><th scope="row" className="whitespace-nowrap p-3 font-normal">{row.date}</th>{(Object.keys(labels) as (keyof typeof labels)[]).map((key) => <td key={key} className="p-3 text-right tabular-nums">{row[key].toLocaleString("ko-KR")}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}
