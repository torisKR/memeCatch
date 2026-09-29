// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemeThumbnail } from "@/components/meme-thumbnail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const defaultProps = {
  title: "테스트 밈",
  category: "phrase" as const,
  originYear: 2026,
};

describe("MemeThumbnail", () => {
  it.each(["phrase", "dance", "song", "image", "comment", "challenge"] as const)(
    "preserves full-opacity category text contrast for %s fallback captions",
    (category) => {
      render(<MemeThumbnail src={null} title="대체 제목" fallbackCaption="대체 설명" category={category} />);
      expect(screen.getByText("대체 설명").className).not.toMatch(/opacity-/);
    },
  );

  it("replaces a failed remote preview with a meaningful card fallback", () => {
    const { container, rerender } = render(
      <MemeThumbnail
        src="https://i.ytimg.com/vi/broken/hqdefault.jpg"
        title="테스트 밈"
        fallbackCaption="해외에서도 바로 이해되는 짧은 상황 반전"
        category="phrase"
        originYear={2026}
      />,
    );

    const firstImage = container.querySelector("img");
    expect(firstImage).not.toBeNull();
    fireEvent.error(firstImage!);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("테스트 밈")).not.toBeNull();
    expect(screen.getByText("해외에서도 바로 이해되는 짧은 상황 반전")).not.toBeNull();
    expect(document.querySelector('[data-thumbnail-state="fallback"]')).not.toBeNull();

    rerender(
      <MemeThumbnail
        src="https://i.ytimg.com/vi/recovered/hqdefault.jpg"
        title="테스트 밈"
        category="phrase"
        originYear={2026}
      />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://i.ytimg.com/vi/recovered/hqdefault.jpg",
    );
  });

  it.each([
    [
      "https://catchmeme.com/api/media/meme-thumbs/youtube/a.webp?size=card#preview",
      "/api/media/meme-thumbs/youtube/a.webp?size=card#preview",
    ],
    [
      "https://www.catchmeme.com/api/media/meme-thumbs/instagram/b.jpg",
      "/api/media/meme-thumbs/instagram/b.jpg",
    ],
    [
      "https://CATCHMEME.COM/api/media/meme-thumbs/tiktok/c.avif",
      "/api/media/meme-thumbs/tiktok/c.avif",
    ],
  ])("loads owned media through the current origin: %s", (src, expected) => {
    const { container } = render(<MemeThumbnail {...defaultProps} src={src} />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe(expected);
  });

  it.each([
    "https://cdn.example.com/api/media/meme-thumbs/external.webp",
    "https://attacker@catchmeme.com/api/media/meme-thumbs/userinfo.webp",
    "https://catchmeme.com.evil.test/api/media/meme-thumbs/spoof.webp",
    "https://catchmeme.com:444/api/media/meme-thumbs/port.webp",
    "http://catchmeme.com/api/media/meme-thumbs/insecure.webp",
    "https://catchmeme.com/api/media-spoof/meme-thumbs/path.webp",
  ])("preserves non-owned or untrusted image URLs: %s", (src) => {
    const { container } = render(<MemeThumbnail {...defaultProps} src={src} />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe(src);
  });

  it("detects an already-complete failed image when the client ref attaches", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);

    const { container } = render(
      <MemeThumbnail
        {...defaultProps}
        src="https://catchmeme.com/api/media/meme-thumbs/youtube/pre-hydration.webp"
        fallbackCaption="이미 로드에 실패한 이미지"
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("테스트 밈")).toBeTruthy();
    expect(screen.getByText("이미 로드에 실패한 이미지")).toBeTruthy();
    expect(
      container.querySelector('[data-thumbnail-state="fallback"]'),
    ).toBeTruthy();
  });

  it("keeps an already-complete working image visible", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(640);

    const { container } = render(
      <MemeThumbnail
        {...defaultProps}
        src="https://catchmeme.com/api/media/meme-thumbs/youtube/working.webp"
      />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/media/meme-thumbs/youtube/working.webp",
    );
    expect(
      container.querySelector('[data-thumbnail-state="fallback"]'),
    ).toBeNull();
  });
});
