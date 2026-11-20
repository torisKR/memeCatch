import Link from "next/link";
import { CATEGORIES, memePathFrom, type MemeCategory } from "@/lib/labels";
import type { MemeDirectoryItem } from "@/lib/meme-directory";

/**
 * 상세 하단의 "같은 분류" / "같은 해" 밈 링크. 목록은 lib/meme-directory에서
 * 오므로 색인 대상(사이트맵에 오르는) 문서만 링크한다. 얇은 noindex 문서는 없다.
 * 카드 대신 정적 텍스트 링크라 HTML이 가볍고 크롤러가 바로 따라간다.
 */
export function MemeNeighbourLinks({
  category,
  originYear,
  sameCategory,
  sameYear,
}: {
  category: string;
  originYear: number | null;
  sameCategory: readonly MemeDirectoryItem[];
  sameYear: readonly MemeDirectoryItem[];
}) {
  if (sameCategory.length === 0 && sameYear.length === 0) return null;
  const categoryLabel = category in CATEGORIES ? CATEGORIES[category as MemeCategory].user : "같은 분류";
  return (
    <section aria-labelledby="meme-neighbours" className="space-y-4">
      <h2 id="meme-neighbours" className="text-lg font-bold [word-break:keep-all]">
        이어서 읽을 밈
      </h2>
      {sameCategory.length > 0 && (
        <LinkGroup heading={`같은 분류: ${categoryLabel}`} items={sameCategory} />
      )}
      {sameYear.length > 0 && originYear != null && (
        <LinkGroup heading={`같은 해(${originYear}년)로 정리된 밈`} items={sameYear} />
      )}
      <p className="text-sm">
        <Link href="/memes" prefetch={false} className="font-semibold underline underline-offset-4">
          밈 전체 목록(가나다순) 보기
        </Link>
      </p>
    </section>
  );
}

function LinkGroup({ heading, items }: { heading: string; items: readonly MemeDirectoryItem[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted">{heading}</h3>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-base">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={memePathFrom(item.short_id, item.slug)}
              prefetch={false}
              className="underline decoration-border decoration-2 underline-offset-4 hover:decoration-accent [word-break:keep-all]"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
