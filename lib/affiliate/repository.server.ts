import "server-only";

import { buildAffiliateStorefront } from "@/lib/affiliate/storefront";
import type {
  AffiliateSourceType,
  NormalizedAffiliateProduct,
} from "@/lib/affiliate/types";
import type { AffiliateStorefrontData } from "@/lib/affiliate/types";
import { createAdminClient } from "@/lib/supabase/admin";

const STOREFRONT_FIELDS =
  "id,provider,source_type,external_key,theme_code,theme_title,theme_description,source_rank,product_name,image_url,mall_domain,mall_name,mall_icon_url,sale_price,original_price";

function getSeoulDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export async function getAffiliateStorefront(): Promise<AffiliateStorefrontData> {
  const now = new Date();
  try {
    const admin = createAdminClient();
    const endDate = getSeoulDate(now);
    const startDate = shiftDate(endDate, -6);
    const [productsResult, metricsResult, syncResult] = await Promise.all([
      admin
        .from("affiliate_products")
        .select(STOREFRONT_FIELDS)
        .eq("is_active", true)
        .order("source_rank", { ascending: true }),
      admin
        .from("affiliate_product_daily_metrics")
        .select("product_id,clicks")
        .gte("metric_date", startDate)
        .lte("metric_date", endDate),
      admin
        .from("affiliate_sync_runs")
        .select("finished_at")
        .eq("provider", "adpick")
        .eq("status", "succeeded")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (productsResult.error || metricsResult.error || syncResult.error) {
      throw new Error("DB_STOREFRONT_ERROR");
    }

    const products = (productsResult.data ?? []).map((product) => ({
      id: product.id,
      provider: product.provider as "adpick",
      sourceType: product.source_type as AffiliateSourceType,
      externalKey: product.external_key,
      themeCode: product.theme_code,
      themeTitle: product.theme_title,
      themeDescription: product.theme_description,
      sourceRank: product.source_rank,
      productName: product.product_name,
      imageUrl: product.image_url,
      mallDomain: product.mall_domain,
      mallName: product.mall_name,
      mallIconUrl: product.mall_icon_url,
      salePrice: product.sale_price,
      originalPrice: product.original_price,
    }));
    const metrics = (metricsResult.data ?? []).map((metric) => ({
      productId: metric.product_id,
      clicks: metric.clicks,
    }));

    return buildAffiliateStorefront(
      products,
      metrics,
      syncResult.data?.finished_at ?? null,
      now,
    );
  } catch {
    return buildAffiliateStorefront([], [], null, now);
  }
}

export async function getActiveAffiliateRedirect(
  id: string,
  admin: ReturnType<typeof createAdminClient> = createAdminClient(),
): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("affiliate_products")
      .select("affiliate_url")
      .eq("id", id)
      .eq("is_active", true)
      .eq("provider", "adpick")
      .maybeSingle();

    return error ? null : (data?.affiliate_url ?? null);
  } catch {
    return null;
  }
}

export async function recordAffiliateProductClick(
  id: string,
  date: string,
  principalHash: string,
): Promise<void> {
  type ClickRpc = (
    name: "record_affiliate_product_click",
    args: { product_id: string; metric_date: string; principal_hash: string },
  ) => PromiseLike<{ error: unknown }>;
  const { error } = await (createAdminClient().rpc as unknown as ClickRpc)(
    "record_affiliate_product_click",
    { product_id: id, metric_date: date, principal_hash: principalHash },
  );
  if (error) throw new Error("DB_CLICK_ERROR");
}

export type AffiliateSyncRepository = {
  claim(input: {
    provider: "adpick";
    sourceType: AffiliateSourceType;
    scheduledDate: string;
    startedAt: string;
  }): Promise<{
    claimed: boolean;
    runId: string;
    result: "claimed" | "skipped" | "busy";
  }>;
  apply(
    runId: string,
    syncedAt: string,
    products: NormalizedAffiliateProduct[],
  ): Promise<{ upsertedCount: number; deactivatedCount: number }>;
  fail(runId: string, errorCode: string): Promise<void>;
};

export function createAffiliateSyncRepository(
  admin: ReturnType<typeof createAdminClient> = createAdminClient(),
): AffiliateSyncRepository {
  return {
    async claim(input) {
      const { data, error } = await admin.rpc("claim_affiliate_sync", {
        provider: input.provider,
        source_type: input.sourceType,
        scheduled_date: input.scheduledDate,
        started_at: input.startedAt,
      });
      const claim = data?.[0];
      if (
        error ||
        !claim ||
        !["claimed", "skipped", "busy"].includes(claim.result)
      ) {
        throw new Error("DB_CLAIM_ERROR");
      }

      return {
        claimed: claim.claimed,
        runId: claim.run_id,
        result: claim.result as "claimed" | "skipped" | "busy",
      };
    },

    async apply(runId, syncedAt, products) {
      const { error } = await admin.rpc("apply_affiliate_sync", {
        run_id: runId,
        synced_at: syncedAt,
        products,
      });
      if (error) throw new Error("DB_APPLY_ERROR");

      const { data, error: resultError } = await admin
        .from("affiliate_sync_runs")
        .select("upserted_count,deactivated_count")
        .eq("id", runId)
        .single();
      if (resultError || !data) throw new Error("DB_APPLY_RESULT_ERROR");

      return {
        upsertedCount: data.upserted_count,
        deactivatedCount: data.deactivated_count,
      };
    },

    async fail(runId, errorCode) {
      const { error } = await admin.rpc("fail_affiliate_sync", {
        run_id: runId,
        error_code: errorCode,
      });
      if (error) throw new Error("DB_FAIL_ERROR");
    },
  };
}
