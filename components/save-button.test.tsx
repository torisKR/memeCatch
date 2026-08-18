// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const maybeSingle = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser },
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/memes/test" }));
vi.mock("@/lib/i18n-client", () => ({ useLocale: () => ({ locale: "ko" }) }));
vi.mock("@/components/login-gate", () => ({ LoginGate: () => null }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
import {
  SaveButton,
  enqueueSaveIntent,
  getSaveFailure,
  parseSaveIntents,
} from "@/components/save-button";

beforeEach(() => {
  localStorage.clear();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  maybeSingle.mockReset().mockResolvedValue({ data: null });
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

afterEach(cleanup);

describe("getSaveFailure", () => {
  it("recognizes login and free save limit errors without exposing database details", () => {
    expect(getSaveFailure("login_required")).toBe("login");
    expect(getSaveFailure("premium_save_limit: 30")).toBe("premium-limit");
    expect(getSaveFailure("database unavailable")).toBe("retry");
  });
});

describe("guest save intent queue", () => {
  it("deduplicates, caps at ten, and drops expired or invalid entries", () => {
    const now = Date.UTC(2026, 7, 17);
    const ids = Array.from({ length: 11 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
    );
    let queue = ids.reduce(
      (items, memeId, index) => enqueueSaveIntent(items, memeId, now + index),
      [] as ReturnType<typeof parseSaveIntents>
    );
    queue = enqueueSaveIntent(queue, ids[5], now + 20);

    const parsed = parseSaveIntents(
      JSON.stringify([
        { memeId: ids[0], createdAt: now - 7 * 24 * 60 * 60 * 1000 },
        { memeId: "not-a-uuid", createdAt: now },
        ...queue,
      ]),
      now + 20
    );

    expect(parsed).toHaveLength(10);
    expect(parsed.at(-1)?.memeId).toBe(ids[5]);
    expect(new Set(parsed.map(({ memeId }) => memeId)).size).toBe(10);
  });

  it("syncs a duplicated guest intent once after login and clears the queue", async () => {
    const memeId = "00000000-0000-4000-8000-000000000001";
    const createdAt = Date.now();
    localStorage.setItem(
      "memecatch:save-intents:v1",
      JSON.stringify([{ memeId, createdAt: createdAt - 1 }, { memeId, createdAt }]),
    );

    render(<SaveButton memeId={memeId} />);

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("save_meme", { p_meme_id: memeId });
    expect(localStorage.getItem("memecatch:save-intents:v1")).toBeNull();
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });

  it("routes an eleventh guest save to attributed pricing without dropping the first ten", async () => {
    const createdAt = Date.now();
    const intents = Array.from({ length: 10 }, (_, index) => ({
      memeId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      createdAt,
    }));
    localStorage.setItem("memecatch:save-intents:v1", JSON.stringify(intents));
    getUser.mockResolvedValue({ data: { user: null } });

    render(<SaveButton memeId="00000000-0000-4000-8000-000000000010" />);
    await waitFor(() => expect(getUser).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "이 밈 저장하기" }));

    expect(screen.getByRole("link", { name: "Plus로 무제한 저장하기" }).getAttribute("href")).toBe(
      "/pricing?source=save_limit_11",
    );
    expect(parseSaveIntents(localStorage.getItem("memecatch:save-intents:v1"))).toHaveLength(10);
  });
});
