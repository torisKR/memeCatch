// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createHouseOriginal = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/admin", () => ({
  createHouseOriginal: (...args: unknown[]) => createHouseOriginal(...args),
}));

import { HouseOriginalForm } from "./house-original-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HouseOriginalForm", () => {
  it("saves pending only and does not offer a one-click approve", async () => {
    createHouseOriginal.mockResolvedValue({ ok: true, data: { memeId: "meme-1" } });
    render(<HouseOriginalForm />);

    expect(screen.queryByRole("button", { name: "게시 승인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "수동 게시" })).toBeNull();
    expect(screen.getByRole("list", { name: "자체 제작 검수 경로" }).textContent).toContain(
      "수동 게시",
    );
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("대기");
    expect(screen.getByText("운영자가 확인란을 치고 수동 게시합니다.", { exact: false })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "자체 제작 밈" } });
    fireEvent.change(screen.getByLabelText("한 줄 요약"), { target: { value: "밈캐치가 만들었어요." } });
    fireEvent.click(screen.getByRole("button", { name: "대기로 저장" }));

    await waitFor(() => {
      expect(createHouseOriginal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "자체 제작 밈",
          summary: "밈캐치가 만들었어요.",
        }),
      );
    });
    expect(push).toHaveBeenCalledWith("/admin/memes/meme-1");
  });
});
