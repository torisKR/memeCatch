import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AttributionTracker } from "@/components/attribution-tracker";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalHeader } from "@/components/global-header";
import { MemeChatbot } from "@/components/meme-chatbot";
import { NavProgress } from "@/components/nav-progress";
import { PremiumAdControl } from "@/components/premium-ad-control";
import { PwaInstall } from "@/components/pwa-install";
import { ScrollChrome } from "@/components/scroll-chrome";
import { SiteFooter } from "@/components/site-footer";
import { OrganizationJsonLd } from "@/components/json-ld";
import { PublicWebMcpTools } from "@/components/webmcp/public-tools";
import {
  LocaleAutoDetect,
  LocaleDocumentSync,
  LocaleProvider,
} from "@/lib/i18n-client";
import {
  getDocumentDirection,
  getDocumentLanguage,
  type Locale,
} from "@/lib/i18n";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Shared document chrome for every root layout.
 *
 * The root layouts themselves select a static locale. Keeping request APIs out
 * of this component is deliberate: `headers()`/`cookies()` would opt every
 * descendant into request-time rendering and break the existing ISR contract.
 */
export function RootDocument({
  children,
  locale,
  showRankings = true,
}: {
  children: React.ReactNode;
  locale: Locale;
  showRankings?: boolean;
}) {
  return (
    <html
      lang={getDocumentLanguage(locale)}
      dir={getDocumentDirection(locale)}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col max-md:pb-[calc(4.5rem+4rem+1rem)] md:pb-0">
        <LocaleProvider initialLocale={locale}>
          <PublicWebMcpTools />
          <LocaleDocumentSync />
          <LocaleAutoDetect />
          <ScrollChrome />
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
          <AttributionTracker />
          <OrganizationJsonLd />
          {/* The window is the scroller so route changes, hashes, and
              back/forward move the page. Bottom padding keeps the end of the
              page above the chat launcher and the bottom nav. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <GlobalHeader showRankings={showRankings} />
            <div className="min-w-0 flex-1">{children}</div>
            <SiteFooter showRankings={showRankings} />
          </div>
          <PremiumAdControl />
          <BottomNav />
          <Suspense fallback={null}>
            <MemeChatbot />
          </Suspense>
          <PwaInstall />
        </LocaleProvider>
      </body>
    </html>
  );
}
