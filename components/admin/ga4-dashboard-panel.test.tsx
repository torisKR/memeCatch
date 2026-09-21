import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GA4DashboardPanel } from "./ga4-dashboard-panel";
import type { GA4Report } from "@/lib/ga4-admin";

const metrics = { activeUsers: 7, sessions: 12, screenPageViews: 1234, eventCount: 25 };
const report: Extract<GA4Report, { status: "ready" }> = {
  status: "ready", totals: metrics, today: metrics,
  daily: [{ ...metrics, date: "2026-09-20" }],
  channels: [{ ...metrics, name: "Organic Search" }],
  pages: [{ ...metrics, name: "/memes/test" }],
  timeZone: "America/Los_Angeles", fetchedAt: "2026-09-21T00:00:00Z", thresholded: true,
};
describe("GA4 dashboard", () => {
  it("shows genuine today sessions, historical pageviews, sources and property timezone", () => {
    const html = renderToStaticMarkup(<GA4DashboardPanel report={report} />);
    for (const text of ["오늘 방문 세션", "12", "1,234", "최근 14일", "어제까지", "America/Los_Angeles", "집계 중", "실시간", "Organic Search", "/memes/test", "일부 데이터가 제한"]) expect(html).toContain(text);
  });
  it("does not fabricate today zeros when Google returns no rows", () => {
    const html = renderToStaticMarkup(<GA4DashboardPanel report={{ ...report, today: null }} />);
    expect(html).toContain("오늘 데이터 없음");
  });
  it("does not render metrics or charts on API failure", () => {
    const html = renderToStaticMarkup(<GA4DashboardPanel report={{ status: "error", reason: "quota" }} />);
    expect(html).toContain("할당량");
    expect(html).not.toContain("<dl");
    expect(html).not.toContain("<table");
  });
});
