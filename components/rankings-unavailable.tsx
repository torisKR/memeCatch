import Link from "next/link";
import { getDocumentDirection, getDocumentLanguage, type Locale } from "@/lib/i18n";
import { rankingsExploreHref, rankingsFallbackCopy } from "@/lib/rankings-fallback-copy";

/**
 * Shown when the rankings list cannot be read. It stays inside the normal
 * document chrome and does not use an empty board or an error status.
 */
export function RankingsUnavailable({ locale }: { locale: Locale }) {
  const copy = rankingsFallbackCopy(locale);
  const direction = getDocumentDirection(locale);
  const rtl = direction === "rtl";

  return (
    <main
      lang={getDocumentLanguage(locale)}
      dir={direction}
      className={`mx-auto max-w-5xl px-4 py-6 ${rtl ? "text-right" : "text-start"}`}
    >
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{copy.guidance}</p>
      {/* justify-start is the right edge once dir=rtl; justify-end would sit on the left. */}
      <div className="mt-6 flex justify-start">
        <Link
          href={rankingsExploreHref(locale)}
          className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-base font-bold text-white"
        >
          {copy.explore}
        </Link>
      </div>
    </main>
  );
}
