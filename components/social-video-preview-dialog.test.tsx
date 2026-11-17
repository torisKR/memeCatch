// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SocialVideoPreviewDialog } from "@/components/social-video-preview-dialog";
import type { SocialVideoPreview } from "@/lib/meme-video-preview";

const TIKTOK_PREVIEW: SocialVideoPreview = {
  platform: "tiktok",
  sourceUrl: "https://www.tiktok.com/@creator/video/1234567890123456789",
  embedUrl: "https://www.tiktok.com/player/v1/1234567890123456789",
  contentId: "1234567890123456789",
};

const INSTAGRAM_PREVIEW: SocialVideoPreview = {
  platform: "instagram",
  sourceUrl: "https://www.instagram.com/reel/DX0AR6UzAWW/",
  embedUrl: "https://www.instagram.com/reel/DX0AR6UzAWW/embed/captioned/",
  contentId: "DX0AR6UzAWW",
};

const INVALID_VIDEO = {
  "x-tiktok-player": true,
  type: "onPlayerError",
  value: { errorCode: 1001, errorType: "INVALID_VIDEO" },
};

function openPreview() {
  fireEvent.click(screen.getByRole("button", { name: /영상 미리보기/ }));
  return screen.getByTitle(/공식 영상 미리보기/) as HTMLIFrameElement;
}

function sendPlayerMessage(
  frame: HTMLIFrameElement,
  data: unknown,
  origin = "https://www.tiktok.com",
  source: MessageEventSource | null = frame.contentWindow,
) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { origin, source, data }));
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SocialVideoPreviewDialog", () => {
  it("removes only the matching TikTok player for a confirmed 1001 INVALID_VIDEO event", () => {
    const view = render(
      <SocialVideoPreviewDialog preview={TIKTOK_PREVIEW} title="테스트 밈" locale="ko" />,
    );
    const frame = openPreview();

    expect(frame.getAttribute("src")).toBe(TIKTOK_PREVIEW.embedUrl);
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation",
    );
    expect(frame.getAttribute("allow")).toBe(
      "autoplay; encrypted-media; picture-in-picture; fullscreen",
    );
    expect(frame.hasAttribute("allowfullscreen")).toBe(true);
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");

    sendPlayerMessage(frame, INVALID_VIDEO, "https://evil.example");
    sendPlayerMessage(frame, INVALID_VIDEO, undefined, window);
    sendPlayerMessage(frame, {
      ...INVALID_VIDEO,
      value: { errorCode: 2001, errorType: "SERVER_ERROR" },
    });
    sendPlayerMessage(frame, { ...INVALID_VIDEO, type: "onPlayerReady" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(view.container.querySelectorAll("iframe")).toHaveLength(1);

    sendPlayerMessage(frame, INVALID_VIDEO);
    expect(screen.getByRole("alert").textContent).toBe("이 영상은 현재 재생할 수 없어요.");
    expect(screen.getByRole("alert").textContent).not.toMatch(/삭제|비공개/);
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("link", { name: /TikTok에서 원본 열기/ }).getAttribute("href"))
      .toBe(TIKTOK_PREVIEW.sourceUrl);
  });

  it("subscribes before navigating so the TikTok player's first error is handled", () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
    expect(descriptor?.set).toBeTypeOf("function");
    vi.spyOn(HTMLIFrameElement.prototype, "src", "set").mockImplementation(function (
      this: HTMLIFrameElement,
      value: string,
    ) {
      descriptor?.set?.call(this, value);
      if (value === TIKTOK_PREVIEW.embedUrl) {
        window.dispatchEvent(new MessageEvent("message", {
          origin: "https://www.tiktok.com",
          source: this.contentWindow,
          data: INVALID_VIDEO,
        }));
      }
    });

    render(<SocialVideoPreviewDialog preview={TIKTOK_PREVIEW} title="테스트 밈" locale="ko" />);
    fireEvent.click(screen.getByRole("button", { name: /TikTok 영상 미리보기/ }));

    expect(screen.getByRole("alert").textContent).toBe("이 영상은 현재 재생할 수 없어요.");
    expect(screen.queryByTitle(/TikTok 공식 영상 미리보기/)).toBeNull();
  });

  it("keeps Instagram and non-1001 TikTok player errors unchanged", () => {
    const instagram = render(
      <SocialVideoPreviewDialog preview={INSTAGRAM_PREVIEW} title="Instagram 밈" locale="ko" />,
    );
    const instagramFrame = openPreview();
    sendPlayerMessage(instagramFrame, INVALID_VIDEO);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(instagram.container.querySelectorAll("iframe")).toHaveLength(1);
    instagram.unmount();

    const tiktok = render(
      <SocialVideoPreviewDialog preview={TIKTOK_PREVIEW} title="TikTok 밈" locale="ko" />,
    );
    const tiktokFrame = openPreview();
    sendPlayerMessage(tiktokFrame, {
      ...INVALID_VIDEO,
      value: { errorCode: 1002, errorType: "INVALID_VIDEO" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(tiktok.container.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("resets unavailable state when reopened or when the preview changes", () => {
    const view = render(
      <SocialVideoPreviewDialog preview={TIKTOK_PREVIEW} title="첫 밈" locale="ko" />,
    );
    let frame = openPreview();
    sendPlayerMessage(frame, INVALID_VIDEO);
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "미리보기 닫기" }));
    frame = openPreview();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(frame.getAttribute("src")).toBe(TIKTOK_PREVIEW.embedUrl);

    sendPlayerMessage(frame, INVALID_VIDEO);
    const nextPreview: SocialVideoPreview = {
      ...TIKTOK_PREVIEW,
      sourceUrl: "https://www.tiktok.com/@creator/video/9876543210987654321",
      embedUrl: "https://www.tiktok.com/player/v1/9876543210987654321",
      contentId: "9876543210987654321",
    };
    view.rerender(
      <SocialVideoPreviewDialog preview={nextPreview} title="다음 밈" locale="ko" />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTitle(/다음 밈/).getAttribute("src")).toBe(nextPreview.embedUrl);
  });
});
