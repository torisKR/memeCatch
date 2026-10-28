import type { Json } from "@/lib/database.types";

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type TrendPipelineTables = {
  radar_source_policies: Table<{
    policy_key: string; platform: string; collectable_fields: string[];
    derived_analysis_allowed: boolean; cross_platform_combination_allowed: boolean;
    cache_ttl: string | null; retention_days: number; deletion_refresh_required: boolean;
    approval_basis: string; verified_at: string; enabled: boolean; created_at: string; updated_at: string;
  }, "policy_key" | "platform" | "approval_basis" | "verified_at">;
  radar_discovery_seeds: Table<{
    id: string; seed_type: string; seed_value: string; discovery_lane: string;
    platform: string | null; enabled: boolean; call_budget_per_run: number;
    created_by: string | null; created_at: string; updated_at: string;
  }, "seed_type" | "seed_value" | "discovery_lane">;
  radar_collection_runs: Table<{
    id: string; connector_key: string; discovery_lane: string; idempotency_key: string;
    status: string; attempt_count: number; calls_used: number; cost_units: number;
    candidate_count: number; started_at: string | null; finished_at: string | null;
    retry_after: string | null; last_error: string | null; created_at: string;
    lease_token: string | null; lease_expires_at: string | null;
    observation_scope: string;
    policy_config_fingerprint: string | null;
  }, "connector_key" | "discovery_lane" | "idempotency_key">;
  radar_metric_snapshots: Table<{
    id: string; signal_id: string; policy_key: string; metric_name: string;
    metric_class: string; value: number | null; unit: string; observation_scope: string;
    missing_reason: string | null; observed_at: string; collected_at: string;
    retention_until: string; created_at: string;
  }, "signal_id" | "policy_key" | "metric_name" | "unit" | "observation_scope" | "observed_at" | "retention_until">;
};

export type TrendPipelineFunctions = {
  claim_trend_collection_run: {
    Args: { p_connector_key: string; p_lane: string; p_idempotency_key: string };
    Returns: Json;
  };
  reserve_trend_collection_call: {
    Args: { p_run_id: string; p_lease_token: string; p_per_run_limit: number; p_daily_limit: number; p_cost_units: number };
    Returns: boolean;
  };
  finish_trend_collection_run: {
    Args: { p_run_id: string; p_lease_token: string; p_status: string; p_error?: string | null };
    Returns: undefined;
  };
  reserve_trend_ai_draft: {
    Args: { p_candidate_id: string; p_daily_limit: number };
    Returns: boolean;
  };
  persist_discovered_trend_candidate: {
    Args: { p_phrase: string; p_display_name: string; p_signal_ids: string[]; p_daily_limit: number };
    Returns: string;
  };
  submit_trend_candidate_evidence: {
    Args: {
      p_candidate_name: string; p_aliases: string[]; p_candidate_kind: string;
      p_target_meme_id: string | null; p_source_url: string; p_platform: string;
      p_platform_content_id: string | null; p_creator_key: string | null;
      p_published_at: string | null; p_note: string | null;
    };
    Returns: string;
  };
  configure_trend_discovery_seed: {
    Args: { p_seed_type: string; p_seed_value: string; p_lane: string; p_platform: string | null; p_enabled: boolean; p_call_budget: number };
    Returns: string;
  };
  expire_trend_evidence: { Args: Record<string, never>; Returns: Json };
};
