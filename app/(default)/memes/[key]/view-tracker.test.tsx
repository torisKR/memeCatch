// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: null, error: null })));

vi.mock("@/lib/analytics", () => ({ track }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { ViewTracker } from "@/app/(default)/memes/[key]/view-tracker";

beforeEach(() => {
  localStorage.clear();
  track.mockReset();
  rpc.mockClear();
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");
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
  });
});
