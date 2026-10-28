// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const localeState = vi.hoisted(() => ({ value: "ko" as "ko" | "zh-tw" }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a"> & { prefetch?: boolean }) => {
    const { prefetch, ...anchorProps } = props;
    void prefetch;
    return <a {...anchorProps}>{children}</a>;
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({
      locale: localeState.value,
      messages: getMessages(localeState.value),
    }),
  };
});

import { HeaderMenu } from "./header-menu";

describe("HeaderMenu", () => {
  beforeEach(() => {
    localeState.value = "ko";
  });

  afterEach(cleanup);

  it("moves secondary destinations and language selection into the menu", async () => {
    const user = userEvent.setup();
    render(<HeaderMenu />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));

    expect(screen.getByRole("navigation", { name: "메뉴" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "커뮤니티" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "밈 상품" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "제보" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Plus" }).getAttribute("href")).toBe("/pricing");
    expect(screen.getByRole("link", { name: "연표" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "밈카드" }).getAttribute("href")).toBe("/meme-cards");
    expect(screen.getByRole("combobox", { name: "언어 선택" })).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "메뉴" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "메뉴" }));
  });

  it("uses Traditional Chinese for the zh-tw menu label", () => {
    localeState.value = "zh-tw";
    render(<HeaderMenu />);

    expect(screen.getByRole("button", { name: "選單" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "菜单" })).toBeNull();
  });
});
