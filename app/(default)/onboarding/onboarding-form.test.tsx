// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "./onboarding-form";

vi.mock("@/lib/actions/auth", () => ({
  completeOnboarding: vi.fn(),
}));

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "en", messages: getMessages("en") }) };
});

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

    expect(screen.getByRole("heading", { name: "Welcome to MemeCatch" })).toBeTruthy();
    expect(screen.getByLabelText("Nickname")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Skip for now" })).toBeTruthy();

    const labels = ["Meme terms", "Challenge dances", "Songs", "Drama scenes", "Meme videos"];
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    const challengeDance = screen.getByRole("button", { name: "Challenge dances" });
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
