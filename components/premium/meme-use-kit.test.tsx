// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const premiumState = vi.hoisted(() => ({ value: true }));
const track = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/use-premium", () => ({ usePremium: () => premiumState.value }));
vi.mock("@/lib/analytics", () => ({ track }));
vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "en", messages: getMessages("en") }) };
});

import { MemeUseKit, MemeUseKitEntry } from "@/components/premium/meme-use-kit";

const originalClipboard = navigator.clipboard;
const originalShare = navigator.share;

afterEach(() => {
  cleanup();
  premiumState.value = true;
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
  Object.defineProperty(navigator, "share", { configurable: true, value: originalShare });
});

describe("MemeUseKit", () => {
  it("renders localized copy-ready explain, caption, and safety formats for Plus", () => {
    const html = renderToStaticMarkup(
      <MemeUseKit
        title="Signal meme"
        summary="A documented meaning."
        usageNote="Use it with close friends."
        caution="Check the context before posting."
        safetyLevel="yellow"
        lifecycleStatus="rising"
      />,
    );

    expect(html).toContain('data-premium-kit="active"');
    expect(html).toContain("A use kit for this meme");
    expect(html).toContain("Explain to a friend");
    expect(html).toContain("Post caption");
    expect(html).toContain("Safety check");
    expect(html).toContain("Trend state: Rising");
    expect(html).toContain("Caution: Check the context before posting.");
  });

  it("offers an active Use Kit entry and keeps the free entry behind pricing", () => {
    const active = renderToStaticMarkup(<MemeUseKitEntry locale="en" />);
    expect(active).toContain('data-meme-use-kit-entry="available"');
    expect(active).toContain('href="#meme-use-kit-title"');
    expect(active).toContain("Open the Use Kit");

    premiumState.value = false;
    const lockedEntry = renderToStaticMarkup(<MemeUseKitEntry locale="en" />);
    expect(lockedEntry).toContain('data-meme-use-kit-entry="available"');
    expect(lockedEntry).toContain('href="#meme-use-kit-title"');

    const lockedKit = renderToStaticMarkup(
      <MemeUseKit
        title="Signal meme"
        summary="A documented meaning."
        usageNote={null}
        caution={null}
        safetyLevel="green"
        lifecycleStatus="active"
      />,
    );
    expect(lockedKit).toContain('data-premium-kit="locked"');
    expect(lockedKit).toContain('href="/en/pricing"');
    expect(lockedKit).toContain("Unlock the use kit");
  });

  it("shows a session-only prepared state after copying and resets on remount", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    const props = {
      title: "Signal meme",
      summary: "A documented meaning.",
      usageNote: "Use it with close friends.",
      caution: "Check the context before posting.",
      safetyLevel: "yellow" as const,
      lifecycleStatus: "rising" as const,
    };
    const { unmount } = render(<MemeUseKit {...props} />);

    expect(screen.queryByText("Ready to use. Send the format you need when you need it.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy all three" }));

    await waitFor(() => {
      expect(screen.getByText("Ready to use. Send the format you need when you need it.")).toBeTruthy();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("use_kit_copied", { format: "all" });

    unmount();
    render(<MemeUseKit {...props} />);
    expect(screen.queryByText("Ready to use. Send the format you need when you need it.")).toBeNull();
  });

  it("falls back to clipboard for share and fails closed when copy fails", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });

    render(
      <MemeUseKit
        title="Signal meme"
        summary="A documented meaning."
        usageNote={null}
        caution={null}
        safetyLevel="green"
        lifecycleStatus="active"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(screen.getByText("Ready to use. Send the format you need when you need it.")).toBeTruthy());
    expect(track).toHaveBeenCalledWith("use_kit_copied", { format: "share_fallback" });

    cleanup();
    const failedWrite = vi.fn().mockRejectedValue(new Error("clipboard blocked"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: failedWrite } });
    render(
      <MemeUseKit
        title="Signal meme"
        summary="A documented meaning."
        usageNote={null}
        caution={null}
        safetyLevel="green"
        lifecycleStatus="active"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy all three" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not copy. Select the text manually."));
    expect(screen.queryByText("Ready to use. Send the format you need when you need it.")).toBeNull();
  });

  it("does not mark the kit prepared when the native share sheet is cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn() } });

    render(
      <MemeUseKit
        title="Signal meme"
        summary="A documented meaning."
        usageNote={null}
        caution={null}
        safetyLevel="green"
        lifecycleStatus="active"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Ready to use. Send the format you need when you need it.")).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });
});
