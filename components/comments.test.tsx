// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const ranges = vi.hoisted(() => vi.fn());
vi.mock("@/lib/flags", () => ({ flags: { communityEnabled: true } }));
vi.mock("@/lib/db/client", () => ({ createClient: () => {
  const query = { select: () => query, eq: () => query, order: () => query, range: ranges };
  return { from: () => query };
} }));
vi.mock("@/components/comment-form", () => ({ CommentForm: () => null }));
vi.mock("@/components/community-gate", () => ({ CommunityGate: () => null }));
vi.mock("@/lib/actions/community", () => ({ reportContent: vi.fn() }));

import { Comments } from "./comments";

afterEach(() => { cleanup(); ranges.mockReset(); });

it("loads subsequent comment pages so new comments remain visible", async () => {
  const row = (id: string) => ({ id, parent_id: null, body: id, status: "visible", created_at: "2026-01-01T00:00:00Z", user_id: "user", profiles: null });
  ranges.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => row(`old-${i}`)), error: null })
    .mockResolvedValueOnce({ data: [row("new-comment")], error: null });
  render(<Comments memeId="meme" />);
  expect(await screen.findByText("new-comment")).toBeTruthy();
  expect(ranges.mock.calls).toEqual([[0, 499], [500, 999]]);
});
