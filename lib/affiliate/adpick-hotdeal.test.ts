import { describe, expect, it } from "vitest";
import {
  isValidAdpickBuyUrl,
  normalizeAdpickHotdeals,
  parseMoney,
} from "@/lib/affiliate/adpick-hotdeal";

const validPayload = [{
  title: "실시간 핫딜",
  theme_code: 20,
  description: "현재 판매 가능한 상품",
  list: [{
    product_name: "테스트 상품",
    photo: "https://img.podgate.com/product.jpg",
    mall: "shop.example.com",
    mall_name: "테스트몰",
    mall_icon: "https://img.podgate.com/mall.png",
    price_sale: "12,900",
    price_org: "25,800",
    commission: "10%",
    buyurl: "https://adpick.co.kr/apis/goshopping.php?affid=member123&offer=abc12&url=https%3A%2F%2Fshop.example.com%2Fp%2F1",
  }],
}];

describe("parseMoney", () => {
  it.each([
    ["12,900", 12900],
    ["0", null],
    ["", null],
    ["가격문의", null],
  ])("converts %s", (value, expected) => {
    expect(parseMoney(value)).toBe(expected);
  });
});

describe("isValidAdpickBuyUrl", () => {
  it("accepts only the official HTTPS redirect with the configured affiliate id", () => {
    expect(isValidAdpickBuyUrl(validPayload[0].list[0].buyurl, "member123")).toBe(true);
    expect(isValidAdpickBuyUrl("https://evil.example/redirect", "member123")).toBe(false);
    expect(isValidAdpickBuyUrl(validPayload[0].list[0].buyurl, "other-member")).toBe(false);
  });
});

describe("normalizeAdpickHotdeals", () => {
  it("normalizes prices, removes affid from the key, and keeps source order", () => {
    const products = normalizeAdpickHotdeals(validPayload, new Date("2026-07-13T00:00:00Z"), "member123");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      productName: "테스트 상품",
      salePrice: 12900,
      originalPrice: 25800,
      sourceRank: 0,
      provider: "adpick",
      sourceType: "hotdeal",
    });
    expect(products[0].externalKey).not.toContain("member123");
  });

  it("rejects empty lists and unsafe URLs", () => {
    expect(() => normalizeAdpickHotdeals([], new Date(), "member123")).toThrow("ADPICK_EMPTY_LIST");
    const unsafe = structuredClone(validPayload);
    unsafe[0].list[0].buyurl = "https://evil.example/redirect";
    expect(() => normalizeAdpickHotdeals(unsafe, new Date(), "member123")).toThrow("ADPICK_INVALID_PRODUCT");
  });

  it("validates image URLs before discarding duplicate products", () => {
    const duplicateWithUnsafeImage = structuredClone(validPayload);
    duplicateWithUnsafeImage[0].list.push({
      ...duplicateWithUnsafeImage[0].list[0],
      photo: "http://img.podgate.com/unsafe.jpg",
    });

    expect(() => normalizeAdpickHotdeals(
      duplicateWithUnsafeImage,
      new Date("2026-07-13T00:00:00Z"),
      "member123",
    )).toThrow("ADPICK_INVALID_PRODUCT");
  });
});
