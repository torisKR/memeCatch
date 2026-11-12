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

it("does not show the retired 2026-09-05 notice, and confirming the latest notice marks it read", () => {
  vi.useFakeTimers();
  render(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(800));

  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(CHANGELOG.some((entry) => entry.id === "2026-09-05")).toBe(false);
  expect(LATEST_CHANGELOG_ID).not.toBe("2026-09-05");
  expect(screen.queryByText("2026-09-05")).toBeNull();
  expect(screen.queryByText("밈을 쓰기 전, 5가지만 확인해 보세요")).toBeNull();
  expect(screen.queryByRole("link", { name: "무료 확인표와 참여 안내 보기" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "확인했어요" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(window.localStorage.getItem("mc:changelog:last-seen")).toBe(LATEST_CHANGELOG_ID);
  expect(document.body.style.overflow).not.toBe("hidden");
});

it.each([
  "/memes/kh75j5f8",
  "/memes/kh75j5f8-%EA%BC%B0%EB%8C%80",
  "/memes/bjk2021k-bun-jo-ka",
  "/memes/t4n9can6-내-마음속에-저장",
  "/memes/t4n9can6/",
  "/en/memes/kh75j5f8",
  "/ja/memes/bjk2021k",
  "/zh/memes/t4n9can6",
  "/zh-tw/memes/kh75j5f8",
  "/ko/memes/bjk2021k",
])("renders no notice modal and no dialog on detail %s for a fresh visitor", (pathname) => {
  vi.useFakeTimers();
  navigation.pathname = pathname;
  render(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("새 소식")).toBeNull();
  expect(screen.queryByText("밈캐치가 업데이트됐어요")).toBeNull();
  expect(screen.queryByText("2026-09-05")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(window.localStorage.getItem("mc:changelog:last-seen")).toBeNull();
});

it("does not open a stored unread notice as a modal on a detail page", () => {
  vi.useFakeTimers();
  window.localStorage.setItem("mc:changelog:last-seen", "2026-01-01");
  navigation.pathname = "/en/memes/t4n9can6-내-마음속에-저장";
  const { rerender } = render(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(window.localStorage.getItem("mc:changelog:last-seen")).toBe("2026-01-01");

  navigation.pathname = "/explore";
  rerender(<ChangelogModal />);
  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.queryByText("2026-09-05")).toBeNull();
});
