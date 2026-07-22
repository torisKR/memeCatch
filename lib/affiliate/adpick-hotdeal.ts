import { createHash } from "node:crypto";
import { z } from "zod";

import type {
  AffiliateSourceType,
  NormalizedAffiliateProduct,
} from "@/lib/affiliate/types";

const themeSchema = z.object({
  title: z.string(),
  theme_code: z.union([z.string(), z.number()]).nullish(),
  description: z.string(),
  list: z.array(z.unknown()),
});

const responseSchema = z.array(themeSchema).min(1);

const productSchema = z.object({
  product_name: z.string().min(1),
  photo: z.string().nullish(),
  mall: z.string().nullish(),
  mall_name: z.string().nullish(),
  mall_icon: z.string().nullish(),
  price_sale: z.string(),
  price_org: z.string(),
  commission: z.string(),
  buyurl: z.string(),
});

export function parseMoney(value: string): number | null {
  const digits = value.replaceAll(",", "").trim();
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function isValidAdpickBuyUrl(value: string, affiliateId?: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "adpick.co.kr" &&
      url.pathname === "/apis/goshopping.php" &&
      Boolean(url.searchParams.get("offer")) &&
      Boolean(url.searchParams.get("url")) &&
      (!affiliateId || url.searchParams.get("affid") === affiliateId);
  } catch {
    return false;
  }
}

function parseHttpsImage(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("ADPICK_INVALID_PRODUCT");
    return url.toString();
  } catch {
    throw new Error("ADPICK_INVALID_PRODUCT");
  }
}

function createExternalKey(affiliateUrl: string): string {
  const canonicalUrl = new URL(affiliateUrl);
  canonicalUrl.searchParams.delete("affid");
  canonicalUrl.searchParams.sort();
  return createHash("sha256").update(canonicalUrl.toString()).digest("hex");
}

/**
 * 애드픽 쇼핑 피드 정규화 — 핫딜(sdk_shopping_hotdeal.php)과 추천상품
 * (sdk_shopping.php)은 응답 스키마가 동일해 sourceType만 달리해 재사용한다.
 */
export function normalizeAdpickHotdeals(
  input: unknown,
  syncedAt: Date,
  affiliateId: string,
  sourceType: AffiliateSourceType = "hotdeal",
): NormalizedAffiliateProduct[] {
  if (Array.isArray(input) && input.length === 0) {
    throw new Error("ADPICK_EMPTY_LIST");
  }

  const response = responseSchema.safeParse(input);
  if (!response.success) {
    throw new Error("ADPICK_INVALID_RESPONSE");
  }

  const flattened = response.data.flatMap((theme) =>
    theme.list.map((product) => ({ product, theme }))
  );
  if (flattened.length === 0) {
    throw new Error("ADPICK_EMPTY_LIST");
  }

  const seenKeys = new Set<string>();
  const normalized: NormalizedAffiliateProduct[] = [];

  flattened.forEach(({ product: rawProduct, theme }, sourceRank) => {
    const parsedProduct = productSchema.safeParse(rawProduct);
    if (!parsedProduct.success) {
      throw new Error("ADPICK_INVALID_PRODUCT");
    }

    const product = parsedProduct.data;
    if (!isValidAdpickBuyUrl(product.buyurl, affiliateId)) {
      throw new Error("ADPICK_INVALID_PRODUCT");
    }

    const imageUrl = parseHttpsImage(product.photo);
    const mallIconUrl = parseHttpsImage(product.mall_icon);
    const externalKey = createExternalKey(product.buyurl);
    if (seenKeys.has(externalKey)) return;
    seenKeys.add(externalKey);

    normalized.push({
      provider: "adpick",
      sourceType,
      externalKey,
      themeCode: theme.theme_code == null ? null : String(theme.theme_code),
      themeTitle: theme.title,
      themeDescription: theme.description,
      sourceRank,
      productName: product.product_name,
      imageUrl,
      mallDomain: product.mall || null,
      mallName: product.mall_name || null,
      mallIconUrl,
      salePrice: parseMoney(product.price_sale),
      originalPrice: parseMoney(product.price_org),
      commissionLabel: product.commission,
      affiliateUrl: product.buyurl,
      syncedAt: syncedAt.toISOString(),
    });
  });

  return normalized;
}
