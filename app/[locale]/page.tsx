import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeExperience } from "@/components/home/home-experience";
import {
  SEO_CONTENT_LOCALES,
  SEO_LOCALE_CONFIG,
  buildLocalizedMetadata,
  getSeoCopy,
  isSeoContentLocale,
  localizedMemePath,
} from "@/lib/i18n-routing";
import { getLocalizedFeaturedMemes } from "@/lib/meme-translations";
import { SITE_URL } from "@/lib/site";
import { loadMemeArtUrls } from "@/lib/meme-art.server";
import { loadDiscoveryIndex } from "@/lib/index-gate.server";

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  return buildLocalizedMetadata({
    locale,
    pathname: "/",
    availableLocales: ["ko", ...SEO_CONTENT_LOCALES],
  });
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

  const [available, discovery] = await Promise.all([
    getLocalizedFeaturedMemes(locale, 24),
    loadDiscoveryIndex(),
  ]);
  const listed = discovery.ok
    ? available.filter((meme) => discovery.ids.has(meme.id))
    : [];
  const featured = [...listed]
    .sort(
      (left, right) =>
        Date.parse(right.translation.updatedAt) - Date.parse(left.translation.updatedAt),
    )
    .slice(0, 8);
  const config = SEO_LOCALE_CONFIG[locale];
  const seo = getSeoCopy(locale);
  const artUrls = await loadMemeArtUrls(featured.map((meme) => meme.id));
  const rawEntries = featured.map((meme) => ({
    id: meme.id,
    href: localizedMemePath(locale, meme.short_id, meme.slug),
    title: meme.title,
    summary: meme.summary,
    categoryLabel: seo.categories[meme.category],
    originalTitle: meme.original.title,
    safetyLevel: meme.safety_level,
    category: meme.category,
    year: meme.origin_year,
    artUrl: artUrls.get(meme.id) ?? null,
    thumbnailUrl: meme.meme_contents?.find((content) => content.is_representative && content.thumbnail_url)?.thumbnail_url
      ?? meme.meme_contents?.find((content) => content.thumbnail_url)?.thumbnail_url
      ?? null,
  }));
  const entries = rawEntries;

  return (
    <main
      lang={config.documentLanguage}
      dir={config.direction}
      className="bg-background text-foreground"
    >
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
      <HomeExperience locale={locale} entries={entries} />
    </main>
  );
}
