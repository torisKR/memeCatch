import Link from "next/link";

import type { SeoRouteLocale } from "@/lib/i18n-routing";
import type { PublicMemeTrendSummary } from "@/lib/trend/public-evidence.server";

const copy: Record<SeoRouteLocale, {
  title: string;
  description: string;
  rising: string;
  revival: string;
  independentUses: (count: number) => string;
  evidence: string;
  scope: string;
  verified: string;
  stale: string;
}> = {
  ko: {
    title: "지금 확산이 확인된 밈",
    description: "최근 등록순이 아니라, 독립 사용례와 성장 근거를 운영자가 확인한 항목입니다.",
    rising: "상승",
    revival: "재유행",
    independentUses: (count) => `독립 사용례 ${count}건`,
    evidence: "확인 근거",
    scope: "관찰 범위",
    verified: "마지막 확인",
    stale: "확인 시각 오래됨",
  },
  en: {
    title: "Memes with verified spread",
    description: "These are operator-reviewed external signals, separate from recently published entries.",
    rising: "Rising",
    revival: "Revival",
    independentUses: (count) => `${count} independent uses`,
    evidence: "Evidence details",
    scope: "Observed scope",
    verified: "Last verified",
    stale: "Verification is old",
  },
  ja: {
    title: "拡散が確認されたミーム",
    description: "最近の公開順ではなく、独立した使用例と伸びの根拠を運営者が確認した項目です。",
    rising: "上昇",
    revival: "再流行",
    independentUses: (count) => `独立使用例 ${count}件`,
    evidence: "確認根拠",
    scope: "観察範囲",
    verified: "最終確認",
    stale: "確認日時が古い",
  },
  zh: {
    title: "已确认正在传播的迷因",
    description: "这里展示经运营审核的独立使用案例与增长依据，并与近期发布内容分开。",
    rising: "上升",
    revival: "再流行",
    independentUses: (count) => `独立使用案例 ${count}条`,
    evidence: "查看依据",
    scope: "观察范围",
    verified: "最后确认",
    stale: "确认时间较早",
  },
  "zh-tw": {
    title: "已確認正在擴散的迷因",
    description: "這裡顯示經營運審核的獨立使用案例與成長依據，並與近期發布內容分開。",
    rising: "上升",
    revival: "再流行",
    independentUses: (count) => `獨立使用案例 ${count}筆`,
    evidence: "查看依據",
    scope: "觀察範圍",
    verified: "最後確認",
    stale: "確認時間較早",
  },
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export function HomeTrendDiscovery({
  locale,
  entries,
}: {
  locale: SeoRouteLocale;
  entries: readonly PublicMemeTrendSummary[];
}) {
  if (entries.length === 0) return null;
  const labels = copy[locale];

  return (
    <section
      id="home-external-trends"
      data-home-section="external-trends"
      aria-labelledby="home-external-trends-title"
      className="mx-auto max-w-6xl px-4 py-10 sm:py-12"
    >
      <header className="max-w-2xl">
        <h2 id="home-external-trends-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {labels.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">{labels.description}</p>
      </header>

      <ul className="mt-5 divide-y divide-border border-y border-border">
        {entries.map((entry) => (
          <li key={entry.memeId} className="py-4" data-trend-state={entry.state}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-accent">
                    {entry.state === "revival" ? labels.revival : labels.rising}
                  </span>
                  <span className="text-muted">{labels.independentUses(entry.independentUseCount)}</span>
                  {entry.stale ? <span className="text-safety-yellow">{labels.stale}</span> : null}
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug">
                  <Link href={entry.href} className="underline-offset-4 hover:underline">
                    {entry.title}
                  </Link>
                </h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{entry.reason}</p>
              </div>

              <details className="shrink-0 text-sm text-muted sm:max-w-xs">
                <summary className="min-h-11 cursor-pointer content-center font-semibold text-foreground underline-offset-4 hover:underline">
                  {labels.evidence}
                </summary>
                <div className="pb-1 pt-2 text-xs leading-5">
                  <p>{labels.scope}: {entry.evidenceScope}</p>
                  <p>{labels.verified}: {dateFormatter.format(new Date(entry.lastVerifiedAt))}</p>
                  {entry.evidenceLinks.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {entry.evidenceLinks.map((evidence) => (
                        <li key={evidence.url}>
                          <a href={evidence.url} rel="noopener noreferrer" className="text-accent underline underline-offset-4">
                            {evidence.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
