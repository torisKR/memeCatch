import type { ReactNode } from "react";
import { RootDocument } from "@/app/_root/root-document";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { koreanRankingsVisible } from "@/lib/korean-rankings.server";
import "../globals.css";

export { metadata, viewport } from "@/app/(default)/layout";

/**
 * Own root so /rankings is outside the Korean segment's loading boundary.
 * That boundary streams a 200 before notFound() can set a 404.
 * The link uses the same predicate as the page, including on the 404.
 */
export default async function RankingsLayout({ children }: { children: ReactNode }) {
  const showRankings = await koreanRankingsVisible();
  return (
    <RootDocument locale={DEFAULT_LOCALE} showRankings={showRankings}>
      {children}
    </RootDocument>
  );
}
