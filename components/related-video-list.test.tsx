// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RelatedVideoContent } from "@/lib/related-videos";
import { RelatedVideoList } from "./related-video-list";

vi.mock("@/components/meme-embed", () => ({
  MemeEmbed: ({ content }: { content: RelatedVideoContent }) => (
    <div data-testid="related-player">{content.content_id}</div>
  ),
}));

afterEach(() => {
  document.body.innerHTML = "";
});

function youtube(id: string): RelatedVideoContent {
  return {
    id: `row-${id}`,
    platform: "YouTube",
    content_id: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    thumbnail_url: null,
    availability: "live",
    caption: null,
    moderation_status: "approved",
    is_representative: false,
    manual_video_verified: false,
    type: "video",
  };
}

function verifiedInstagramPost(id: string): RelatedVideoContent {
  return {
    id: `row-${id}`,
    platform: "Instagram",
    content_id: id,
    url: `https://www.instagram.com/p/${id}/`,
    thumbnail_url: null,
    availability: "live",
    caption: null,
    moderation_status: "approved",
    is_representative: false,
    manual_video_verified: true,
    type: "embed",
  };
}

const contents = [
  ...Array.from({ length: 16 }, (_, index) =>
    youtube(`video${String(index).padStart(6, "0")}`),
  ),
  verifiedInstagramPost("C6oL0KyvcMM"),
  verifiedInstagramPost("C8ljA6up_xE"),
];

function toggleDetails(details: HTMLDetailsElement, open: boolean) {
  details.open = open;
  fireEvent(details, new Event("toggle"));
}

describe("RelatedVideoList", () => {
  it("server-renders four players, a counted disclosure, and every extra as a link", () => {
    const html = renderToString(
      <RelatedVideoList contents={contents} title="테스트 밈" />,
    );
    const normalizedHtml = html.replaceAll("<!-- -->", "");

    expect(html.match(/data-testid="related-player"/g)).toHaveLength(4);
    expect(normalizedHtml).toContain("관련 영상 14개 더 보기");
    expect(html.match(/target="_blank"/g)).toHaveLength(14);
    expect(html).toContain("https://www.instagram.com/p/C6oL0KyvcMM/");
    expect(html).toContain("https://www.instagram.com/p/C8ljA6up_xE/");
  });

  it("mounts at most four extra players per disclosure or staged load", () => {
    render(<RelatedVideoList contents={contents} title="테스트 밈" />);
    expect(screen.getAllByTestId("related-player")).toHaveLength(4);

    const details = screen.getByText("관련 영상 14개 더 보기").closest("details");
    expect(details).not.toBeNull();
    toggleDetails(details as HTMLDetailsElement, true);

    expect(screen.getAllByTestId("related-player")).toHaveLength(8);
    expect(screen.getAllByRole("link")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "관련 영상 4개 더 재생하기" }));
    expect(screen.getAllByTestId("related-player")).toHaveLength(12);
    expect(screen.getAllByRole("link")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "관련 영상 4개 더 재생하기" }));
    expect(screen.getAllByTestId("related-player")).toHaveLength(16);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "관련 영상 2개 더 재생하기" }));
    expect(screen.getAllByTestId("related-player")).toHaveLength(18);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("C6oL0KyvcMM")).toBeTruthy();
    expect(screen.getByText("C8ljA6up_xE")).toBeTruthy();
  });

  it("hydrates without recoverable errors and resets native close/reopen transitions", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <RelatedVideoList contents={contents} title="테스트 밈" />,
    );
    document.body.append(container);
    const recoverableErrors: unknown[] = [];
    let root: Root | null = null;

    await act(async () => {
      root = hydrateRoot(
        container,
        <RelatedVideoList contents={contents} title="테스트 밈" />,
        { onRecoverableError: (error) => recoverableErrors.push(error) },
      );
    });

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="related-player"]')).toHaveLength(4);

    await act(async () => toggleDetails(details as HTMLDetailsElement, true));
    expect(container.querySelectorAll('[data-testid="related-player"]')).toHaveLength(8);

    await act(async () => toggleDetails(details as HTMLDetailsElement, false));
    expect(container.querySelectorAll('[data-testid="related-player"]')).toHaveLength(4);
    expect(container.querySelectorAll('a[target="_blank"]')).toHaveLength(14);

    await act(async () => toggleDetails(details as HTMLDetailsElement, true));
    expect(container.querySelectorAll('[data-testid="related-player"]')).toHaveLength(8);
    expect(container.querySelectorAll('a[target="_blank"]')).toHaveLength(10);
    expect(recoverableErrors).toEqual([]);

    await act(async () => root?.unmount());
    container.remove();
  });
});
