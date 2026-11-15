import { afterEach, describe, expect, it, vi } from "vitest";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import LocalizedPricingPage, { generateMetadata } from "@/app/[locale]/pricing/page";

afterEach(() => vi.unstubAllEnvs());

describe("localized Plus pricing metadata", () => {
  it("publishes reciprocal Japanese Plus metadata rather than Korean defaults", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "ja" }),
    });

    expect(metadata.title).toBe(
      `MemeCatch Plus — ${PREMIUM_COPY.ja.pricing.title}`,
    );
    expect(metadata.description).toBe(PREMIUM_COPY.ja.pricing.intro);
    expect(metadata.alternates).toEqual({
      canonical: "/ja/pricing",
      languages: {
        ko: "/pricing",
        en: "/en/pricing",
        ja: "/ja/pricing",
        "zh-Hans": "/zh/pricing",
        "zh-Hant": "/zh-tw/pricing",
        "x-default": "/en/pricing",
      },
    });
    expect(metadata.openGraph).toMatchObject({
      locale: "ja_JP",
      url: "/ja/pricing",
    });
  });

  it("does not make unsupported locale routes indexable", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: "th" }) }),
    ).resolves.toEqual({ robots: { index: false, follow: false } });
  });
});

describe("localized Plus pricing checkout readiness", () => {
  it("passes the strict server kill switch to the client content", async () => {
    vi.stubEnv("UNIFI_PAY_CHECKOUT_ENABLED", "true");

    const page = await LocalizedPricingPage({ params: Promise.resolve({ locale: "ja" }) });

    expect(page.props.checkoutEnabled).toBe(true);
  });
});
