import type { Metadata } from "next";
import { metadata as koreanNotFoundMetadata } from "@/app/(default)/not-found";
import { isSeoContentLocale } from "@/lib/i18n-routing";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";

// The Korean title, body, and noindex decision stay. This file only stops the
// root `opengraph-image` file from replacing og:image while twitter stays on
// the locale layout's `/og/{locale}` card.
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

  const image = ogDefaultImageDescriptor(locale);
  return {
    ...metadata,
    openGraph: { images: [image] },
    twitter: { images: [image] },
  };
}
