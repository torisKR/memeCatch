import { normalizeAdpickHotdeals } from "@/lib/affiliate/adpick-hotdeal";
import type { AffiliateSyncRepository } from "@/lib/affiliate/repository.server";
import type { AffiliateSourceType } from "@/lib/affiliate/types";

/** 피드별 애드픽 쇼핑 API 엔드포인트 — 응답 스키마는 동일(정규화 공유) */
const ADPICK_ENDPOINTS: Record<AffiliateSourceType, string> = {
  hotdeal: "https://adpick.co.kr/apis/sdk_shopping_hotdeal.php",
  recommend: "https://adpick.co.kr/apis/sdk_shopping.php",
};
const MAX_RESPONSE_BYTES = 1_048_576;
const STABLE_ERROR_CODES = new Set([
  "ADPICK_EMPTY_LIST",
  "ADPICK_INVALID_PRODUCT",
  "ADPICK_INVALID_RESPONSE",
  "DB_APPLY_ERROR",
  "DB_APPLY_RESULT_ERROR",
]);

export type SyncResult =
  | {
      status: "succeeded";
      fetchedCount: number;
      upsertedCount: number;
      deactivatedCount: number;
    }
  | { status: "skipped" | "busy"; fetchedCount: 0 }
  | { status: "failed"; fetchedCount: 0; errorCode: string };

export type SyncDependencies = {
  now: () => Date;
  affiliateId: string;
  fetcher: typeof fetch;
  repository: AffiliateSyncRepository;
};

async function getDefaultDependencies(): Promise<SyncDependencies> {
  const { createAffiliateSyncRepository } = await import(
    "@/lib/affiliate/repository.server"
  );
  return {
    now: () => new Date(),
    affiliateId: process.env.ADPICK_AFFILIATE_ID ?? "",
    fetcher: fetch,
    repository: createAffiliateSyncRepository(),
  };
}

function getSeoulDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function stableErrorCode(error: unknown): string {
  if (error instanceof Error && STABLE_ERROR_CODES.has(error.message)) {
    return error.message;
  }
  return "ADPICK_FETCH_ERROR";
}

async function readBoundedResponse(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("ADPICK_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function runDailyAdpickSync(
  dependencies?: SyncDependencies,
  sourceType: AffiliateSourceType = "hotdeal",
): Promise<SyncResult> {
  const deps = dependencies ?? (await getDefaultDependencies());
  if (!deps.affiliateId) {
    return {
      status: "failed",
      fetchedCount: 0,
      errorCode: "ADPICK_CONFIG_ERROR",
    };
  }

  const startedAt = deps.now();
  let claim: Awaited<ReturnType<AffiliateSyncRepository["claim"]>>;
  try {
    claim = await deps.repository.claim({
      provider: "adpick",
      sourceType,
      scheduledDate: getSeoulDate(startedAt),
      startedAt: startedAt.toISOString(),
    });
  } catch {
    return {
      status: "failed",
      fetchedCount: 0,
      errorCode: "DB_CLAIM_ERROR",
    };
  }

  if (!claim.claimed) {
    return { status: claim.result === "busy" ? "busy" : "skipped", fetchedCount: 0 };
  }

  try {
    const url = new URL(ADPICK_ENDPOINTS[sourceType]);
    url.search = new URLSearchParams({ affid: deps.affiliateId }).toString();
    const response = await deps.fetcher(url.toString(), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("ADPICK_HTTP_ERROR");

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("ADPICK_RESPONSE_TOO_LARGE");
    }

    const responseText = await readBoundedResponse(response);

    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error("ADPICK_INVALID_RESPONSE");
    }

    const products = normalizeAdpickHotdeals(
      payload,
      startedAt,
      deps.affiliateId,
      sourceType,
    );
    const applied = await deps.repository.apply(
      claim.runId,
      startedAt.toISOString(),
      products,
    );
    return {
      status: "succeeded",
      fetchedCount: products.length,
      ...applied,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const errorCode =
      message === "ADPICK_HTTP_ERROR" ||
      message === "ADPICK_RESPONSE_TOO_LARGE"
        ? message
        : stableErrorCode(error);
    try {
      await deps.repository.fail(claim.runId, errorCode);
    } catch {
      // The apply RPC may already have committed before its result lookup failed.
    }
    return { status: "failed", fetchedCount: 0, errorCode };
  }
}

/**
 * 핫딜 + 추천상품 두 피드를 순차 동기화(각 피드 하루 1회 클레임, API 제약인
 * 분당 1회 호출도 자연 준수). 크론 응답용으로 단일 SyncResult로 합친다:
 * 하나라도 실패면 failed(에러코드 병기), 성공이 있으면 카운트 합산.
 */
export async function runDailyAdpickSyncAll(
  dependencies?: SyncDependencies,
): Promise<SyncResult> {
  const deps = dependencies ?? (await getDefaultDependencies());
  const sources: AffiliateSourceType[] = ["hotdeal", "recommend"];
  const results: [AffiliateSourceType, SyncResult][] = [];
  for (const sourceType of sources) {
    results.push([sourceType, await runDailyAdpickSync(deps, sourceType)]);
  }

  const failed = results.filter(([, r]) => r.status === "failed");
  if (failed.length > 0) {
    return {
      status: "failed",
      fetchedCount: 0,
      errorCode: failed
        .map(([source, r]) => `${source}:${(r as { errorCode: string }).errorCode}`)
        .join(","),
    };
  }

  const succeeded = results
    .map(([, r]) => r)
    .filter(
      (r): r is Extract<SyncResult, { status: "succeeded" }> =>
        r.status === "succeeded",
    );
  if (succeeded.length > 0) {
    return {
      status: "succeeded",
      fetchedCount: succeeded.reduce((sum, r) => sum + r.fetchedCount, 0),
      upsertedCount: succeeded.reduce((sum, r) => sum + r.upsertedCount, 0),
      deactivatedCount: succeeded.reduce((sum, r) => sum + r.deactivatedCount, 0),
    };
  }

  const busy = results.some(([, r]) => r.status === "busy");
  return { status: busy ? "busy" : "skipped", fetchedCount: 0 };
}
