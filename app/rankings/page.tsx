import type { Metadata } from "next";
import { RankingsJsonLd } from "@/components/json-ld";
import { RankingsUnavailable } from "@/components/rankings-unavailable";
import Link from "next/link";
import { flags } from "@/lib/flags";
import type { Locale } from "@/lib/i18n";
import { rankingsFallbackCopy } from "@/lib/rankings-fallback-copy";
import {
  LIFECYCLE_STATUS,
  SAFETY_LEVELS,
  memePathFrom,
  type LifecycleStatus,
  type SafetyLevel,
} from "@/lib/labels";
import { loadKoreanRankings } from "@/lib/korean-rankings.server";
import { koreanPageShare } from "@/lib/korean-share-metadata";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";
import { koreanRankingsRenderList, type PublicRankingMeme } from "@/lib/korean-rankings";
import { AdsenseScript } from "@/components/adsense-script";
import {
  RANKING_METHODS,
  formatRollupDate,
  isLowSample,
  type RankingMethodKey,
} from "@/lib/ranking/methods";

/**
 * Request-time render. A shared `revalidate` would store whichever HTML the
 * build produced, so a database-less image would keep the fallback until that
 * window elapsed. `force-dynamic` does not prerender it. The loader also
 * skips its short memory cache for an outage, so the next request after the
 * database returns renders the live list.
 */
export const dynamic = "force-dynamic";

const RANKINGS_DESCRIPTION =
  "밈캐치 안에서 오늘 급상승한 밈, 이번 주 많이 본 밈, 다시 뜨는 추억 밈을 모았어요.";

export async function generateRankingsMetadata(locale: Locale): Promise<Metadata> {
  const rankings = await loadKoreanRankings();
  if (!koreanRankingsRenderList(rankings)) {
    const copy = rankingsFallbackCopy(locale);
    if (locale !== "ko") {
      return {
        title: copy.title,
        description: copy.guidance,
        robots: { index: false, follow: true },
      };
    }
    return {
      title: copy.title,
      description: copy.guidance,
      robots: { index: false, follow: true },
      alternates: { canonical: "/rankings" },
      ...koreanPageShare({
        title: copy.title,
        description: copy.guidance,
        pathname: "/rankings",
      }),
    };
  }
  if (locale !== "ko") {
    const copy = rankingsFallbackCopy(locale);
    return {
      title: copy.title,
      alternates: { canonical: "/rankings" },
      // The live board stays the Korean canonical page. Prefixed URLs follow it
      // and stay out of the index so a translated shell is not a second listing.
      robots: { index: false, follow: true },
      openGraph: {
        type: "website",
        siteName: "MemeCatch",
        title: copy.title,
        url: `/${locale}/rankings`,
      },
    };
  }
  const title = rankings.kind === "published" ? "이번 주 많이 본 밈" : "밈캐치 내 급상승";
  const description = rankings.kind === "published"
    ? "공개된 밈 기록에서 최근 글을 모았어요."
    : RANKINGS_DESCRIPTION;
  return {
    title,
    description,
    alternates: { canonical: "/rankings" },
    // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title,
      description,
      url: "/rankings",
      images: [ogDefaultImageDescriptor("ko")],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogDefaultImageDescriptor("ko")],
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return generateRankingsMetadata("ko");
}

type MemeRow = PublicRankingMeme;

