import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { HomeExperience } from "@/components/home/home-experience";
import {
  SEO_LOCALE_CONFIG,
  buildLocalizedMetadata,
  getSeoCopy,
  isSeoContentLocale,
  localizedMemePath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { getLocalizedFeaturedMemesResult } from "@/lib/meme-translations";
import { SITE_URL } from "@/lib/site";

export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

const getLocalizedHomeCoverage = cache((locale: SeoContentLocale) =>
  getLocalizedFeaturedMemesResult(locale, 24),
);

async function requireLocalizedHomeCoverage(locale: SeoContentLocale) {
  const result = await getLocalizedHomeCoverage(locale);
  if (result.status === "unavailable") {
    throw new Error(`[localized-home] translation coverage unavailable: ${locale}`);
  }
  return result;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  const coverage = await requireLocalizedHomeCoverage(locale);
  const hasCoverage = coverage.status === "active";

  const metadata = buildLocalizedMetadata({
    locale,
    pathname: "/",
    ...(hasCoverage ? { availableLocales: ["ko", locale] } : {}),
  });
  return {
    ...metadata,
    ...(hasCoverage ? {} : { robots: { index: false, follow: true } }),
  };
}

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default async function LocalizedHomePage({ params }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  const coverage = await requireLocalizedHomeCoverage(locale);
  const featured = [...coverage.items]
    .sort(
      (left, right) =>
        Date.parse(right.translation.updatedAt) - Date.parse(left.translation.updatedAt),
    )
    .slice(0, 6);
  const config = SEO_LOCALE_CONFIG[locale];
  const seo = getSeoCopy(locale);
  const entries = featured.map((meme) => ({
    id: meme.id,
    href: localizedMemePath(locale, meme.short_id, meme.slug),
    title: meme.title,
    summary: meme.summary,
    categoryLabel: seo.categories[meme.category],
    originalTitle: meme.original.title,
    safetyLevel: meme.safety_level,
    category: meme.category,
    thumbnailUrl: meme.meme_contents?.find((content) => content.is_representative && content.thumbnail_url)?.thumbnail_url
      ?? meme.meme_contents?.find((content) => content.thumbnail_url)?.thumbnail_url
      ?? null,
  }));

  return (
    <main
      lang={config.documentLanguage}
      dir={config.direction}
      className="bg-background text-foreground"
    >
      {coverage.status === "active" && (
        <JsonLd
          data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/${locale}#website`,
              name: seo.siteName,
              url: `${SITE_URL}/${locale}`,
              description: seo.description,
              inLanguage: config.bcp47,
              publisher: { "@id": `${SITE_URL}#org` },
            },
            {
              "@type": "DefinedTermSet",
              "@id": `${SITE_URL}/${locale}#glossary`,
              name: seo.glossaryName,
              description: seo.glossaryDescription,
              url: `${SITE_URL}/${locale}`,
              inLanguage: config.bcp47,
            },
          ],
          }}
        />
      )}
      <HomeExperience locale={locale} entries={entries} />
    </main>
  );
}
