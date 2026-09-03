// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics", () => ({ track }));

import { ViewTracker } from "@/app/(default)/memes/[key]/view-tracker";

beforeEach(() => {
  localStorage.clear();
  track.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ViewTracker", () => {
  it("tracks each viewed meme once across effect replays and rerenders", () => {
    const { rerender } = render(
      <StrictMode>
        <ViewTracker memeId="meme-a" />
      </StrictMode>,
    );

    rerender(
      <StrictMode>
        <ViewTracker memeId="meme-a" />
      </StrictMode>,
    );
    expect(track.mock.calls.filter(([event]) => event === "meme_view")).toEqual([
      ["meme_view", { meme_id: "meme-a" }],
    ]);

    rerender(
      <StrictMode>
        <ViewTracker memeId="meme-b" />
      </StrictMode>,
    );
    expect(track.mock.calls.filter(([event]) => event === "meme_view")).toEqual([
      ["meme_view", { meme_id: "meme-a" }],
      ["meme_view", { meme_id: "meme-b" }],
    ]);
    expect(fetch).toHaveBeenLastCalledWith("/api/memes/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memeId: "meme-b" }),
      keepalive: true,
    });
  });
});
