// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a"> & { prefetch?: boolean }) => {
    const { prefetch, ...anchorProps } = props;
    void prefetch;
    return <a {...anchorProps}>{children}</a>;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ messages: getMessages("ko") }) };
});

import { HeaderMenu } from "./header-menu";

describe("HeaderMenu", () => {
  it("keeps the reduced first-week menu without product or community links", async () => {
    const user = userEvent.setup();
    render(<HeaderMenu />);

    await user.click(screen.getByRole("button", { name: "메뉴" }));

    expect(screen.getByRole("navigation", { name: "메뉴" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "커뮤니티" })).toBeNull();
    expect(screen.queryByRole("link", { name: "밈 상품" })).toBeNull();
    expect(screen.getByRole("link", { name: "연표" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "밈캐치 내 급상승" })).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "메뉴" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "메뉴" }));
  });
});
