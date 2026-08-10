import { describe, expect, it } from "vitest";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { generateMetadata } from "@/app/[locale]/pricing/page";

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
