import type { Metadata } from "next";
import Link from "next/link";
import { AdsenseScript } from "@/components/adsense-script";
import { COLLECTIONS, type CollectionDef } from "@/lib/collections";
import { SITE_URL } from "@/lib/site";

const DESCRIPTION =
  "최신 밈부터 시대별·주제별 한국 밈까지, 목적에 맞게 편집한 밈캐치 모음을 살펴보세요.";

export const metadata: Metadata = {
  title: "테마별 밈 모음",
  description: DESCRIPTION,
  alternates: { canonical: "/collections" },
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "테마별 밈 모음",
    description: DESCRIPTION,
    url: "/collections",
  },
};

const GROUPS = [
  {
    key: "start",
    eyebrow: "START",
    title: "바로 시작하기",
    description: "지금 필요한 밈부터 빠르게",
    slugs: ["latest", "beginner"],
  },
  {
    key: "era",
    eyebrow: "ERA",
    title: "시대별로 보기",
    description: "PC통신부터 숏폼까지 흐름대로",
    slugs: ["classic", "2000s", "2010s", "2020s"],
  },
  {
    key: "topic",
    eyebrow: "TOPIC",
    title: "주제별로 보기",
    description: "유행어·짤·챌린지와 문화권별로",
    slugs: ["phrase", "challenge", "song", "image", "streamer", "game"],
  },
] as const;

const collectionsBySlug = new Map(COLLECTIONS.map((collection) => [collection.slug, collection]));
const orderedCollections = GROUPS.flatMap((group) =>
  group.slugs
    .map((slug) => collectionsBySlug.get(slug))
    .filter((item): item is CollectionDef => Boolean(item)),
);

export default function CollectionsIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <AdsenseScript />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "테마별 밈 모음",
            description: DESCRIPTION,
            url: `${SITE_URL}/collections`,
            inLanguage: "ko",
            isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: orderedCollections.length,
              itemListElement: orderedCollections.map((collection, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: collection.title,
                url: `${SITE_URL}/collections/${collection.slug}`,
              })),
            },
          }).replace(/</g, "\\u003c"),
        }}
      />

      <nav aria-label="브레드크럼" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">밈캐치</Link>{" "}
        <span aria-hidden>›</span> 밈 모음
      </nav>

      <header className="mt-6 max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
          Curated index
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.035em] sm:text-5xl">
          흩어진 밈을,
          <br />
          <span className="text-accent">맥락별로 모았습니다.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          최신 유행을 따라가거나 한 시대의 분위기를 되짚고 싶을 때, 전체 목록을
          헤매지 않고 목적에 맞는 모음에서 시작하세요.
        </p>
      </header>

      <div className="mt-12 space-y-14">
        {GROUPS.map((group, groupIndex) => {
          const collections = group.slugs
            .map((slug) => collectionsBySlug.get(slug))
            .filter((item): item is CollectionDef => Boolean(item));

          return (
            <section key={group.key} aria-labelledby={`collection-group-${group.key}`}>
              <div className="grid gap-3 border-b border-border pb-4 sm:grid-cols-[8rem_1fr] sm:items-end">
                <p className="stat-mono text-xs font-semibold tracking-[0.14em] text-(--signal-cyan)">
                  0{groupIndex + 1} / {group.eyebrow}
                </p>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <h2 id={`collection-group-${group.key}`} className="text-2xl font-extrabold">
                    {group.title}
                  </h2>
                  <p className="text-sm text-muted">{group.description}</p>
                </div>
              </div>

              <ul>
                {collections.map((collection) => (
                  <li key={collection.slug} className="border-b border-border">
                    <Link
                      href={`/collections/${collection.slug}`}
                      className="hover-glow-flame group grid min-h-28 gap-3 rounded-xl py-5 transition-colors hover:text-accent sm:grid-cols-[8rem_1fr_auto] sm:items-center"
                    >
                      <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                        {collection.slug}
                      </span>
                      <span>
                        <span className="block text-lg font-extrabold text-foreground transition-colors group-hover:text-accent">
                          {collection.title}
                        </span>
                        <span className="mt-1 block max-w-2xl text-sm leading-relaxed text-muted">
                          {collection.description}
                        </span>
                      </span>
                      <span aria-hidden className="hidden text-xl sm:block">↗</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
