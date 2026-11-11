import Link from "next/link";
import {
  ARTICLE_BODY,
  ARTICLE_COLUMN,
  MemeArticleFooter,
  MemeByline,
} from "@/components/meme-article-meta";
import { RelatedMemeLinks } from "@/components/related-meme-links";
import { CURATED_CORE_MEMES, curatedPassesIndexGate, type CuratedMeme } from "@/lib/curated-memes";
import { memePathFrom, SAFETY_LEVELS } from "@/lib/labels";
import { posterBadgeTone } from "@/lib/meme-poster";

const PLACE: Record<"friends" | "work" | "sns", string> = {
  work: "직장",
  friends: "친구",
  sns: "SNS",
};

/** 홈 검증 가이드 카드가 가리키는 편집 밈. 카탈로그 행이 없어도 본문이 있다. */
export function CuratedMemeArticle({ meme }: { meme: CuratedMeme }) {
  const places = (Object.keys(PLACE) as Array<keyof typeof PLACE>).filter(
    (place) => meme.usage_context[place],
  );
  const related = CURATED_CORE_MEMES.filter(
    (item) => item.short_id !== meme.short_id && curatedPassesIndexGate(item),
  )
    .slice(0, 6)
    .map((item) => ({
      href: memePathFrom(item.short_id, item.slug),
      title: item.title,
      summary: item.summary,
    }));

  return (
    <article className={`${ARTICLE_COLUMN} px-4 py-10 text-foreground`}>
      <nav className="text-sm">
        <Link href="/" className="underline-offset-4 hover:underline">
          밈캐치
        </Link>
      </nav>
      <header className="mt-6 border-b border-border pb-8">
        <h1 className="text-[1.75rem] font-black leading-tight tracking-tight">{meme.title}</h1>
        <MemeByline />
        {meme.summary.trim() ? (
          <p id="meme-summary" className={`mt-4 ${ARTICLE_BODY}`}>
            {meme.summary}
          </p>
        ) : null}
        {meme.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {meme.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-sm font-medium text-muted"
              >
                #{tag}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {meme.description.trim() ? (
        <section className="mt-8">
          <h2 className="text-xl font-black">뜻</h2>
          <p className={`mt-3 ${ARTICLE_BODY}`}>{meme.description}</p>
        </section>
      ) : null}

      {meme.origin.trim() ? (
        <section className="mt-8">
          <h2 className="text-xl font-black">유래</h2>
          <p className={`mt-3 ${ARTICLE_BODY}`}>{meme.origin}</p>
        </section>
      ) : null}

      {places.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-black">어디서 쓸까</h2>
          <ul className="mt-3 grid gap-2">
            {places.map((place) => {
              const level = meme.usage_context[place];
              const tone = posterBadgeTone(level);
              return (
                <li key={place} className="flex flex-wrap items-center gap-2 border-b border-border py-2">
                  <span className={ARTICLE_BODY}>{PLACE[place]}</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-sm font-semibold"
                    style={{ background: tone.background, color: tone.foreground }}
                  >
                    {SAFETY_LEVELS[level].user}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {meme.usage_examples.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-black">이렇게 써요</h2>
          <div className="mt-4 grid gap-4">
            {meme.usage_examples.map((example) => (
              <div key={example.context} className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="text-base font-bold">{example.context}</h3>
                <ul className={`mt-3 grid gap-2 ${ARTICLE_BODY}`}>
                  {example.dialogue.map((line) => (
                    <li key={`${example.context}-${line.speaker}-${line.line}`}>
                      <span className="font-semibold">{line.speaker}. </span>
                      {line.line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {meme.caution?.trim() ? (
        <section className="mt-8">
          <h2 className="text-xl font-black">주의</h2>
          <p className={`mt-3 ${ARTICLE_BODY}`}>{meme.caution}</p>
        </section>
      ) : null}

      <RelatedMemeLinks items={related} />
      <MemeArticleFooter />
    </article>
  );
}
