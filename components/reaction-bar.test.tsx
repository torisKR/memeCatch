// @vitest-environment jsdom

import { act, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionPreference = vi.hoisted(() => ({ value: null as boolean | null }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();

  return {
    ...actual,
    useReducedMotion: () => motionPreference.value,
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/memes/89b37mrx-test",
}));

vi.mock("@/lib/flags", () => ({
  flags: { communityEnabled: false },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { ReactionBar } from "@/components/reaction-bar";

afterEach(() => {
  document.body.innerHTML = "";
  motionPreference.value = null;
  vi.restoreAllMocks();
});

const initialCounts = { funny: 12 } as const;

async function hydrateReactionBar(reducedMotion: boolean) {
  motionPreference.value = null;
  const host = document.createElement("div");
  host.innerHTML = renderToString(
    <ReactionBar memeId="00000000-0000-4000-8000-000000000001" initialCounts={initialCounts} />,
  );
  document.body.append(host);

  motionPreference.value = reducedMotion;
  const onRecoverableError = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  let root: ReturnType<typeof hydrateRoot> | undefined;

  try {
    await act(async () => {
      root = hydrateRoot(
        host,
        <ReactionBar
          memeId="00000000-0000-4000-8000-000000000001"
          initialCounts={initialCounts}
        />,
        { onRecoverableError },
      );
    });

    return {
      consoleErrors: [...consoleError.mock.calls],
      hasCount: within(host).getByRole("button", { name: /웃김12/ }).isConnected,
      hasReadOnlyNotice: within(host).getByText("반응 남기기는 준비 중이에요.").isConnected,
      pulseCount: host.querySelectorAll('[data-reaction-pulse="funny"]').length,
      recoverableErrors: [...onRecoverableError.mock.calls],
    };
  } finally {
    await act(async () => {
      root?.unmount();
    });
    consoleError.mockRestore();
    host.remove();
  }
}

describe("ReactionBar", () => {
  it.each([
    ["축소 모션", true],
    ["일반 모션", false],
  ])("%s 설정의 첫 클라이언트 렌더가 SSR 반응 바와 일치한다", async (_, reducedMotion) => {
    const {
      consoleErrors,
      hasCount,
      hasReadOnlyNotice,
      pulseCount,
      recoverableErrors,
    } =
      await hydrateReactionBar(reducedMotion);

    expect(recoverableErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pulseCount).toBe(1);
    expect(hasCount).toBe(true);
    expect(hasReadOnlyNotice).toBe(true);
  });
});
