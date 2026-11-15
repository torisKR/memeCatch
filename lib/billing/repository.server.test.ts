import { AuthSessionMissingError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const getUser = vi.fn();
const rpc = vi.fn();
const adminRpc = vi.fn();
const maybeSingle = vi.fn();
const adminFrom = vi.fn(() => ({
  select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: adminRpc, from: adminFrom })),
}));

import {
  attachUnifiPaymentLink,
  createBillingOrder,
  failBillingOrder,
  getCurrentBillingUser,
  getPremiumEntitlement,
  hasUnifiPaymentLink,
  processUnifiPaymentEvent,
} from "@/lib/billing/repository.server";

describe("billing repository authentication", () => {
  beforeEach(() => {
    getUser.mockReset();
    rpc.mockReset();
    adminRpc.mockReset();
    maybeSingle.mockReset();
    adminFrom.mockClear();
  });

  it("treats a missing Supabase session as a signed-out checkout visitor", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getCurrentBillingUser()).resolves.toBeNull();
  });

  it("returns a signed-out entitlement when the session cookie is missing", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getPremiumEntitlement()).resolves.toEqual({
      signedIn: false,
      isPremium: false,
      status: null,
      currentPeriodEnd: null,
    });
  });

  it("still surfaces unexpected authentication failures", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("auth service unavailable"),
    });

    await expect(getCurrentBillingUser()).rejects.toThrow("auth service unavailable");
  });
});

describe("billing order repository", () => {
  it("uses service-role RPCs with the authenticated user id for the pending order lifecycle", async () => {
    adminRpc.mockResolvedValue({ data: {}, error: null });

    await createBillingOrder("user-1", "request-1");
    await attachUnifiPaymentLink("user-1", "request-1", "link-1");
    await failBillingOrder("user-1", "request-2");

    expect(rpc).not.toHaveBeenCalled();
    expect(adminRpc.mock.calls).toEqual([
      [
        "server_create_billing_order",
        { p_growth_session_id: null, p_request_id: "request-1", p_user_id: "user-1" },
      ],
      [
        "server_attach_unifi_payment_link",
        { p_provider_link_id: "link-1", p_request_id: "request-1", p_user_id: "user-1" },
      ],
      ["server_fail_billing_order", { p_request_id: "request-2", p_user_id: "user-1" }],
    ]);
  });

  it("checks local payment-link ownership before provider lookup", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "order-1" }, error: null });

    await expect(hasUnifiPaymentLink("link-1")).resolves.toBe(true);
    expect(adminFrom).toHaveBeenCalledWith("billing_orders");
  });

  it("sends verified transaction identity to one service-role settlement RPC", async () => {
    adminRpc.mockResolvedValue({ data: { duplicate: false }, error: null });

    await processUnifiPaymentEvent({
      providerLinkId: "link-1",
      transactionId: "tx-1",
      status: "CONFIRMED",
      occurredAt: "2026-08-17T00:00:00.000Z",
      payload: { provider: "unifi-pay" },
    });

    expect(adminRpc).toHaveBeenCalledWith("process_unifi_order_event", {
      p_occurred_at: "2026-08-17T00:00:00.000Z",
      p_payload: { provider: "unifi-pay" },
      p_provider_link_id: "link-1",
      p_status: "CONFIRMED",
      p_transaction_id: "tx-1",
    });
  });
});

describe("growth P0 database contract", () => {
  const baseSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260817120000_growth_plan_p0.sql"),
    "utf8",
  );
  const fixSql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260818123000_growth_p0_contract_fixes.sql"),
    "utf8",
  );
  const boundarySql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260903010000_billing_server_boundary.sql"),
    "utf8",
  );

  it("stores unique request, provider, purchase, and refund identities", () => {
    expect(baseSql).toMatch(/request_id text not null unique/);
    expect(baseSql).toMatch(/provider_link_id text unique/);
    expect(baseSql).toMatch(/transaction_id text unique/);
    expect(baseSql).toMatch(/refund_transaction_id text unique/);
    expect(baseSql).toContain("order_amount numeric(12, 2) not null default 10");
    expect(baseSql).toContain("order_currency text not null default 'USD'");
    expect(baseSql).toContain("payment_asset text not null default 'USDT'");
    expect(baseSql).toContain("payment_network text not null default 'kaia'");
    expect(baseSql).toContain("expires_at timestamptz not null default (now() + interval '1 hour')");
    expect(baseSql).toContain("check (currency in ('KRW', 'USD'))");
  });

  it("keeps settlement and refund atomic and service-role-only", () => {
    expect(baseSql).toContain("create or replace function public.process_unifi_order_event");
    expect(fixSql).toContain("create or replace function public.reconcile_unifi_refund");
    expect(fixSql).toContain("grant execute on function public.reconcile_unifi_refund");
    expect(fixSql).toMatch(/reconcile_unifi_refund[\s\S]*to service_role;/);
    expect(fixSql).toContain("create constraint trigger reproject_unifi_entitlements_after_order_change");
    expect(fixSql).toContain("deferrable initially deferred");
    expect(fixSql).toMatch(/for v_confirmed_order in[\s\S]*status = 'CONFIRMED'[\s\S]*v_period_end := v_period_start \+ interval '30 days'/);
    expect(fixSql).toContain("'renewal:' || v_confirmed_order.id::text");
    expect(fixSql).toContain("invalid_growth_event_source");
    expect(fixSql).toContain("'share_click', 'quiz_start', 'quiz_complete', 'traffic_source'");
    expect(fixSql).toContain("'plus_weekly_brief_opened', 'plus_weekly_brief_clicked'");
  });

  it("moves order lifecycle writes behind the service role and freezes transaction identity", () => {
    expect(boundarySql).toMatch(/revoke execute on function public\.create_billing_order[\s\S]*from authenticated/);
    expect(boundarySql).toMatch(/server_create_billing_order[\s\S]*to service_role/);
    expect(boundarySql).toMatch(/server_attach_unifi_payment_link[\s\S]*to service_role/);
    expect(boundarySql).toMatch(/server_fail_billing_order[\s\S]*to service_role/);
    expect(boundarySql).toContain("message = 'transaction_id_immutable'");
    expect(boundarySql).toContain("before update of transaction_id");
  });

  it("keeps idempotent and toggle saves on the same free limit", () => {
    expect(baseSql).toContain("create or replace function public.save_meme");
    expect(baseSql).toContain("on conflict (user_id, meme_id) do nothing");
    expect(baseSql).toContain("message = 'premium_save_limit'");
    expect(baseSql).toContain("create or replace function public.toggle_save");
    expect(baseSql.match(/v_save_count >= 10/g)).toHaveLength(2);
  });
});
