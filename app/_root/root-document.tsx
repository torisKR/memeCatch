import { Suspense } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AttributionTracker } from "@/components/attribution-tracker";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalHeader } from "@/components/global-header";
import { MemeChatbot } from "@/components/meme-chatbot";
import { NavProgress } from "@/components/nav-progress";
import { PremiumAdControl } from "@/components/premium-ad-control";
import { PwaInstall } from "@/components/pwa-install";
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
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  return (
    <html
      lang={getDocumentLanguage(locale)}
      dir={getDocumentDirection(locale)}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col pb-16 md:pb-0">
        <LocaleProvider initialLocale={locale}>
          <PublicWebMcpTools />
          <LocaleDocumentSync />
          <LocaleAutoDetect />
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
          <AttributionTracker />
          <OrganizationJsonLd />
          <GlobalHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
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
