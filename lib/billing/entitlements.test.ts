import { describe, expect, it } from "vitest";

import {
  isPremiumSubscription,
  selectPremiumSubscription,
} from "@/lib/billing/entitlements";

const now = new Date("2026-07-18T00:00:00Z").getTime();

describe("isPremiumSubscription", () => {
  it("fails closed when an active membership has no paid-through date", () => {
    expect(
      isPremiumSubscription(
        { status: "active", current_period_end: null },
        now,
      ),
    ).toBe(false);
  });

  it("keeps access through a future paid period", () => {
    expect(
      isPremiumSubscription(
        { status: "active", current_period_end: "2026-08-18T00:00:00Z" },
        now,
      ),
    ).toBe(true);
  });

  it("revokes canceled or expired memberships", () => {
    expect(isPremiumSubscription({ status: "canceled", current_period_end: null }, now)).toBe(false);
    expect(
      isPremiumSubscription(
        { status: "active", current_period_end: "2026-07-17T23:59:59Z" },
        now,
      ),
    ).toBe(false);
  });

  it("denies access when no subscription exists", () => {
    expect(isPremiumSubscription(null, now)).toBe(false);
  });
});

describe("selectPremiumSubscription", () => {
  it("selects the active unexpired order with the latest paid-through date", () => {
    const selected = selectPremiumSubscription(
      [
        {
          status: "canceled",
          current_period_end: "2026-12-18T00:00:00Z",
          last_event_at: "2026-07-18T03:00:00Z",
        },
        {
          status: "active",
          current_period_end: "2026-07-17T23:59:59Z",
          last_event_at: "2026-07-18T02:00:00Z",
        },
        {
          status: "active",
          current_period_end: "2026-08-18T00:00:00Z",
          last_event_at: "2026-07-18T00:00:00Z",
        },
        {
          status: "active",
          current_period_end: "2026-09-18T00:00:00Z",
          last_event_at: "2026-07-18T01:00:00Z",
        },
      ],
      now,
    );

    expect(selected).toMatchObject({
      status: "active",
      current_period_end: "2026-09-18T00:00:00Z",
    });
  });

  it("returns null when every order is canceled, expired, or malformed", () => {
    expect(
      selectPremiumSubscription(
        [
          {
            status: "canceled",
            current_period_end: "2026-09-18T00:00:00Z",
            last_event_at: "2026-07-18T00:00:00Z",
          },
          {
            status: "active",
            current_period_end: "not-a-date",
            last_event_at: "2026-07-18T00:00:00Z",
          },
          {
            status: "active",
            current_period_end: null,
            last_event_at: "2026-07-18T00:00:00Z",
          },
        ],
        now,
      ),
    ).toBeNull();
  });
});
