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
      { postId: "a", title: "오늘의 1등", thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", likeCount: 9, commentCount: 1, rank: 1, isPromotionCandidate: true },
      { postId: "b", title: "오늘의 2등", thumbnailUrl: null, likeCount: 4, commentCount: 0, rank: 2, isPromotionCandidate: false },
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

  it("links to posting and voting", () => {
    render(<CommunityMemeBattle boards={boards} />);
    expect(screen.getByRole("link", { name: "밈 올리기" }).getAttribute("href")).toBe("/community/new");
    expect(screen.getByRole("link", { name: "투표하러 가기" }).getAttribute("href")).toBe("/community");
  });

  it("renders all 12 ranked links without clipping the list", () => {
    const fullBoard: BattleBoard = {
      ...boards[0],
      totalPosts: 12,
      entries: Array.from({ length: 12 }, (_, index) => ({
        postId: `post-${index + 1}`,
        title: `순위 밈 ${index + 1}`,
        thumbnailUrl: null,
        likeCount: 12 - index,
        commentCount: index,
        rank: index + 1,
        isPromotionCandidate: index === 0,
      })),
    };

    render(<CommunityMemeBattle boards={[fullBoard, boards[1], boards[2]]} />);

    const rankedLinks = screen.getAllByRole("link").filter((link) =>
      /^\/community\/post-\d+$/.test(link.getAttribute("href") ?? ""),
    );
    expect(rankedLinks).toHaveLength(12);
    expect(rankedLinks.at(-1)?.getAttribute("href")).toBe("/community/post-12");
  });

  it("replaces a failed thumbnail with the small safe fallback", () => {
    render(<CommunityMemeBattle boards={boards} />);

    const image = document.querySelector<HTMLImageElement>(
      'img[src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"]',
    );
    expect(image).not.toBeNull();
    fireEvent.error(image!);

    expect(document.querySelector('img[src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"]')).toBeNull();
    expect(document.querySelectorAll('[data-thumbnail-state="fallback"]').length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "이번 주" })).toBeTruthy();
  });

  it("links to the community when the database cap leaves more entries", () => {
    render(<CommunityMemeBattle boards={[{ ...boards[0], totalPosts: 51 }, boards[1], boards[2]]} />);

    expect(
      screen.getByRole("link", { name: "나머지 참가작은 커뮤니티에서 보기" }).getAttribute("href"),
    ).toBe("/community");
  });
});
