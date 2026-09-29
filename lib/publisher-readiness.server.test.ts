import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PUBLISHER_READINESS_SELECT,
  listPublisherReadinessPage,
} from "@/lib/publisher-readiness.server";
import { PUBLISHER_READINESS_MAX_PAGE } from "@/lib/publisher-readiness";

function queryResult(result: {
  data: unknown[] | null;
  count: number | null;
  error: { message: string } | null;
}) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "in", "order", "range", "returns"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = vi.fn((resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)));
  return query;
}

describe("listPublisherReadinessPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads exactly one stable 100-row public page and never exposes write operations", async () => {
    const query = queryResult({ data: [], count: 4378, error: null });
    const client = {
      from: vi.fn(() => query),
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      rpc: vi.fn(),
    };

    const report = await listPublisherReadinessPage(client as never, {
      page: 2,
      focus: "source",
      now: new Date("2026-09-28T06:00:00.000Z"),
    });

    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith("memes");
    expect(query.select).toHaveBeenCalledWith(PUBLISHER_READINESS_SELECT, { count: "exact" });
    expect(query.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(query.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(query.range).toHaveBeenCalledWith(100, 199);
    expect(report).toMatchObject({ page: 2, inspectedCount: 0, totalPublic: 4378 });
    expect(client.insert).not.toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
    expect(client.upsert).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("throws a read error instead of returning an empty success", async () => {
    const query = queryResult({ data: null, count: null, error: { message: "database unavailable" } });
    const client = { from: vi.fn(() => query) };

    await expect(listPublisherReadinessPage(client as never, { page: 1 })).rejects.toThrow(
      "퍼블리셔 준비도 데이터를 불러오지 못했어요",
    );
  });

  it("throws when the exact total is absent", async () => {
    const query = queryResult({ data: [], count: null, error: null });
    const client = { from: vi.fn(() => query) };

    await expect(listPublisherReadinessPage(client as never, { page: 1 })).rejects.toThrow(
      "전체 공개 문서 수",
    );
  });

  it.each([
    [Number.NaN, 1, 0, 99],
    [Number.NEGATIVE_INFINITY, 1, 0, 99],
    [-4, 1, 0, 99],
    [1.5, 1, 0, 99],
    [PUBLISHER_READINESS_MAX_PAGE + 500, PUBLISHER_READINESS_MAX_PAGE, 999_900, 999_999],
  ])(
    "normalizes direct caller page %s to %d before calculating the range",
    async (input, expectedPage, from, to) => {
      const query = queryResult({ data: [], count: 1_000_000, error: null });
      const client = { from: vi.fn(() => query) };

      const report = await listPublisherReadinessPage(client as never, { page: input });

      expect(query.range).toHaveBeenCalledWith(from, to);
      expect(report.page).toBe(expectedPage);
    },
  );
});
