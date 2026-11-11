// @vitest-environment jsdom

import type { ComponentPropsWithoutRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
}));

import { CommunityMemeBattle } from "@/components/home/community-meme-battle";
import type { BattleBoard } from "@/lib/community-battle";

afterEach(cleanup);

const boards: BattleBoard[] = [
  {
    period: "day",
    status: "ready",
    totalPosts: 3,
    promotionCount: 1,
    entries: [
      { postId: "a", title: "오늘의 1등", likeCount: 9, commentCount: 1, rank: 1, isPromotionCandidate: true },
      { postId: "b", title: "오늘의 2등", likeCount: 4, commentCount: 0, rank: 2, isPromotionCandidate: false },
    ],
  },
  { period: "week", status: "ready", totalPosts: 0, promotionCount: 0, entries: [] },
  { period: "month", status: "unavailable", totalPosts: 0, promotionCount: 0, entries: [] },
];

describe("CommunityMemeBattle", () => {
  it("shows today's ranking first with the top 1% badge only on candidates", () => {
    render(<CommunityMemeBattle boards={boards} />);

    expect(screen.getByRole("tab", { name: "오늘" }).getAttribute("aria-selected")).toBe("true");
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/community/") && link.getAttribute("href") !== "/community/new");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/community/a", "/community/b"]);
    expect(screen.getAllByText("상위 1% 후보")).toHaveLength(1);
    expect(screen.getByText("참가 3개 중 상위 1개가 밈 사전 후보예요.")).toBeTruthy();
  });

  it("switches periods and shows empty and unavailable states", () => {
    render(<CommunityMemeBattle boards={boards} />);

    fireEvent.click(screen.getByRole("tab", { name: "이번 주" }));
    expect(screen.getByText("이번 주 올라온 밈이 아직 없어요. 첫 밈을 올려 보세요.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "이번 달" }));
    expect(screen.queryByText("순위를 불러오지 못했어요. 잠시 후 다시 열어 주세요.")).toBeNull();
    expect(screen.getByText("이번 달 올라온 밈이 아직 없어요. 첫 밈을 올려 보세요.")).toBeTruthy();
  });

  it("opens this week when today has no entries", () => {
    render(
      <CommunityMemeBattle
        boards={[
          { period: "day", status: "ready", totalPosts: 0, promotionCount: 0, entries: [] },
          {
            period: "week",
            status: "ready",
            totalPosts: 2,
            promotionCount: 1,
            entries: [
              { postId: "w", title: "이번 주 1등", likeCount: 3, commentCount: 0, rank: 1, isPromotionCandidate: true },
            ],
          },
          { period: "month", status: "ready", totalPosts: 0, promotionCount: 0, entries: [] },
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: "이번 주" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "오늘" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.queryByText("오늘 올라온 밈이 아직 없어요. 첫 밈을 올려 보세요.")).toBeNull();
    expect(screen.getByText("이번 주 1등")).toBeTruthy();
  });

  it("links to posting and voting", () => {
    render(<CommunityMemeBattle boards={boards} />);
    expect(screen.getByRole("link", { name: "밈 올리기" }).getAttribute("href")).toBe("/community/new");
    expect(screen.getByRole("link", { name: "투표하러 가기" }).getAttribute("href")).toBe("/community");
  });
});
