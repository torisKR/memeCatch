// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "./onboarding-form";

vi.mock("@/lib/actions/auth", () => ({
  completeOnboarding: vi.fn(),
}));

afterEach(cleanup);

describe("OnboardingForm interests", () => {
  it("shows five display categories while retaining legacy interest values", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <OnboardingForm
        next="/my"
        defaultNickname="밈수집가"
        defaultInterests={["dance"]}
        defaultAgeGroup=""
      />
    );

    const labels = [
      "밈 용어(유행어)",
      "챌린지 댄스",
      "노래",
      "드라마 장면",
      "밈 영상",
    ];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    const challengeDance = screen.getByRole("button", { name: "챌린지 댄스" });
    expect(challengeDance.getAttribute("aria-pressed")).toBe("true");
    expect(
      [...container.querySelectorAll<HTMLInputElement>('input[name="interests"]')]
        .map((input) => input.value)
        .sort()
    ).toEqual(["challenge", "dance"]);

    await user.click(challengeDance);

    expect(challengeDance.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll('input[name="interests"]')).toHaveLength(0);
  });
});
