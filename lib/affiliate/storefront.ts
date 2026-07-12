import type {
  AffiliateStorefrontData,
  AffiliateStorefrontProduct,
} from "@/lib/affiliate/types";

export type AffiliateStorefrontProductInput = Omit<
  AffiliateStorefrontProduct,
  "clickCount7d"
>;

export type AffiliateMetricInput = {
  productId: string;
  clicks: number;
};

const STALE_AFTER_MS = 48 * 60 * 60 * 1_000;

export function calculateDiscountRate(
  originalPrice: number | null,
  salePrice: number | null,
): number | null {
  if (!originalPrice || !salePrice || salePrice >= originalPrice) return null;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

export function buildAffiliateStorefront(
  products: AffiliateStorefrontProductInput[],
  metrics: AffiliateMetricInput[],
  lastSuccessfulSyncAt: string | null,
  now: Date,
): AffiliateStorefrontData {
  const clicksByProduct = new Map<string, number>();
  for (const metric of metrics) {
    clicksByProduct.set(
      metric.productId,
      (clicksByProduct.get(metric.productId) ?? 0) + metric.clicks,
    );
  }

  const hotdeals = products
    .map((product) => ({
      ...product,
      clickCount7d: clicksByProduct.get(product.id) ?? 0,
    }))
    .sort((left, right) => left.sourceRank - right.sourceRank);
  const popular = hotdeals
    .filter((product) => product.clickCount7d > 0)
    .sort(
      (left, right) =>
        right.clickCount7d - left.clickCount7d ||
        left.sourceRank - right.sourceRank,
    )
    .slice(0, 8);

  const lastSyncTime = lastSuccessfulSyncAt
    ? Date.parse(lastSuccessfulSyncAt)
    : Number.NaN;

  return {
    hotdeals,
    popular,
    lastSuccessfulSyncAt,
    isStale:
      !Number.isFinite(lastSyncTime) ||
      now.getTime() - lastSyncTime > STALE_AFTER_MS,
  };
}
