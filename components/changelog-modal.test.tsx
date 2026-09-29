// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CHANGELOG, LATEST_CHANGELOG_ID } from "@/lib/changelog";
import { ChangelogModal } from "./changelog-modal";

const navigation = vi.hoisted(() => ({ pathname: "/explore" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  navigation.pathname = "/explore";
});

it.each(["/", "/index", "/en", "/ja", "/zh", "/zh-tw", "/en/"])(
  "does not cover the top artwork or mark notices read on home %s", (pathname) => {
    vi.useFakeTimers();
    navigation.pathname = pathname;
    render(<ChangelogModal />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(window.localStorage.getItem("mc:changelog:last-seen")).toBeNull();
  },
);

it("releases a previously opened dialog and scroll lock when entering home", () => {
  vi.useFakeTimers();
  navigation.pathname = "/explore";
  const { rerender } = render(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByRole("dialog")).toBeTruthy();
  navigation.pathname = "/en";
  rerender(<ChangelogModal />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("starts a fresh delay after leaving home instead of reusing a stale dialog", () => {
  vi.useFakeTimers();
  navigation.pathname = "/explore";
  const { rerender } = render(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByRole("dialog")).toBeTruthy();
  navigation.pathname = "/en";
  rerender(<ChangelogModal />);
  expect(screen.queryByRole("dialog")).toBeNull();
  navigation.pathname = "/en/search";
  rerender(<ChangelogModal />);
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(799));
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(window.localStorage.getItem("mc:changelog:last-seen")).toBeNull();
});

it("이전 소식을 읽은 사용자가 새 안내로 이동하면 읽음 처리해 다시 띄우지 않는다", () => {
  vi.useFakeTimers();
  window.localStorage.setItem("mc:changelog:last-seen", CHANGELOG[1].id);

  const { unmount } = render(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(800));

  expect(screen.getByRole("dialog")).toBeTruthy();
  const link = screen.getByRole("link", { name: "무료 확인표와 참여 안내 보기" });
  expect(link.getAttribute("href")).toBe(
    "/community/745c8c04-0ec1-4abd-bee4-3a5d41df6a77",
  );
  link.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(link);

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(window.localStorage.getItem("mc:changelog:last-seen")).toBe(LATEST_CHANGELOG_ID);
  expect(document.body.style.overflow).not.toBe("hidden");

  unmount();
  render(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(800));
  expect(screen.queryByRole("dialog")).toBeNull();
});
