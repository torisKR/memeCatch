import type { Metadata } from "next";
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
