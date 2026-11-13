import type { Metadata } from "next";
import { KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES } from "@/lib/i18n-routing";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";

/**
 * Korean page share tags. The layout openGraph has no url, so each page
 * sets `og:url` to its own canonical. A page that sets openGraph also has
 * to repeat the image: a child openGraph object replaces the layout one.
 */
export function koreanPageShare(input: {
  title: string;
  description: string;
  pathname: string;
  /**
   * Pages that did not set `openGraph` on main inherit the layout's four
   * alternate locales. Passing true copies that list, because this object
   * replaces the layout card.
   */
  alternateLocales?: boolean;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = ogDefaultImageDescriptor("ko");
  return {
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title: input.title,
      description: input.description,
      url: input.pathname,
      ...(input.alternateLocales
        ? { alternateLocale: KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES }
        : {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}
