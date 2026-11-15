// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlusDailyShareAction } from "@/components/premium/plus-daily-share-action";

const candidate = {
  id: "meme-1",
  shortId: "abc123",
  slug: "signal-meme",
  title: "Signal meme",
  summary: "A reviewed meaning.",
  usageNote: "Use it with close friends.",
  caution: "Do not target a real person.",
  shareReady: true,
  trendScore: 92,
  safetyLevel: "yellow" as const,
  source: "saved_rising" as const,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("png", { status: 200 })));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:share"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PlusDailyShareAction", () => {
  it("prepares a premium card and falls back to clipboard plus download", async () => {
    render(<PlusDailyShareAction candidate={candidate} locale="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Create share pack" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Caption copied and card saved."));
    expect(fetch).toHaveBeenCalledWith(
      "/memes/abc123/export?locale=en&template=minimal&format=card&scale=1",
      { cache: "no-store" },
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:3000/en/memes/abc123-signal-meme"),
    );
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("uses the native file share when the browser supports it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn(() => true) });

    render(<PlusDailyShareAction candidate={candidate} locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "共有パックを作る" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("共有シートを開きました。"));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Signal meme",
        text: expect.stringContaining("http://localhost:3000/ja/memes/abc123-signal-meme"),
        files: [expect.any(File)],
      }),
    );
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
