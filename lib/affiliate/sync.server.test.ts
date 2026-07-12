import { describe, expect, it, vi } from "vitest";

import type { AffiliateSyncRepository } from "@/lib/affiliate/repository.server";
import { runDailyAdpickSync } from "@/lib/affiliate/sync.server";

const validPayload = [
  {
    title: "오늘의 특가",
    theme_code: "daily",
    description: "매일 바뀌는 특가",
    list: [
      {
        product_name: "테스트 상품",
        photo: "https://cdn.example.com/product.jpg",
        mall: "shop.example.com",
        mall_name: "테스트몰",
        mall_icon: "https://cdn.example.com/mall.png",
        price_sale: "12,900",
        price_org: "25,800",
        commission: "수수료 지급",
        buyurl:
          "https://adpick.co.kr/apis/goshopping.php?affid=member123&offer=abc12&url=https%3A%2F%2Fshop.example.com%2Fp%2F1",
      },
    ],
  },
];

function createRepository(
  overrides: Partial<AffiliateSyncRepository> = {},
): AffiliateSyncRepository {
  return {
    claim: vi.fn().mockResolvedValue({
      claimed: true,
      runId: "run-1",
      result: "claimed",
    }),
    apply: vi.fn().mockResolvedValue({
      upsertedCount: 1,
      deactivatedCount: 2,
    }),
    fail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createDependencies(
  fetcher: typeof fetch,
  repository = createRepository(),
) {
  return {
    now: () => new Date("2026-07-13T01:00:00Z"),
    affiliateId: "member123",
    fetcher,
    repository,
  };
}

describe("runDailyAdpickSync", () => {
  it("does not fetch when the daily claim is skipped", async () => {
    const fetcher = vi.fn();
    const repository = createRepository({
      claim: vi.fn().mockResolvedValue({
        claimed: false,
        runId: "run-1",
        result: "skipped",
      }),
    });

    const result = await runDailyAdpickSync(
      createDependencies(fetcher as unknown as typeof fetch, repository),
    );

    expect(result.status).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps products unchanged when Adpick returns an invalid payload", async () => {
    const repository = createRepository();
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));

    await expect(
      runDailyAdpickSync(
        createDependencies(fetcher as unknown as typeof fetch, repository),
      ),
    ).resolves.toMatchObject({
      status: "failed",
      errorCode: "ADPICK_EMPTY_LIST",
    });
    expect(repository.apply).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith("run-1", "ADPICK_EMPTY_LIST");
  });

  it("applies a completely validated response from the fixed endpoint", async () => {
    const repository = createRepository();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validPayload), { status: 200 }),
    );

    await expect(
      runDailyAdpickSync(
        createDependencies(fetcher as unknown as typeof fetch, repository),
      ),
    ).resolves.toEqual({
      status: "succeeded",
      fetchedCount: 1,
      upsertedCount: 1,
      deactivatedCount: 2,
    });
    expect(repository.claim).toHaveBeenCalledWith({
      provider: "adpick",
      sourceType: "hotdeal",
      scheduledDate: "2026-07-13",
      startedAt: "2026-07-13T01:00:00.000Z",
    });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://adpick.co.kr/apis/sdk_shopping_hotdeal.php",
    );
    expect([...requestUrl.searchParams]).toEqual([["affid", "member123"]]);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(repository.apply).toHaveBeenCalledWith(
      "run-1",
      "2026-07-13T01:00:00.000Z",
      expect.arrayContaining([expect.objectContaining({ productName: "테스트 상품" })]),
    );
  });

  it("rejects a non-200 response before applying products", async () => {
    const repository = createRepository();
    const fetcher = vi.fn().mockResolvedValue(new Response("upstream", { status: 503 }));

    await expect(
      runDailyAdpickSync(
        createDependencies(fetcher as unknown as typeof fetch, repository),
      ),
    ).resolves.toEqual({
      status: "failed",
      fetchedCount: 0,
      errorCode: "ADPICK_HTTP_ERROR",
    });
    expect(repository.apply).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith("run-1", "ADPICK_HTTP_ERROR");
  });

  it("rejects response text larger than 1 MiB before parsing", async () => {
    const repository = createRepository();
    const fetcher = vi.fn().mockResolvedValue(
      new Response("x".repeat(1_048_577), { status: 200 }),
    );

    await expect(
      runDailyAdpickSync(
        createDependencies(fetcher as unknown as typeof fetch, repository),
      ),
    ).resolves.toEqual({
      status: "failed",
      fetchedCount: 0,
      errorCode: "ADPICK_RESPONSE_TOO_LARGE",
    });
    expect(repository.apply).not.toHaveBeenCalled();
  });

  it("never returns or stores an affiliate ID or full buy URL from an exception", async () => {
    const repository = createRepository();
    const buyUrl = validPayload[0].list[0].buyurl;
    const fetcher = vi.fn().mockRejectedValue(
      new Error(`request for member123 failed at ${buyUrl}`),
    );

    const result = await runDailyAdpickSync(
      createDependencies(fetcher as unknown as typeof fetch, repository),
    );

    expect(result).toEqual({
      status: "failed",
      fetchedCount: 0,
      errorCode: "ADPICK_FETCH_ERROR",
    });
    expect(JSON.stringify(result)).not.toContain("member123");
    expect(JSON.stringify(result)).not.toContain(buyUrl);
    expect(repository.fail).toHaveBeenCalledWith("run-1", "ADPICK_FETCH_ERROR");
  });

  it("preserves DB_APPLY_RESULT_ERROR when reporting an already-applied snapshot fails", async () => {
    const repository = createRepository({
      apply: vi.fn().mockRejectedValue(new Error("DB_APPLY_RESULT_ERROR")),
      fail: vi.fn().mockRejectedValue(new Error("run is no longer running")),
    });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(validPayload), { status: 200 }),
    );

    await expect(
      runDailyAdpickSync(
        createDependencies(fetcher as unknown as typeof fetch, repository),
      ),
    ).resolves.toEqual({
      status: "failed",
      fetchedCount: 0,
      errorCode: "DB_APPLY_RESULT_ERROR",
    });
    expect(repository.apply).toHaveBeenCalledOnce();
    expect(repository.fail).toHaveBeenCalledWith("run-1", "DB_APPLY_RESULT_ERROR");
  });
});
