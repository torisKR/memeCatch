import Link from "next/link";

/** 카탈로그를 읽지 못한 상세. 없는 밈 404와 다른 화면이다. */
export function MemeCatalogUnavailable() {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-3xl flex-col justify-center px-4 py-16 text-foreground">
      <p className="text-sm font-bold text-accent-text">밈 사전</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
        이 밈을 잠시 불러오지 못했어요
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-foreground">
        사전 연결이 잠시 막혀 있어요. 문서는 그대로 있고, 연결이 돌아오면 이 주소에서 다시 열려요.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/search"
          className="inline-flex min-h-11 items-center rounded-xl bg-foreground px-4 text-sm font-bold text-background"
        >
          밈 검색하기
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
