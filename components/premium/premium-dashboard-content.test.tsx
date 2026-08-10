import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "zh", messages: getMessages("zh") }) };
});

import { PremiumDashboardContent } from "@/components/premium/premium-dashboard-content";

describe("PremiumDashboardContent", () => {
  it("shows the active membership and its protected feed", () => {
    const html = renderToStaticMarkup(
      <PremiumDashboardContent
        isPremium
        status="active"
        currentPeriodEnd="2026-08-18T00:00:00+09:00"
        feed={<div>protected feed</div>}
        savedMemeCount={2}
        outcomeSnapshot={<div>outcome snapshot</div>}
        dailySignal={<div>today signal</div>}
        globalScout={<div>global scout deck</div>}
        actionInbox={<div>global action inbox</div>}
        primaryMission="outcome"
        translationFulfillment={<div>translation fulfillment desk</div>}
        savedReuseRadar={<div>saved reuse radar</div>}
      />,
    );

    expect(html).toContain("完成今天的一张迷因卡");
    expect(html).toContain("使用中");
    expect(html).toContain("protected feed");
    expect(html).toContain("outcome snapshot");
    expect(html).toContain("已收藏迷因的上升提醒");
    expect(html).toContain("2 个迷因");
    expect(html).toContain("today signal");
    expect(html).toContain("global scout deck");
    expect(html).toContain("global action inbox");
    expect(html.indexOf("outcome snapshot")).toBeLessThan(html.indexOf("global action inbox"));
    expect(html.indexOf("global action inbox")).toBeLessThan(html.indexOf("protected feed"));
    expect(html).toContain("translation fulfillment desk");
    expect(html).toContain("saved reuse radar");
    expect(html).toContain("今天的全球迷因");
    expect(html).toContain("开始第一题");
    expect(html).not.toContain("用 Plus 解锁今天的迷因");
    expect(html).toContain('href="/zh/daily"');
  });

  it("can put the action surface before the historical outcome snapshot", () => {
    const html = renderToStaticMarkup(
      <PremiumDashboardContent
        isPremium
        status="active"
        currentPeriodEnd={null}
        feed={<div>protected feed</div>}
        primaryMission="action"
        outcomeSnapshot={<div>outcome snapshot</div>}
        actionInbox={<div>today one cut</div>}
      />,
    );

    expect(html.indexOf("today one cut")).toBeLessThan(html.indexOf("outcome snapshot"));
  });

  it("puts the embedded global challenge before history without duplicating the daily entry", () => {
    const html = renderToStaticMarkup(
      <PremiumDashboardContent
        isPremium
        status="active"
        currentPeriodEnd={null}
        feed={<div>feed</div>}
        primaryMission="action"
        actionInbox={<div>action inbox</div>}
        outcomeSnapshot={<div>outcome snapshot</div>}
        globalDailyChallenge={<div>global starter session</div>}
        outcomeHistory={<div>outcome history</div>}
      />,
    );

    expect(html.indexOf("action inbox")).toBeLessThan(html.indexOf("global starter session"));
    expect(html.indexOf("outcome snapshot")).toBeLessThan(html.indexOf("global starter session"));
    expect(html.indexOf("global starter session")).toBeLessThan(html.indexOf("outcome history"));
    expect(html.indexOf("outcome history")).toBeLessThan(html.indexOf("feed"));
    expect(html).not.toContain('href="/zh/daily"');
    expect(html).not.toContain("시작");
  });

  it("puts Global Daily first when it is the selected primary mission", () => {
    const html = renderToStaticMarkup(
      <PremiumDashboardContent
        isPremium
        status="active"
        currentPeriodEnd={null}
        feed={<div>feed</div>}
        primaryMission="global_daily"
        actionInbox={<div>action inbox</div>}
        outcomeSnapshot={<div>outcome snapshot</div>}
        globalDailyChallenge={<div>global daily mission</div>}
      />,
    );

    expect(html.indexOf("global daily mission")).toBeLessThan(html.indexOf("action inbox"));
    expect(html.indexOf("global daily mission")).toBeLessThan(html.indexOf("outcome snapshot"));
    expect(html).toContain("更多 Plus 工具");
    expect(html).toContain("<details");
  });

  it("shows an explicit unavailable primary state instead of choosing a stale fallback", () => {
    const html = renderToStaticMarkup(
      <PremiumDashboardContent
        isPremium
        status="active"
        currentPeriodEnd={null}
        feed={null}
        primaryMission="unavailable"
      />,
    );

    expect(html).toContain('data-premium-primary-mission="unavailable"');
    expect(html).toContain("暂时无法选择下一步行动");
  });

  it("shows the locked outcome history slot beside the free membership gate", () => {
    const html = renderToStaticMarkup(
      <PremiumDashboardContent
        isPremium={false}
        status="none"
        currentPeriodEnd={null}
        feed={null}
        outcomeHistory={<div data-testid="locked-history">locked history</div>}
      />,
    );

    expect(html).toContain("locked history");
    expect(html.indexOf("locked history")).toBeGreaterThan(html.indexOf("view plans"));
  });
});
