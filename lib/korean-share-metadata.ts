import type { Metadata } from "next";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";

/**
 * Korean page share tags. A child that omits these inherits the home card:
 * `og:url` stays `/`, and X uses the home title because the layout twitter
 * block has no title of its own for post-processing to replace.
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
