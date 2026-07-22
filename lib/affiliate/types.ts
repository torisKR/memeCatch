export type AffiliateProvider = "adpick";
/** hotdeal = 실시간 핫딜 크롤링 피드, recommend = 쇼핑메이트 추천상품 피드 */
export type AffiliateSourceType = "hotdeal" | "recommend";

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
  /** 쇼핑메이트 추천상품(sdk_shopping.php) — 핫딜과 별도 피드 */
  recommended: AffiliateStorefrontProduct[];
  popular: AffiliateStorefrontProduct[];
  lastSuccessfulSyncAt: string | null;
  isStale: boolean;
};
