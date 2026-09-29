// @vitest-environment jsdom

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
});
