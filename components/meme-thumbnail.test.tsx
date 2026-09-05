// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemeThumbnail } from "@/components/meme-thumbnail";

afterEach(cleanup);

describe("MemeThumbnail", () => {
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
});
