import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "이 밈은 아직 없어요",
  robots: { index: false, follow: false },
};

/**
 * Rewrite target for a missing public meme (see proxy.ts). It lives inside the
 * (missing) root layout so notFound() has a layout to render the brand 404 in,
 * and the 404 status comes from this route itself: the standalone server does
 * not apply the rewrite's own status to a page that renders.
 */
export default function MissingPublicMemePage() {
  notFound();
}
