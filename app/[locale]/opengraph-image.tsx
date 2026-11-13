import {
  OG_DEFAULT_DESIGN,
  isOgPageLocale,
  ogDefaultCopy,
  type OgDefaultLocale,
} from "@/lib/og-default-image";
import { renderOgDefaultImage } from "@/lib/og-default-card";

type ImageParams = { params: Promise<{ locale: string }> };

function pageImageLocale(locale: string): OgDefaultLocale {
  return isOgPageLocale(locale) ? locale : "en";
}

export async function generateImageMetadata({ params }: ImageParams) {
  const { locale } = await params;
  const resolved = pageImageLocale(locale);
  const copy = ogDefaultCopy(resolved);
  return [
    {
      id: resolved,
      alt: copy.alt,
      size: {
        width: OG_DEFAULT_DESIGN.width,
        height: OG_DEFAULT_DESIGN.height,
      },
      contentType: OG_DEFAULT_DESIGN.contentType,
    },
  ];
}

/** Locale default preview. Home, detail, and pricing inherit this one image. */
export default async function OgImage({ params }: ImageParams) {
  const { locale } = await params;
  return renderOgDefaultImage(pageImageLocale(locale));
}
