"use client";

import { useLocale } from "@/lib/i18n-client";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";

export default function MemeCardsError({ reset }: { reset: () => void }) {
  const { locale } = useLocale();
  const copy = MEME_CARDS_COPY[locale];
  return <main className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="text-2xl font-bold">{copy.nav}</h1><p role="alert" className="mt-4 text-muted">{copy.loadFailure}</p><button type="button" className="mt-5 min-h-11 rounded-xl bg-accent-strong px-6 font-bold text-white" onClick={reset}>{copy.retry}</button></main>;
}
