// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CHANGELOG } from "@/lib/changelog";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));

import KoreanRootLayout from "@/app/(default)/layout";
import LocalizedRootLayout from "@/app/[locale]/layout";

const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/rankings",
  "/memes/kh75j5f8-꼰대",
  "/memes/bjk2021k-bun-jo-ka",
  "/memes/t4n9can6-내-마음속에-저장",
  "/explore",
  "/en",
  "/en/about",
  "/en/privacy",
  "/en/rankings",
  "/ja/about",
  "/zh/privacy",
  "/zh-tw/rankings",
] as const;

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  window.localStorage.clear();
  vi.useRealTimers();
});

it("never mounts a changelog modal on any route while entries exist", async () => {
  expect(CHANGELOG.length).toBeGreaterThan(0);
  expect(CHANGELOG.some((entry) => entry.id === "2026-07-22")).toBe(true);
  expect(CHANGELOG.some((entry) => entry.title === "댓글·공감 오픈 & 고객센터 신설")).toBe(true);

  vi.useFakeTimers();

  for (const pathname of ROUTES) {
    navigation.pathname = pathname;
    const locale = pathname.split("/")[1];
    const ui = locale === "en" || locale === "ja" || locale === "zh" || locale === "zh-tw"
      ? await LocalizedRootLayout({
          children: <main>{pathname}</main>,
          params: Promise.resolve({ locale }),
        })
      : KoreanRootLayout({ children: <main>{pathname}</main> });

    const view = render(ui);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    expect(view.container.querySelector('[aria-modal="true"]')).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(view.container.textContent).not.toContain("댓글·공감 오픈");
    expect(view.container.textContent).not.toContain("밈캐치가 업데이트됐어요");
    expect(view.container.textContent).not.toContain("새 소식");
    view.unmount();
  }
});
