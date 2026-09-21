// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activityHref, adminActivitySchema, parseActivityFilters, type AdminActivity } from "@/lib/admin-activity";
import { ActivityDashboard } from "./activity-dashboard";
import AdminActivityPage from "@/app/(admin)/admin/activity/page";
import PrivateAdminDocument, { metadata as privateMetadata } from "@/app/(admin)/layout";

const { guard, rpc } = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/app/(default)/admin/require-operator", () => ({ requireOperatorPage: guard }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/activity" }));

const userId = "a4e24b86-a81e-4464-b39f-c1a8b9cac077";
const now = new Date("2026-09-05T15:30:00Z");
const filters = parseActivityFilters({}, now).filters;
const fixture: AdminActivity = {
  generatedAt: now.toISOString(), range: { from: filters.from, to: filters.to, hourDate: filters.hourDate },
  summary: { views: 2, activeUsers: 1, anonymousSessions: 1, currentSubscribers: 1 },
  daily: [{ date: filters.to, views: 2, activeUsers: 1, anonymousSessions: 1 }],
  hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0, activeUsers: 0, anonymousSessions: 0 })),
  users: { total: 26, page: 1, pageSize: 25, items: [
    { id: userId, nickname: "테스트 회원", isPlus: true, plusUntil: "2026-10-01T00:00:00+00:00", views: 2, lastSeenAt: now.toISOString() },
  ] },
  views: { total: 51, page: 1, pageSize: 50, items: [
    { id: "53a4f876-4e70-4d44-b1f8-9655f7abaeee", eventAt: now.toISOString(), userId, nickname: "테스트 회원", memeId: "d9fa46cd-939f-4f41-8b6d-e7f52a1cefc8", title: "테스트 밈", shortId: "test01", slug: "테스트 밈" },
    { id: "53a4f876-4e70-4d44-b1f8-9655f7abaeef", eventAt: now.toISOString(), userId: null, nickname: null, memeId: null, title: null, shortId: null, slug: null },
  ] },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  guard.mockResolvedValue({ supabase: { rpc }, user: { id: userId } });
  rpc.mockResolvedValue({ data: fixture, error: null });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); });

