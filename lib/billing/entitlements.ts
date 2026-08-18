export type SubscriptionAccessRow = {
  status: string;
  current_period_end: string | null;
  last_event_at?: string | null;
};

export function isPremiumSubscription(
  subscription: SubscriptionAccessRow | null,
  now = Date.now(),
): boolean {
  if (!subscription || subscription.status !== "active") return false;
  if (!subscription.current_period_end) return false;
  const periodEnd = Date.parse(subscription.current_period_end);
  return Number.isFinite(periodEnd) && periodEnd > now;
}

export function selectPremiumSubscription<T extends SubscriptionAccessRow>(
  subscriptions: readonly T[],
  now = Date.now(),
): T | null {
  let selected: T | null = null;
  let selectedPeriodEnd = Number.NEGATIVE_INFINITY;
  let selectedEventAt = Number.NEGATIVE_INFINITY;

  for (const subscription of subscriptions) {
    if (!isPremiumSubscription(subscription, now)) continue;

    const periodEnd = Date.parse(subscription.current_period_end!);
    const eventAt = subscription.last_event_at
      ? Date.parse(subscription.last_event_at)
      : Number.NEGATIVE_INFINITY;
    const normalizedEventAt = Number.isFinite(eventAt)
      ? eventAt
      : Number.NEGATIVE_INFINITY;

    if (
      periodEnd > selectedPeriodEnd ||
      (periodEnd === selectedPeriodEnd && normalizedEventAt > selectedEventAt)
    ) {
      selected = subscription;
      selectedPeriodEnd = periodEnd;
      selectedEventAt = normalizedEventAt;
    }
  }

  return selected;
}

/**
 * 만료까지 남은 일수. Unifi Pay에는 정기결제가 없어 자동 갱신이 일어나지
 * 않으므로, 만료 전에 사용자가 직접 연장하도록 안내해야 한다.
 * 이미 지났으면 0을 반환한다(음수로 "-3일 뒤 만료" 같은 문구가 나오지 않게).
 */
export function daysUntilExpiry(
  currentPeriodEnd: string | null,
  now = Date.now(),
): number | null {
  if (!currentPeriodEnd) return null;
  const end = Date.parse(currentPeriodEnd);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

export const EXPIRY_REMINDER_DAYS = [7, 3, 1, 0] as const;
export const EXPIRY_WARNING_DAYS = EXPIRY_REMINDER_DAYS[0];

export type ExpiryReminderDay = (typeof EXPIRY_REMINDER_DAYS)[number];

export function expiryReminderDay(
  currentPeriodEnd: string | null,
  now = Date.now(),
): ExpiryReminderDay | null {
  const days = daysUntilExpiry(currentPeriodEnd, now);
  return days !== null && EXPIRY_REMINDER_DAYS.includes(days as ExpiryReminderDay)
    ? (days as ExpiryReminderDay)
    : null;
}

export function isExpiringSoon(
  currentPeriodEnd: string | null,
  now = Date.now(),
): boolean {
  const days = daysUntilExpiry(currentPeriodEnd, now);
  return days !== null && days <= EXPIRY_WARNING_DAYS;
}
