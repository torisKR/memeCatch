import type { Viewport } from "next";
import { RootDocument } from "@/app/_root/root-document";
import { ROOT_VIEWPORT } from "@/app/_root/metadata";

export const viewport: Viewport = ROOT_VIEWPORT;

/** Arabic meme shares only. `/ar` itself stays unpublished. */
export default function ArabicMemeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument locale="ar">{children}</RootDocument>;
}
