import "server-only";

import type { NormalizedAffiliateProduct } from "@/lib/affiliate/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type AffiliateSyncRepository = {
  claim(input: {
    provider: "adpick";
    sourceType: "hotdeal";
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
