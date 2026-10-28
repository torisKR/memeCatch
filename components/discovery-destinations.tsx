import Link from "next/link";
import { ArrowRight } from "lucide-react";

const DESTINATIONS = [
  { href: "/explore", label: "밈" },
  { href: "/community", label: "커뮤니티" },
  { href: "/products", label: "밈 상품" },
] as const;

/** Compact editorial route bar and contribution actions for the home page. */
export function DiscoveryDestinations() {
  return (
    <section aria-label="밈캐치 둘러보기" className="mx-auto max-w-6xl px-4 pt-3 sm:pt-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <nav aria-label="바로 가기">
          <ul className="grid grid-cols-3 divide-x divide-border">
            {DESTINATIONS.map((item, index) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-12 items-center justify-center gap-1 px-2 text-sm font-bold transition-colors hover:bg-surface-2 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:min-h-14 sm:gap-2 sm:text-base ${index === 0 ? "text-accent-text" : "text-foreground"}`}
                >
                  {item.label}
                  <ArrowRight aria-hidden className="hidden size-4 sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm font-semibold text-foreground">
            발견한 밈의 맥락을 함께 기록해요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/community/new"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            >
              이야기 나누기
            </Link>
            <Link
              href="/submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            >
              밈 제보
            </Link>
            <Link
              href="/products/new"
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-accent-strong px-3 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            >
              내 밈 상품 등록
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
