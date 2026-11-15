import type { ReactNode } from "react";
import { RootDocument } from "@/app/_root/root-document";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import "../globals.css";

export { metadata, viewport } from "@/app/(default)/layout";

/**
 * Own root so /rankings is outside the Korean segment's loading boundary.
 * The rankings link is always rendered; a database outage must not remove it
 * from this shell or from pages prerendered at build time.
 */
export default function RankingsLayout({ children }: { children: ReactNode }) {
  return (
    <RootDocument locale={DEFAULT_LOCALE}>
      {children}
    </RootDocument>
  );
}
