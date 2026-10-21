import Link from "next/link";
import type { PublicMemeTrendSummary } from "@/lib/trend/public-evidence.server";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export function HomeTrendDiscovery({
  entries,
}: {
  entries: readonly PublicMemeTrendSummary[];
}) {
  if (entries.length === 0) return null;

  return (
    <section
      id="home-external-trends"
      data-home-section="external-trends"
      aria-labelledby="home-external-trends-title"
      className="mx-auto max-w-6xl px-4 py-14"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            External spread
          </p>
          <h2 id="home-external-trends-title" className="mt-2 text-2xl font-black">
            지금 확산 근거가 확인된 밈
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            최근 등록순이나 밈캐치 내부 조회수가 아니라, 서로 다른 작성자의 독립 사용례와 비교 가능한 성장 근거를 운영자가 확인한 항목만 보여줘요.
          </p>
        </div>
        <Link href="/explore?sort=recent" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
          최근 등록 콘텐츠 보기
        </Link>
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {entries.map((entry) => (
          <li key={entry.memeId} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent">
                {entry.state === "revival" ? "재유행" : "상승"}
              </span>
              <span className="text-muted">독립 사용례 {entry.independentUseCount}건</span>
              {entry.stale ? <span className="text-safety-yellow">확인 시각 오래됨</span> : null}
            </div>
            <h3 className="mt-3 text-xl font-bold">
              <Link href={entry.href} className="underline-offset-4 hover:underline">{entry.title}</Link>
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{entry.reason}</p>
            <p className="mt-3 text-xs text-muted">
              관찰 범위: {entry.evidenceScope} · 마지막 확인 {dateFormatter.format(new Date(entry.lastVerifiedAt))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