describe("admin activity boundaries", () => {
  it("uses an isolated no-referrer document without marketing chrome or external scripts", () => {
    const html = renderToStaticMarkup(<PrivateAdminDocument><p>private activity</p></PrivateAdminDocument>);
    expect(html).toContain("private activity");
    // Match the shared admin layout's system-selected light/dark tokens.
    expect(html).not.toContain("theme-ink");
    expect(html).toContain('class="bg-background text-foreground"');
    expect(html).not.toMatch(/<iframe|<script|<footer|googletagmanager|ads-partners/);
    expect(privateMetadata.referrer).toBe("no-referrer");
    expect(privateMetadata.robots).toEqual({ index: false, follow: false });
  });
  it("defaults to seven KST calendar days and validates the inclusive 31-day boundary", () => {
    expect(filters).toMatchObject({ from: "2026-08-31", to: "2026-09-06", hourDate: "2026-09-06" });
    expect(parseActivityFilters({ from: "2026-08-07", to: "2026-09-06" }, now).error).toBeNull();
    for (const query of [
      { from: "2026-08-06" }, { from: "2026-09-07" }, { to: "2026-09-07" },
      { to: "2026-02-30" }, { hourDate: "2026-08-30" }, { userId: "invalid" },
      { usersPage: "10001" }, { viewsPage: "0" }, { from: ["2026-09-01"] }, { subscribersOnly: "true" },
    ]) expect(parseActivityFilters(query, now).error).not.toBeNull();
    expect(parseActivityFilters({ from: "2024-02-29", to: "2024-02-29" }, now).error).toBeNull();
    expect(parseActivityFilters({ userId: "00000000-0000-0000-0000-000000000001" }, now).error).toBeNull();
  });

  it("preserves the time and subscriber filters while independently paging and selecting a user", () => {
    const href = activityHref({ ...filters, subscribersOnly: true, usersPage: 2, viewsPage: 3 }, { userId, viewsPage: 1 }, "activity-views");
    const url = new URL(href, "https://example.test");
    expect(url.searchParams.get("subscribersOnly")).toBe("1");
    expect(url.searchParams.get("usersPage")).toBe("2");
    expect(url.searchParams.has("viewsPage")).toBe(false);
    expect(url.searchParams.get("userId")).toBe(userId);
    expect(url.searchParams.get("hourDate")).toBe(filters.hourDate);
  });

  it("strips non-DTO fields and rejects malformed aggregates", () => {
    const parsed = adminActivitySchema.parse({ ...fixture, secret: "private", users: { ...fixture.users, items: [{ ...fixture.users.items[0], email: "private@example.test", metadata: { query: "private" } }] } });
    expect(JSON.stringify(parsed)).not.toContain("private");
    expect(adminActivitySchema.safeParse({ ...fixture, summary: { ...fixture.summary, views: -1 } }).success).toBe(false);
    expect(adminActivitySchema.safeParse({ ...fixture, hourly: [] }).success).toBe(false);
  });

  it("authorizes before calling the read-only RPC with validated parameters", async () => {
    render(await AdminActivityPage({ searchParams: Promise.resolve({ userId, subscribersOnly: "1" }) }));
    expect(guard).toHaveBeenCalledWith("/admin/activity");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_admin_activity_dashboard", {
      p_from: filters.from, p_to: filters.to, p_hour_date: filters.hourDate,
      p_user_id: userId, p_subscribers_only: true, p_users_page: 1, p_views_page: 1,
    });
    expect(guard.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
    expect(screen.getByRole("heading", { name: /현재 구독 중인 사용자/ })).toBeTruthy();
  });

  it("does not query activity when the operator guard denies access", async () => {
    guard.mockRejectedValue(new Error("redirect"));
    await expect(AdminActivityPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not query activity for invalid filters", async () => {
    render(await AdminActivityPage({ searchParams: Promise.resolve({ userId: "invalid" }) }));
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("조회 조건");
    expect(screen.queryByRole("region", { name: "활동 요약" })).toBeNull();
  });

  it.each(["error", "malformed", "throw"])("shows unavailable, not zero metrics or internal error data: %s", async (kind) => {
    if (kind === "throw") rpc.mockRejectedValue(new Error("private token"));
    else rpc.mockResolvedValue({ data: kind === "malformed" ? {} : fixture, error: kind === "error" ? { message: "private token" } : null });
    render(await AdminActivityPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert").textContent).toContain("불러오지 못했습니다");
    expect(document.body.textContent).not.toContain("private token");
    expect(screen.queryByRole("region", { name: "활동 요약" })).toBeNull();
  });

  it("renders KST buckets, user/content links, pagination and missing content without identifying anonymous sessions", () => {
    render(<ActivityDashboard data={fixture} filters={filters} today={filters.to} error={null} />);
    expect(screen.getByLabelText("시작일")).toBeTruthy();
    expect(screen.getByRole("link", { name: "테스트 회원 조회 내역" }).getAttribute("href")).toContain(`userId=${userId}`);
    expect(screen.getByRole("link", { name: "테스트 밈" }).getAttribute("href")).toBe("/memes/test01-%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EB%B0%88");
    expect(screen.getByText("23:00–23:59")).toBeTruthy();
    expect(screen.getByText("익명 / 삭제된 계정")).toBeTruthy();
    expect(screen.getByText("삭제되었거나 연결되지 않은 콘텐츠")).toBeTruthy();
    expect(screen.getByRole("link", { name: "사용자 다음 페이지" }).getAttribute("href")).toContain("usersPage=2");
    expect(screen.getByRole("link", { name: "조회 내역 다음 페이지" }).getAttribute("href")).toContain("viewsPage=2");
    expect(screen.getByRole("link", { name: filters.to }).getAttribute("href")).toContain("#hourly-activity");
  });
});
