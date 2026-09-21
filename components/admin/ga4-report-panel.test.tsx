import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GA4ReportPanel } from "./ga4-report-panel";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/analytics" }));
import { AdminNav } from "./admin-nav";

describe("GA4 admin UI", () => {
  it("shows missing config instead of zero cards", () => {
    const html = renderToStaticMarkup(<GA4ReportPanel report={{ status: "missing_config", missing: ["GA4_PROPERTY_ID"] }} />);
    expect(html).toContain("GA4 연결 설정 필요");
    expect(html).toContain("GA4_PROPERTY_ID");
    expect(html).not.toContain("<dl");
  });
  it.each(["authentication", "permission", "quota", "unavailable", "invalid_response"] as const)("shows %s without metrics", (reason) => {
    const html = renderToStaticMarkup(<GA4ReportPanel report={{ status: "error", reason }} />);
    expect(html).toContain("GA4 리포트 사용 불가");
    expect(html).not.toContain("<table");
  });
  it("shows empty data separately", () => {
    expect(renderToStaticMarkup(<GA4ReportPanel report={{ status: "empty" }} />)).toContain("조회 기간 데이터 없음");
  });
  it("renders returned report and threshold notice", () => {
    const metrics = { activeUsers: 1234, sessions: 3, screenPageViews: 4, eventCount: 5 };
    const html = renderToStaticMarkup(<GA4ReportPanel report={{ status: "ready", totals: metrics, daily: [{ ...metrics, date: "2026-09-20" }], timeZone: "Asia/Seoul", thresholded: true, fetchedAt: "2026-09-21T00:00:00Z" }} />);
    expect(html).toContain("1,234");
    expect(html).toContain("Asia/Seoul");
    expect(html).toContain("일부 데이터가 제한");
    expect(html).toContain("2026-09-20");
  });
  it("links to GA4 separately from moderation reports", () => {
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html).toContain('href="/admin/analytics"');
    expect(html).toContain("GA4 리포트");
    expect(html).toContain('href="/admin/reports"');
  });
});
