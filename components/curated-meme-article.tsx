import Link from "next/link";
import { MemePosterCard } from "@/components/meme-poster-card";
import type { CuratedMeme } from "@/lib/curated-memes";
import { SAFETY_LEVELS } from "@/lib/labels";

const PLACE: Record<"friends" | "work" | "sns", string> = {
  work: "직장",
  friends: "친구",
  sns: "SNS",
};

/** 홈 검증 가이드 카드가 가리키는 편집 밈. 카탈로그 행이 없어도 본문이 있다. */
export function CuratedMemeArticle({ meme }: { meme: CuratedMeme }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 text-foreground">
      <nav className="text-sm">
        <Link href="/" className="underline-offset-4 hover:underline">
          밈캐치
        </Link>
      </nav>
      <header className="mt-6 border-b border-border pb-8">
        <MemePosterCard
          title={meme.title}
          summary={meme.summary}
          safetyLevel={meme.safety_level}
          year={meme.origin_year}
          artUrl={null}
          size="detail"
          locale="ko"
          heading="h1"
          summaryId="meme-summary"
          priority
        />
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

      <section className="mt-8">
        <h2 className="text-xl font-black">뜻</h2>
        <p className="mt-3 text-base leading-7">{meme.description}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black">유래</h2>
        <p className="mt-3 text-base leading-7">{meme.origin}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black">어디서 쓸까</h2>
        <ul className="mt-3 grid gap-2 text-base">
          {(Object.keys(PLACE) as Array<keyof typeof PLACE>).map((place) => (
            <li key={place} className="flex items-center justify-between gap-4 border-b border-border py-2">
              <span>{PLACE[place]}</span>
              <span className="font-semibold">{SAFETY_LEVELS[meme.usage_context[place]].user}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-black">이렇게 써요</h2>
        <div className="mt-4 grid gap-4">
          {meme.usage_examples.map((example) => (
            <div key={example.context} className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-base font-bold">{example.context}</h3>
              <ul className="mt-3 grid gap-2 text-base leading-7">
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

      {meme.caution ? (
        <section className="mt-8">
          <h2 className="text-xl font-black">주의</h2>
          <p className="mt-3 text-base leading-7">{meme.caution}</p>
        </section>
      ) : null}
    </article>
  );
}
