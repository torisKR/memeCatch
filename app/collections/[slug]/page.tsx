import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { COLLECTIONS, getCollection, type CollectionDef } from "@/lib/collections";
import type { MemeListItem } from "@/lib/queries";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { memePathFrom } from "@/lib/labels";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** 테마별 밈 모음 허브 — 미드테일 검색("2000년대 밈" 등) 유입용 정적 콘텐츠. ISR 1시간 */
export const revalidate = 3600;

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const col = getCollection(slug);
  if (!col) return { title: "모음을 찾을 수 없어요" };
  return {
    title: col.title,
    description: col.description,
    alternates: { canonical: `/collections/${col.slug}` },
  };
}

const SELECT = "*, meme_contents(thumbnail_url, is_representative)";
const LIMIT = 24;

async function loadMemes(col: CollectionDef): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    let q = supabase
      .from("memes")
      .select(SELECT)
      .in("moderation_status", ["approved", "limited"]);
    switch (col.filter.kind) {
      case "decade":
        q = q
          .gte("origin_year", col.filter.from)
          .lte("origin_year", col.filter.to)
          .order("trend_score", { ascending: false });
        break;
      case "category":
        q = q
          .eq("category", col.filter.category)
          .order("trend_score", { ascending: false });
        break;
      case "beginner":
        q = q
          .eq("difficulty", "beginner")
          .order("trend_score", { ascending: false });
        break;
      case "latest":
        q = q.order("published_at", { ascending: false, nullsFirst: false });
        break;
    }
    const { data } = await q.order("id", { ascending: false }).limit(LIMIT);
    return (data ?? []) as MemeListItem[];
  } catch {
    return [];
  }
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const col = getCollection(slug);
  if (!col) notFound();

  const memes = await loadMemes(col);
  const url = `${SITE_URL}/collections/${col.slug}`;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      {/* CollectionPage + ItemList — 허브의 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: col.title,
            description: col.description,
            url,
            inLanguage: "ko",
            isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: memes.length,
              itemListElement: memes.slice(0, 10).map((m, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: m.title,
                url: `${SITE_URL}${memePathFrom(m.short_id, m.slug)}`,
              })),
            },
          }).replace(/</g, "\\u003c"),
        }}
      />

      <nav aria-label="브레드크럼" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          밈캐치
        </Link>{" "}
        <span aria-hidden>›</span> 모음
      </nav>

      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{col.title}</h1>
      {/* 고유 인트로 — 씬 콘텐츠 방지 + AI 인용 가능 블록 */}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        {col.intro}
      </p>

      {memes.length > 0 ? (
        <>
          <MotionList
            as="ul"
            itemAs="li"
            className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            itemClassName="min-w-0"
          >
            {memes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} />
            ))}
          </MotionList>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/explore${col.exploreQuery ? `?${col.exploreQuery}` : ""}`}
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-base font-bold text-white transition-[filter] hover:brightness-95 active:scale-[0.97]"
            >
              전체 탐색에서 더 보기 <span aria-hidden className="ml-1">→</span>
            </Link>
          </div>
        </>
      ) : (
        <p className="mt-8 rounded-2xl border border-border bg-surface p-6 text-base text-muted">
          이 모음은 준비 중이에요. 곧 채워질 거예요.
        </p>
      )}

      {/* 다른 모음으로의 내부 링크 — 허브 간 연결 */}
      <section aria-labelledby="other-collections" className="mt-12">
        <h2 id="other-collections" className="text-lg font-bold">
          다른 모음도 보기
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {COLLECTIONS.filter((c) => c.slug !== col.slug).map((c) => (
            <li key={c.slug}>
              <Link
                href={`/collections/${c.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
