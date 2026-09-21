import { getAdminGA4Report } from "@/lib/ga4-admin";
import { GA4ReportPanel } from "@/components/admin/ga4-report-panel";

export const metadata = { title: "GA4 리포트" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminAnalyticsPage() {
  const report = await getAdminGA4Report();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">GA4 리포트</h1>
        <form action="/admin/analytics" method="get">
          <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2">다시 조회</button>
        </form>
      </div>
      <p className="text-sm text-muted">Google Analytics Data API · 어제까지 최근 28일 · GA4 속성 시간대 기준. 처리 지연·동의·광고 차단 등으로 내부 DB 조회수와 다를 수 있어요. 실시간 통계가 아닙니다.</p>
      <GA4ReportPanel report={report} />
    </div>
  );
}
