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
