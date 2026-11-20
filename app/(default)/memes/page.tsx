import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CATEGORIES, memePathFrom, type MemeCategory } from "@/lib/labels";
import {
  MEME_DIRECTORY_PAGE_SIZE,
  directoryPage,
  directoryPagePath,
  parseDirectoryPage,
} from "@/lib/meme-directory";
import { loadMemeDirectory } from "@/lib/meme-directory.server";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";
import { SITE_URL } from "@/lib/site";

/**
 * 크롤링용 전체 밈 목록. 사이트맵에 오르는 한국어 색인 대상 밈만 가나다순으로
 * 100개씩 정적 <a href>로 나열한다. 얇은(noindex) 문서는 넣지 않는다.
 * 데이터는 lib/meme-directory.server.ts가 1시간 캐시한다.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function resolvePage(searchParams: Props["searchParams"]) {
  const raw = (await searchParams).page;
  const page = parseDirectoryPage(raw);
  if (page === null) notFound();
  // ?page=1은 /memes와 같은 문서다. 중복 URL을 남기지 않는다.
  if (raw !== undefined && page === 1) permanentRedirect(directoryPagePath(1));
  const directory = await loadMemeDirectory();
  if (!directory.ok) throw new Error("meme directory unavailable");
  const slice = directoryPage(directory.items, page);
  if (!slice) notFound();
  return { ...slice, total: directory.items.length };
}

function pageTitle(page: number, pageCount: number): string {
  return page === 1
    ? "밈 전체 목록 (가나다순) — 뜻·유래 사전"
    : `밈 전체 목록 ${page}/${pageCount}쪽 (가나다순)`;
}

function pageDescription(page: number, total: number, first?: string, last?: string): string {
  const range = first && last ? ` 이 쪽은 「${first}」부터 「${last}」까지예요.` : "";
  return (
    `밈캐치가 뜻·유래·사용 맥락을 정리한 밈 문서 ${total.toLocaleString("ko-KR")}개를 가나다순으로 모았어요.` +
    `${range} 각 문서에서 지금 써도 되는지와 출처도 확인할 수 있어요.` +
    (page > 1 ? ` (${page}쪽)` : "")
  );
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { items, page, pageCount, total } = await resolvePage(searchParams);
  const path = directoryPagePath(page);
  const title = pageTitle(page, pageCount);
  const description = pageDescription(page, total, items[0]?.title, items.at(-1)?.title);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title,
      description,
      url: path,
      images: [ogDefaultImageDescriptor("ko")],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function categoryLabel(category: string): string | null {
  return category in CATEGORIES ? CATEGORIES[category as MemeCategory].user : null;
}

export default async function MemeDirectoryPage({ searchParams }: Props) {
  const { items, page, pageCount, total } = await resolvePage(searchParams);
  const startIndex = (page - 1) * MEME_DIRECTORY_PAGE_SIZE;
  const prev = page > 1 ? directoryPagePath(page - 1) : null;
  const next = page < pageCount ? directoryPagePath(page + 1) : null;

  return (
    <main className="mx-auto max-w-site px-4 pb-14 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: pageTitle(page, pageCount),
            url: `${SITE_URL}${directoryPagePath(page)}`,
            inLanguage: "ko",
            isPartOf: { "@type": "WebSite", name: "밈캐치", url: SITE_URL },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: items.length,
              itemListElement: items.slice(0, 10).map((item, i) => ({
                "@type": "ListItem",
                position: startIndex + i + 1,
                name: item.title,
                url: `${SITE_URL}${memePathFrom(item.short_id, item.slug)}`,
              })),
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <nav aria-label="브레드크럼" className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">밈캐치</Link>{" "}
        <span aria-hidden>›</span>{" "}
        <Link href="/explore" className="hover:text-foreground">밈 탐색</Link>
      </nav>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight [word-break:keep-all]">
        밈 전체 목록
        {page > 1 ? <span className="ml-2 text-xl font-bold text-muted">{page}쪽</span> : null}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted [word-break:keep-all]">
        뜻·유래·사용 맥락을 확인한 밈 문서 {total.toLocaleString("ko-KR")}개를 가나다순으로 모았어요.
        조건으로 거르려면 <Link href="/explore" className="underline underline-offset-2">밈 탐색</Link>,
        주제로 보려면 <Link href="/collections" className="underline underline-offset-2">테마별 모음</Link>을 쓰세요.
      </p>

      <ol start={startIndex + 1} className="mt-8 divide-y divide-border border-y border-border">
        {items.map((item) => {
          const label = categoryLabel(item.category);
          return (
            <li key={item.id} className="py-3">
              <Link
                prefetch={false}
                href={memePathFrom(item.short_id, item.slug)}
                className="text-base font-bold underline decoration-transparent decoration-2 underline-offset-4 hover:decoration-accent [word-break:keep-all]"
              >
                {item.title}
              </Link>
              {(label || item.origin_year) && (
                <span className="ml-2 text-xs text-muted">
                  {[label, item.origin_year ? `${item.origin_year}년` : null].filter(Boolean).join(" · ")}
                </span>
              )}
              {item.summary ? (
                <p className="mt-0.5 line-clamp-1 text-sm text-muted">{item.summary}</p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <nav aria-label="목록 페이지" className="mt-8 space-y-4">
        <div className="flex justify-between gap-3">
          {prev ? (
            <Link prefetch={false} href={prev} rel="prev" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              ← 이전 쪽
            </Link>
          ) : <span />}
          {next ? (
            <Link prefetch={false} href={next} rel="next" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              다음 쪽 →
            </Link>
          ) : <span />}
        </div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <li key={n}>
              {n === page ? (
                <span aria-current="page" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground px-2 font-bold text-background">
                  {n}
                </span>
              ) : (
                <Link prefetch={false} href={directoryPagePath(n)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-2 hover:bg-surface-2">
                  {n}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
