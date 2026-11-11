// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    useLocale: () => ({ locale: "zh-tw", messages: getMessages("zh-tw") }),
  };
});

import { HeaderDiscoveryLinks } from "@/components/header-discovery-links";

afterEach(cleanup);

describe("HeaderDiscoveryLinks", () => {
  it("localizes its navigation name with the active locale messages", () => {
    render(<HeaderDiscoveryLinks />);

    expect(screen.getByRole("navigation", { name: "探索" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "주요 발견" })).toBeNull();
  });

  it("names the Korean explore item 밈 탐색 and keeps it on /explore", () => {
    const source = readFileSync("components/header-discovery-links.tsx", "utf8");
    expect(source).toContain('ko: "밈 탐색"');
    expect(source).toContain('localizedStaticPath("/explore", locale)');
    expect(source).not.toContain("최신 밈");
    expect(source).not.toContain("/explore?sort=recent");
  });
});
