// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setMemeOriginCountry = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  setMemeOriginCountry: (...args: unknown[]) => setMemeOriginCountry(...args),
}));

import { MemeOriginCountryForm } from "./meme-origin-country-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MemeOriginCountryForm", () => {
  it("shows the current profile and saves the explicitly selected country", async () => {
    setMemeOriginCountry.mockResolvedValue({ ok: true });
    render(
      <MemeOriginCountryForm
        memeId="20000000-0000-4000-8000-000000000002"
        memeTitle="고양이 밈"
        profiles={[
          {
            market_code: "US",
            language_tag: "en-US",
            local_title: "Cat meme",
            review_state: "reviewed",
          },
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: "현재 출처 국가 프로필" }).textContent).toContain(
      "미국 · Cat meme · reviewed",
    );
    expect((screen.getByLabelText("국가") as HTMLSelectElement).value).toBe("US");
    expect((screen.getByLabelText("현지 제목") as HTMLInputElement).value).toBe("Cat meme");

    fireEvent.change(screen.getByLabelText("국가"), { target: { value: "JP" } });
    fireEvent.change(screen.getByLabelText("현지 제목"), { target: { value: "猫ミーム" } });
    fireEvent.click(screen.getByRole("button", { name: "출처 국가 검수 저장" }));

    await waitFor(() => {
      expect(setMemeOriginCountry).toHaveBeenCalledWith({
        memeId: "20000000-0000-4000-8000-000000000002",
        country: "JP",
        localTitle: "猫ミーム",
      });
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});
