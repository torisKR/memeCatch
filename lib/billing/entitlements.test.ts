import { describe, expect, it } from "vitest";

import {
  daysUntilExpiry,
  expiryReminderDay,
  isExpiringSoon,
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

describe("daysUntilExpiry", () => {
  const now = Date.parse("2026-08-01T00:00:00.000Z");

  it("counts whole days left before the pass ends", () => {
    expect(daysUntilExpiry("2026-08-04T00:00:00.000Z", now)).toBe(3);
    expect(daysUntilExpiry("2026-08-31T00:00:00.000Z", now)).toBe(30);
  });

  it("never reports negative days once the pass has lapsed", () => {
    // 음수가 새면 "-3일 뒤 만료" 같은 문구가 노출된다.
    expect(daysUntilExpiry("2026-07-20T00:00:00.000Z", now)).toBe(0);
  });

  it("returns null when there is no end date to measure", () => {
    expect(daysUntilExpiry(null, now)).toBeNull();
    expect(daysUntilExpiry("not-a-date", now)).toBeNull();
  });
});

describe("isExpiringSoon", () => {
  const now = Date.parse("2026-08-01T00:00:00.000Z");

  it("warns inside the final seven days", () => {
    expect(isExpiringSoon("2026-08-08T00:00:00.000Z", now)).toBe(true);
    expect(isExpiringSoon("2026-08-03T00:00:00.000Z", now)).toBe(true);
    expect(isExpiringSoon("2026-08-01T00:00:00.000Z", now)).toBe(true);
  });

  it("stays quiet while there is plenty of time", () => {
    expect(isExpiringSoon("2026-08-20T00:00:00.000Z", now)).toBe(false);
    expect(isExpiringSoon(null, now)).toBe(false);
  });
});

describe("expiryReminderDay", () => {
  const now = Date.parse("2026-08-01T00:00:00.000Z");

  it.each([7, 3, 1, 0] as const)("returns the %i-day repurchase state", (days) => {
    const end = new Date(now + days * 86_400_000).toISOString();
    expect(expiryReminderDay(end, now)).toBe(days);
  });

  it("stays quiet between scheduled reminder states", () => {
    expect(expiryReminderDay("2026-08-06T00:00:00.000Z", now)).toBeNull();
    expect(expiryReminderDay(null, now)).toBeNull();
  });
});
