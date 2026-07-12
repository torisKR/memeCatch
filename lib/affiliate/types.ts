export type AffiliateProvider = "adpick";
export type AffiliateSourceType = "hotdeal";

export type NormalizedAffiliateProduct = {
  provider: AffiliateProvider;
  sourceType: AffiliateSourceType;
  externalKey: string;
  themeCode: string | null;
  themeTitle: string;
  themeDescription: string;
  sourceRank: number;
  productName: string;
  imageUrl: string | null;
  mallDomain: string | null;
  mallName: string | null;
  mallIconUrl: string | null;
  salePrice: number | null;
  originalPrice: number | null;
  commissionLabel: string;
  affiliateUrl: string;
  syncedAt: string;
};

export type AffiliateStorefrontProduct = Omit<
  NormalizedAffiliateProduct,
  "commissionLabel" | "affiliateUrl" | "syncedAt"
> & {
  id: string;
  clickCount7d: number;
};

export type AffiliateStorefrontData = {
  hotdeals: AffiliateStorefrontProduct[];
  popular: AffiliateStorefrontProduct[];
  lastSuccessfulSyncAt: string | null;
  isStale: boolean;
};
