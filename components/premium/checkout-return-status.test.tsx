// @vitest-environment jsdom

import type { ComponentPropsWithoutRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  query: "",
  refresh: vi.fn(),
}));
const track = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  useRouter: () => ({ refresh: navigation.refresh }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/analytics", () => ({ track }));

import { CheckoutReturnStatus } from "@/components/premium/checkout-return-status";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

function renderStatus(initiallyPremium = false) {
  return render(
    <CheckoutReturnStatus
      initiallyPremium={initiallyPremium}
      locale="en"
      copy={{
        confirming: PREMIUM_COPY.en.dashboard.checkoutConfirming,
        confirmed: PREMIUM_COPY.en.dashboard.checkoutConfirmed,
        timeout: PREMIUM_COPY.en.dashboard.checkoutTimeout,
        startOneCut: PREMIUM_COPY.en.dashboard.startOneCut,
      }}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  navigation.query = "";
  navigation.refresh.mockReset();
  track.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ isPremium: false }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("CheckoutReturnStatus", () => {
  it("does not render a return banner or Plus CTA outside the checkout return", () => {
    renderStatus(true);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("link", { name: "Start your first One-Cut" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["ko", "en", "ja", "zh", "zh-tw"] as const)(
    "provides a first-action label for %s",
    (locale) => {
      expect(PREMIUM_COPY[locale].dashboard.startOneCut.trim()).not.toBe("");
    },
  );

  it("shows the first One-Cut CTA only when the server already confirms Plus", () => {
    navigation.query = "checkout=return";
    renderStatus(true);

    expect(screen.getByRole("status").textContent).toContain("Payment confirmed");
    expect(screen.getByRole("link", { name: "Start your first One-Cut" }).getAttribute("href")).toBe(
      "/premium#plus-global-action-inbox-title",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reveals the CTA after an entitlement poll confirms Plus and refreshes the server dashboard", async () => {
    navigation.query = "checkout=return";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ isPremium: true }),
    });
    renderStatus();

    expect(screen.queryByRole("link", { name: "Start your first One-Cut" })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/billing/entitlement", { cache: "no-store" });
    expect(screen.getByRole("link", { name: "Start your first One-Cut" })).toBeTruthy();
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the Plus CTA hidden when an entitlement poll is rejected", async () => {
    navigation.query = "checkout=return";
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    renderStatus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(screen.getByRole("status").textContent).toContain("Confirming your payment");
    expect(screen.queryByRole("link", { name: "Start your first One-Cut" })).toBeNull();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("never exposes the Plus CTA when entitlement confirmation times out", async () => {
    navigation.query = "checkout=return";
    renderStatus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000 * 20);
    });

    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(screen.getByRole("status").textContent).toContain("Confirmation hasn’t arrived yet");
    expect(screen.queryByRole("link", { name: "Start your first One-Cut" })).toBeNull();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});
