import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildPlusGlobalActionEvidenceInbox,
  buildPlusGlobalActionInbox,
} from "@/lib/plus-global-action-inbox";
import {
  exportPlusTrustedEvidenceSet,
  type PlusTrustedEvidenceSupabase,
} from "@/lib/plus-trusted-evidence-exporter.server";
import type { PlusDailySignalCandidate } from "@/lib/plus-daily-signal.server";

function signal(index: number): PlusDailySignalCandidate {
  return {
    id: `m-signal-${index}`,
    shortId: `sig${index}`,
    slug: `signal-${index}`,
    title: `Private-ready title ${index}`,
    summary: `Private-ready summary ${index}`,
    usageNote: `Private usage ${index}`,
    caution: `Private caution ${index}`,
    shareReady: true,
    trendScore: 100 - index,
    safetyLevel: "green",
    source: index % 2 === 0 ? "saved_rising" : "interest_rising",
  };
}

function trustedClient(result: (memeId: string) => { data: unknown; error: unknown }) {
  const rpc = vi.fn(async (_name: string, args: { p_meme_id: string }) => result(args.p_meme_id));
  return {
    rpc,
    client: { rpc } as PlusTrustedEvidenceSupabase,
  };
}

describe("exportPlusTrustedEvidenceSet", () => {
  it("uses the owner-scoped predicate, caps at twenty, and preserves the UI first five", async () => {
    const input = {
      locale: "en" as const,
      fulfillment: { status: "empty" as const, items: [] },
      signals: Array.from({ length: 24 }, (_, index) => signal(index)),
      signalStatus: "available" as const,
      scout: { status: "empty" as const, dateKey: "2026-08-09", items: [] },
      preferredMemeId: "m-signal-17",
    };
    const { rpc, client } = trustedClient(() => ({ data: true, error: null }));

    const ui = buildPlusGlobalActionInbox(input);
    const exported = await exportPlusTrustedEvidenceSet({
      supabase: client,
      dateKey: "2026-08-09",
      inbox: input,
    });

    expect(exported.status).toBe("active");
    expect(exported.items).toHaveLength(20);
    expect(exported.items.slice(0, 5).map((item) => item.memeId)).toEqual(
      ui.items.map((item) => item.memeId),
    );
    expect(rpc).toHaveBeenCalledTimes(24);
    expect(rpc).toHaveBeenCalledWith("is_trusted_one_cut_meme", {
      p_meme_id: expect.any(String),
    });
  });

  it("filters the full bounded pool before filling the twenty-item evidence cap", async () => {
    const input = {
      locale: "en" as const,
      fulfillment: { status: "empty" as const, items: [] },
      signals: Array.from({ length: 30 }, (_, index) => signal(index)),
      signalStatus: "available" as const,
      scout: { status: "empty" as const, dateKey: "2026-08-09", items: [] },
    };
    const originalTopTwenty = buildPlusGlobalActionEvidenceInbox(input).items;
    const rejectedMemeIds = new Set(originalTopTwenty.slice(0, 3).map((item) => item.memeId));
    const expected = buildPlusGlobalActionEvidenceInbox({
      ...input,
      signals: input.signals.filter((item) => !rejectedMemeIds.has(item.id)),
    }).items;
    const { rpc, client } = trustedClient((memeId) => ({
      data: !rejectedMemeIds.has(memeId),
      error: null,
    }));

    const exported = await exportPlusTrustedEvidenceSet({
      supabase: client,
      dateKey: "2026-08-09",
      inbox: input,
    });

    expect(exported.items).toHaveLength(20);
    expect(exported.items.map((item) => item.memeId)).toEqual(
      expected.map((item) => item.memeId),
    );
    expect(exported.items.at(-1)?.rank).toBe(20);
    expect(exported.items.some((item) =>
      !originalTopTwenty.some((original) => original.memeId === item.memeId),
    )).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(30);
  });

  it("exports only trusted redacted metadata and fails closed on predicate errors", async () => {
    const input = {
      locale: "ko" as const,
      fulfillment: { status: "empty" as const, items: [] },
      signals: [signal(0), signal(1)],
      signalStatus: "available" as const,
      scout: { status: "empty" as const, dateKey: "2026-08-09", items: [] },
    };
    const trusted = trustedClient((memeId) => ({ data: memeId === "m-signal-0", error: null }));

    const exported = await exportPlusTrustedEvidenceSet({
      supabase: trusted.client,
      dateKey: "2026-08-09",
      inbox: input,
    });

    expect(exported.items).toEqual([
      {
        rank: 1,
        memeId: "m-signal-0",
        kind: "saved_signal",
        locale: "ko",
        changedAt: null,
        trendScore: 100,
      },
    ]);
    expect(JSON.stringify(exported)).not.toContain("Private-ready");
    expect(JSON.stringify(exported)).not.toContain("Private usage");

    const failed = trustedClient(() => ({ data: null, error: { message: "rpc failed" } }));
    await expect(
      exportPlusTrustedEvidenceSet({
        supabase: failed.client,
        dateKey: "2026-08-09",
        inbox: input,
      }),
    ).resolves.toMatchObject({ status: "unavailable", items: [] });
  });

  it("does not probe scout candidates already verified by the server loader", async () => {
    const input = {
      locale: "ko" as const,
      fulfillment: { status: "empty" as const, items: [] },
      signals: [signal(0)],
      signalStatus: "available" as const,
      scout: {
        status: "active" as const,
        dateKey: "2026-08-09",
        items: [{
          id: "trusted-scout",
          shortId: "trusted-scout",
          slug: "trusted-scout",
          title: "Trusted scout",
          summary: "Trusted summary",
          description: "Trusted description",
          origin: "Trusted origin",
          usageNote: null,
          caution: null,
          locale: "ko" as const,
          safetyLevel: "green" as const,
          lifecycleStatus: "active" as const,
          trendScore: 90,
          sourceUpdatedAt: "2026-08-09T00:00:00.000Z",
        }],
      },
    };
    const { rpc, client } = trustedClient(() => ({ data: true, error: null }));

    const exported = await exportPlusTrustedEvidenceSet({
      supabase: client,
      dateKey: "2026-08-09",
      inbox: input,
      knownTrustedMemeIds: ["trusted-scout"],
    });

    expect(exported.items.map((item) => item.memeId)).toContain("trusted-scout");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith("is_trusted_one_cut_meme", {
      p_meme_id: "trusted-scout",
    });
  });
});
