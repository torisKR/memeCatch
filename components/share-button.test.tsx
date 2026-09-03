// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "@/components/share-button";
import { track } from "@/lib/analytics";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => vi.clearAllMocks());

describe("ShareButton", () => {
  it("uses localized copy and the canonical locale path for clipboard sharing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ShareButton
        path="/ja/memes/abcd1234-example"
        title="例のミーム"
        label="共有"
        copiedLabel="リンクをコピーしました！"
        copiedStatus="リンクをコピーしました。"
        siteName="MemeCatch"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "共有" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/ja/memes/abcd1234-example?utm_source=share&utm_medium=link",
    );
    expect(track).toHaveBeenCalledWith("share_click", {
      method: "link",
      to: "/ja/memes/abcd1234-example",
    });
    expect(screen.getByRole("button", { name: "リンクをコピーしました！" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("リンクをコピーしました。");
  });

  it("keeps Korean defaults and passes a localized site name to native share", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    render(<ShareButton path="/en/memes/abcd1234-example" title="Example" siteName="MemeCatch" />);
    fireEvent.click(screen.getByRole("button", { name: "공유" }));

    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    expect(share).toHaveBeenCalledWith({
      title: "Example — MemeCatch",
      url: "http://localhost:3000/en/memes/abcd1234-example?utm_source=share&utm_medium=native",
    });
  });

  it("keeps Korean clipboard feedback as the default copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<ShareButton path="/memes/abcd1234-example" title="예시" />);
    fireEvent.click(screen.getByRole("button", { name: "공유" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "링크 복사됨!" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("링크가 복사되었어요.");
  });
});
