import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(default)/admin/require-operator", () => ({ requireOperatorPage: vi.fn() }));
vi.mock("@/lib/sources/recovery.server", () => ({ listActiveSourceAcquisitionRecovery: vi.fn() }));
vi.mock("@/components/admin/source-recovery-panel", () => ({
  SourceRecoveryPanel: () => <div data-testid="source-recovery-panel" />,
}));
vi.mock("@/components/admin/source-review-card", () => ({
  SourceReviewCard: () => <div data-testid="source-review-card" />,
}));

import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { listActiveSourceAcquisitionRecovery } from "@/lib/sources/recovery.server";
import Page from "./page";

const TARGET_ID = "a0000000-0000-4000-8000-00000000000f";
const UPPERCASE_TARGET_ID = TARGET_ID.toUpperCase();
const RECENT_ID = "b0000000-0000-4000-8000-00000000000e";

type QueryResult = {
  data: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

function query(result: QueryResult) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "order", "range", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.returns = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

function authorizedPage({
  recent = [{ id: RECENT_ID, title: "최근 밈", short_id: "recent" }],
  exact = { data: { id: TARGET_ID, title: "오래된 밈", short_id: "old" }, error: null },
  queue = { data: [], count: 61, error: null },
}: {
  recent?: Array<{ id: string; title: string; short_id: string }>;
  exact?: QueryResult;
  queue?: QueryResult;
} = {}) {
  const queueQuery = query(queue);
  const recentQuery = query({ data: recent, error: null });
  const exactQuery = query(exact);
  const memeQueries = [recentQuery, exactQuery];
  const from = vi.fn((table: string) => {
    if (table === "meme_media") return queueQuery;
    if (table === "memes") return memeQueries.shift() ?? exactQuery;
    throw new Error(`unexpected table: ${table}`);
  });
  vi.mocked(requireOperatorPage).mockResolvedValue({ supabase: { from } } as never);
  return { from, queueQuery, recentQuery, exactQuery };
}

describe("admin source recovery targeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listActiveSourceAcquisitionRecovery).mockResolvedValue([]);
  });

  it("checks operator access before starting any source or meme query", async () => {
    vi.mocked(requireOperatorPage).mockRejectedValue(new Error("anonymous"));

    await expect(Page({ searchParams: Promise.resolve({ memeId: TARGET_ID }) })).rejects.toThrow("anonymous");
    expect(listActiveSourceAcquisitionRecovery).not.toHaveBeenCalled();
  });

  it("loads a valid old target outside the latest 200, prepends it once, and preselects it", async () => {
    const { exactQuery } = authorizedPage();

    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ memeId: TARGET_ID }) }),
    );

    expect(exactQuery.eq).toHaveBeenCalledWith("id", TARGET_ID);
    expect(exactQuery.maybeSingle).toHaveBeenCalledOnce();
    expect(html).toContain(`<option value="${TARGET_ID}" selected="">오래된 밈 (old)</option>`);
    expect(html.indexOf(`value="${TARGET_ID}"`)).toBeLessThan(html.indexOf(`value="${RECENT_ID}"`));
  });

  it("passes raw search through the auth helper and normalizes an uppercase target for DB identity", async () => {
    const { exactQuery } = authorizedPage();

    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ page: "2", memeId: UPPERCASE_TARGET_ID }) }),
    );

    expect(requireOperatorPage).toHaveBeenCalledWith("/admin/sources", {
      page: "2",
      memeId: UPPERCASE_TARGET_ID,
    });
    expect(exactQuery.eq).toHaveBeenCalledWith("id", TARGET_ID);
    expect(html).toContain(`<option value="${TARGET_ID}" selected="">오래된 밈 (old)</option>`);
  });

  it("reuses a target already in the recent list without an exact lookup or duplication", async () => {
    const { exactQuery } = authorizedPage({
      recent: [{ id: TARGET_ID, title: "이미 최근 밈", short_id: "recent-target" }],
    });

    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ memeId: TARGET_ID }) }),
    );

    expect(exactQuery.maybeSingle).not.toHaveBeenCalled();
    expect(html).toContain(`<option value="${TARGET_ID}" selected="">이미 최근 밈 (recent-target)</option>`);
    expect(html.match(new RegExp(`value="${TARGET_ID}"`, "g"))).toHaveLength(1);
  });

  it.each([
    ["invalid scalar", "not-a-uuid"],
    ["duplicate query parameter", [TARGET_ID, RECENT_ID]],
  ])("does not exact-query an %s and clears the target with feedback", async (_label, memeId) => {
    const { exactQuery } = authorizedPage();

    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ memeId }) }),
    );

    expect(exactQuery.maybeSingle).not.toHaveBeenCalled();
    expect(html).toContain('<option value="" selected="">밈을 선택하세요</option>');
    expect(html).toContain("복구할 밈 주소가 올바르지 않아요");
  });

  it.each([
    ["not found", { data: null, error: null }, "요청한 밈을 찾지 못했어요"],
    ["database error", { data: null, error: { message: "secret database detail" } }, "요청한 밈을 확인하지 못했어요"],
    ["a mismatched row", { data: { id: RECENT_ID, title: "다른 밈", short_id: "wrong" }, error: null }, "요청한 밈을 찾지 못했어요"],
  ])("fails closed when the exact target is %s", async (_label, exact, message) => {
    authorizedPage({ exact });

    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ memeId: TARGET_ID }) }),
    );

    expect(html).toContain('<option value="" selected="">밈을 선택하세요</option>');
    expect(html).toContain(message);
    expect(html).not.toContain("secret database detail");
  });

  it("does not render a failed pending queue query as an empty queue", async () => {
    authorizedPage({ queue: { data: null, count: null, error: { message: "queue unavailable" } } });

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "출처 검수 대기열을 불러오지 못했어요: queue unavailable",
    );
  });

  it("keeps a valid targeted meme in previous and next page links", async () => {
    authorizedPage();

    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ page: "2", memeId: TARGET_ID }) }),
    );

    expect(html).toContain(`href="/admin/sources?page=1&amp;memeId=${TARGET_ID}"`);
    expect(html).toContain(`href="/admin/sources?page=3&amp;memeId=${TARGET_ID}"`);
  });
});
