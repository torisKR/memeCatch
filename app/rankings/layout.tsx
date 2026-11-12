import type { ReactNode } from "react";
import { RootDocument } from "@/app/_root/root-document";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import "../globals.css";

export { metadata, viewport } from "@/app/(default)/layout";

/**
 * Own root so /rankings is outside the Korean segment's loading boundary.
 * That boundary streams a 200 before notFound() can set a 404.
 */
export default function RankingsLayout({ children }: { children: ReactNode }) {
  return (
    <RootDocument locale={DEFAULT_LOCALE} showRankings>
      {children}
    </RootDocument>
  );
}
