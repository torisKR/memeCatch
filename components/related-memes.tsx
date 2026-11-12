import { MemeCard, type MemeCardModel } from "@/components/meme-card";
import { withLocaleFallback, type Locale } from "@/lib/i18n";

const RELATED_COPY = withLocaleFallback({
  ko: {
    title: "관련 밈",
    description: "이 밈과 가까운 항목이에요.",
  },
  en: {
    title: "Related memes",
    description: "Memes that sit close to this one.",
  },
  ja: {
    title: "関連ミーム",
    description: "このミームに近い項目です。",
  },
  zh: {
    title: "相关迷因",
    description: "和这条迷因相近的条目。",
  },
  "zh-tw": {
    title: "相關迷因",
    description: "和這則迷因相近的條目。",
  },
});

export type RelatedMeme = {
  meme: MemeCardModel & { id: string };
  href?: string;
};

/**
 * Detail-page related posters. Up to six cards, 28px titles, 16px gap.
 * Renders nothing when the catalog has no neighbors, so the page doesn't
 * keep an empty heading.
 */
export function RelatedMemes({
  memes,
  locale,
}: {
  memes: readonly RelatedMeme[];
  locale: Locale;
}) {
  const cards = memes.slice(0, 6);
  if (cards.length === 0) return null;
  const copy = RELATED_COPY[locale];

  return (
    <section
      aria-labelledby="related-memes"
      className="mt-2 max-md:mb-[calc(4rem+1rem)] max-md:pr-[calc(4rem+1rem)]"
    >
      <h2 id="related-memes" className="text-xl font-bold">
        {copy.title}
      </h2>
      <p className="mt-1 text-sm text-muted">{copy.description}</p>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ meme, href }) => (
          <li key={meme.id} className="min-w-0">
            <MemeCard meme={meme} href={href} locale={locale} titleSize="detail" />
          </li>
        ))}
      </ul>
    </section>
  );
}
