import { OG_DEFAULT_COPY, OG_DEFAULT_DESIGN } from "@/lib/og-default-image";
import { renderOgDefaultImage } from "@/lib/og-default-card";

export const alt = OG_DEFAULT_COPY.ko.alt;
export const size = {
  width: OG_DEFAULT_DESIGN.width,
  height: OG_DEFAULT_DESIGN.height,
};
export const contentType = OG_DEFAULT_DESIGN.contentType;

/** Korean default preview. Detail and pricing inherit this instead of a per-meme card. */
export default function OgImage() {
  return renderOgDefaultImage("ko");
}