export async function RankingsScreen({ locale }: { locale: Locale }) {
  const rankings = await loadKoreanRankings();
  if (!koreanRankingsRenderList(rankings)) return <RankingsUnavailable locale={locale} />;
  if (rankings.kind === "published") {
    return <PublishedWeeklyList memes={rankings.memes} />;
  }
  const data = rankings;

  const rankedForSchema = (data.fallback ?? data.today).slice(0, 10);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <AdsenseScript />
      {rankedForSchema.length > 0 && <RankingsJsonLd items={rankedForSchema} />}
      <h1 className="text-2xl font-bold">밈캐치 내 급상승</h1>
      <p className="mt-1 text-base text-muted">밈캐치 내부 조회·반응 신호를 기준으로 모았어요.</p>

      {!flags.communityEnabled && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3"
        >
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent">
            베타
          </span>
          <p className="text-base text-muted">집계 준비 중이에요 — 순위는 참고용이에요.</p>
        </div>
      )}

      {data.fallback && (
        <section aria-label="에디토리얼 픽" className="mt-6">
          <div className="rounded-2xl border border-border bg-surface-2 p-5 text-center">
            <p className="text-base font-semibold">아직 집계 전이에요 — 큐레이션으로 만나보세요</p>
            <p className="mt-1 text-base text-muted">
              순위가 쌓이는 동안, 새로 등록된 밈을 골라 담았어요.
            </p>
          </div>
          {data.fallback.length === 0 ? (
            <p className="mt-6 rounded-xl bg-surface-2 p-6 text-center text-base text-muted">
              등록된 밈이 아직 없어요. 곧 채워질 거예요!
            </p>
          ) : (
            <ol className="mt-4 grid gap-2 lg:grid-cols-2 lg:gap-x-8">
              {data.fallback.map((m, i) => (
                <RankItem key={m.id} meme={m} rank={i + 1} />
              ))}
            </ol>
          )}
        </section>
      )}

      {!data.fallback && (
        <div className="instrument-grid mt-6 rounded-3xl border border-border/60 p-4 sm:p-6">
          {/* CSS 라디오 탭 — 클라이언트 상태나 JS 없이 서버 렌더 마크업으로 전환 */}
          <input type="radio" name="rank-tab" id="rank-tab-today" className="peer/today sr-only" defaultChecked />
          <input type="radio" name="rank-tab" id="rank-tab-week" className="peer/week sr-only" />
          <input type="radio" name="rank-tab" id="rank-tab-again" className="peer/again sr-only" />

          {/* 실제 컨트롤은 위의 라디오 그룹 — 라벨은 시각적 탭 역할.
              활성 탭은 flame 언더라인(inset box-shadow) + 은은한 글로우로 표시한다. */}
          <div className="flex gap-2">
            <label
              htmlFor="rank-tab-today"
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-border bg-surface px-3 text-center text-base font-medium text-muted transition-colors peer-checked/today:border-flame-500/70 peer-checked/today:bg-flame-500/10 peer-checked/today:font-semibold peer-checked/today:text-accent peer-checked/today:shadow-[inset_0_-2px_0_0_var(--flame-500),0_0_16px_-4px_var(--flame-500)]"
            >
              오늘의 급상승
            </label>
            <label
              htmlFor="rank-tab-week"
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-border bg-surface px-3 text-center text-base font-medium text-muted transition-colors peer-checked/week:border-flame-500/70 peer-checked/week:bg-flame-500/10 peer-checked/week:font-semibold peer-checked/week:text-accent peer-checked/week:shadow-[inset_0_-2px_0_0_var(--flame-500),0_0_16px_-4px_var(--flame-500)]"
            >
              이번 주 많이 본
            </label>
            <label
              htmlFor="rank-tab-again"
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-border bg-surface px-3 text-center text-base font-medium text-muted transition-colors peer-checked/again:border-flame-500/70 peer-checked/again:bg-flame-500/10 peer-checked/again:font-semibold peer-checked/again:text-accent peer-checked/again:shadow-[inset_0_-2px_0_0_var(--flame-500),0_0_16px_-4px_var(--flame-500)]"
            >
              다시 뜨는
            </label>
          </div>

          <section aria-label="오늘의 급상승" className="mt-4 hidden peer-checked/today:block">
            <MethodNote
              method="today"
              lastRollupDate={data.lastRollupDate}
              topViews={data.topWeeklyViews}
            />
            {data.today.length === 0 ? (
              <EmptyList message="오늘 급상승한 밈이 아직 없어요." />
            ) : (
              <ol className="grid gap-2 lg:grid-cols-2 lg:gap-x-8">
                {data.today.map((m, i) => (
                  <RankItem key={m.id} meme={m} rank={i + 1} />
                ))}
              </ol>
            )}
          </section>

          <section aria-label="이번 주 많이 본" className="mt-4 hidden peer-checked/week:block">
            <MethodNote
              method="weekly"
              lastRollupDate={data.lastRollupDate}
              topViews={data.topWeeklyViews}
            />
            {data.weeklyLocked ? (
              <div className="rounded-xl border border-border bg-surface-2 p-5 text-center">
                <p className="font-semibold">이번 주 조회 순위는 Plus에서 볼 수 있어요.</p>
                <Link className="mt-3 inline-flex min-h-11 items-center text-accent underline" href="/pricing">
                  Plus 보기
                </Link>
              </div>
            ) : data.weekly.length === 0 ? (
              <EmptyList message="이번 주 조회 집계가 아직 없어요. 내일 다시 확인해 보세요." />
            ) : (
              <ol className="grid gap-2 lg:grid-cols-2 lg:gap-x-8">
                {data.weekly.map((m, i) => (
                  <RankItem
                    key={m.id}
                    meme={m}
                    rank={i + 1}
                    extra={`이번 주 ${m.weeklyViews.toLocaleString("ko-KR")}회`}
                  />
                ))}
              </ol>
            )}
          </section>

          <section aria-label="다시 뜨는" className="mt-4 hidden peer-checked/again:block">
            <MethodNote
              method="comeback"
              lastRollupDate={data.lastRollupDate}
              topViews={data.topWeeklyViews}
            />
            {data.comeback.length === 0 ? (
              <EmptyList message="다시 뜨는 추억 밈이 아직 없어요." />
            ) : (
              <ol className="grid gap-2 lg:grid-cols-2 lg:gap-x-8">
                {data.comeback.map((m, i) => (
                  <RankItem key={m.id} meme={m} rank={i + 1} />
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default async function RankingsPage() {
  return RankingsScreen({ locale: "ko" });
}

/**
 * 산정 기준 공개 — 각 탭이 어떤 기간·산식으로 뽑혔는지, 마지막 집계는 언제인지,
 * 그리고 표본이 순위를 지지하는지를 밝힌다.
 *
 * 표본 경고를 붙이는 이유: 2026-08 기준 최근 7일 총 조회가 308회라 상위권 간
 * 격차가 조회 1~2회다. 그 상태의 "1위"를 단정적으로 보여 주면 없는 정밀도를
 * 주장하게 된다. 트래픽이 임계치를 넘으면 이 경고는 자동으로 사라진다.
 */
function PublishedWeeklyList({ memes }: { memes: MemeRow[] }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <AdsenseScript />
      <RankingsJsonLd items={memes.slice(0, 10)} />
      <h1 className="text-2xl font-bold">이번 주 많이 본 밈</h1>
      <p className="mt-1 text-base text-muted">공개된 밈 기록에서 최근 글을 모았어요.</p>
      <ol className="mt-6 grid gap-2 lg:grid-cols-2 lg:gap-x-8">
        {memes.map((meme, index) => (
          <RankItem key={meme.id} meme={meme} rank={index + 1} />
        ))}
      </ol>
    </main>
  );
}

function MethodNote({
  method,
  lastRollupDate,
  topViews,
}: {
  method: RankingMethodKey;
  lastRollupDate: string | null;
  topViews: number;
}) {
  const { period, formula } = RANKING_METHODS[method];
  const rollup = formatRollupDate(lastRollupDate);
  const lowSample = isLowSample(topViews);

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
      <p>
        <span className="font-semibold text-foreground">집계 기간 {period}</span>
        {rollup && <> · 마지막 집계 {rollup}</>}
      </p>
      <p className="mt-1">{formula}</p>
      {lowSample && (
        <p className="mt-2 flex items-start gap-1.5 font-medium text-foreground">
          <span aria-hidden>▲</span>
          <span>
            표본 적음 — 기간 내 조회가 적어 순위 차이가 크지 않아요. 정확한 등수보다
            어떤 밈이 올라왔는지를 봐 주세요.
          </span>
        </p>
      )}
    </div>
  );
}

function EmptyList({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-surface-2 p-6 text-center text-base text-muted">{message}</p>
  );
}

function RankItem({
  meme,
  rank,
  extra,
}: {
  meme: MemeRow;
  rank: number;
  extra?: string;
}) {
  const safety = SAFETY_LEVELS[meme.safety_level as SafetyLevel];
  const life = LIFECYCLE_STATUS[meme.lifecycle_status as LifecycleStatus];
  const isTopThree = rank <= 3;
  return (
    <li className="min-w-0">
      <Link
        href={memePathFrom(meme.short_id, meme.slug)}
        className={`flex min-h-11 items-start gap-3 rounded-2xl p-4 transition-colors ${
          isTopThree
            ? "edge-signal"
            : "border border-border bg-surface hover:border-accent/40 hover:bg-surface-2"
        }`}
      >
        {/* 숫자는 장식으로 두고 의미는 sr-only가 전한다.
            이전에는 이 <span>에 aria-label="1위"를 달았지만, ARIA 명세상 generic
            role에는 aria-label이 지원되지 않는다 — 무시하는 스크린리더에서는 맥락
            없는 "1"만 읽히고, 존중하는 쪽에서도 구현에 따라 숫자와 라벨이 겹쳐 읽힐
            수 있다. LOOP.md 「순위 숫자와 accessible name이 중복 읽히지 않는지」. */}
        <span
          aria-hidden
          className={`stat-mono w-7 shrink-0 pt-0.5 text-lg font-bold ${
            isTopThree ? "text-accent" : "text-muted"
          }`}
        >
          {rank}
        </span>
        <span className="sr-only">{rank}위</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{meme.title}</span>
          {meme.summary && (
            <span className="mt-0.5 block truncate text-base text-muted">{meme.summary}</span>
          )}
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            {/* 신호등: 색+아이콘+텍스트 병행 */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium"
              style={{
                color: `var(--${safety.token})`,
                backgroundColor: `var(--${safety.token}-bg)`,
              }}
            >
              <span aria-hidden>{safety.icon}</span>
              {safety.user}
            </span>
            <span
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: `var(--${life.token})` }}
            >
              <FlameIcon
                className={`h-3.5 w-3.5 ${meme.lifecycle_status === "rising" ? "flame-rising" : ""}`}
              />
              {life.user}
            </span>
            {extra && <span className="text-sm text-muted">{extra}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2c.6 3-0.6 4.7-2 6.3C8.5 10 7 11.7 7 14.5A5.3 5.3 0 0 0 12.3 20 5.7 5.7 0 0 0 18 14.2c0-2.6-1.3-4.4-2.6-5.9-.4 1-.9 1.7-1.8 2.2.2-3.2-.4-6.3-1.6-8.5Z" />
    </svg>
  );
}
