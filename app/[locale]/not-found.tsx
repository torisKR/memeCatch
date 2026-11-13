import type { Metadata } from "next";
import { metadata as koreanNotFoundMetadata } from "@/app/(default)/not-found";
import { buildLocalizedMetadata, isSeoContentLocale } from "@/lib/i18n-routing";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";

// The Korean title and body stay. Share tags keep the locale layout card and
// only replace the image, so og:url, locale, site name, type, and title stay
// the localized home values while both images are `/og/{locale}`.
export { default } from "@/app/(default)/not-found";

type NotFoundProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: NotFoundProps): Promise<Metadata> {
  const { locale } = await params;
  const metadata: Metadata = {
    title: koreanNotFoundMetadata.title,
    robots: koreanNotFoundMetadata.robots,
  };
  if (!isSeoContentLocale(locale)) return metadata;

  const localized = buildLocalizedMetadata({ locale, pathname: "/" });
  const image = ogDefaultImageDescriptor(locale);
  return {
    ...metadata,
    openGraph: {
      ...localized.openGraph,
      images: [image],
    },
    twitter: {
      ...localized.twitter,
      images: [image],
    },
  };
}
