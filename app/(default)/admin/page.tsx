import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoursAgoIso } from "@/components/admin/constants";
import { getAdminStats } from "@/lib/actions/admin-stats";
import { getAdminGA4Report } from "@/lib/ga4-admin";
import { GA4DashboardPanel } from "@/components/admin/ga4-dashboard-panel";
import { memePathFrom } from "@/lib/labels";

export const metadata = { title: "대시보드" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { supabase } = await requireOperatorPage("/admin");

  const admin = createAdminClient();
  const dayAgo = hoursAgoIso(24);

  const [stats, ga4] = await Promise.all([getAdminStats(), getAdminGA4Report("dashboard")]);

  const [pendingRes, reportsRes, sourcesRes, safetyRes, translationsRes, jobRes, viewsRes] = await Promise.all([
    supabase
      .from("meme_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("meme_media")
      .select("meme_id", { count: "exact", head: true })
      .eq("review_state", "pending"),
    supabase
      .from("safety_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("meme_translations")
      .select("meme_id", { count: "exact", head: true })
      .eq("status", "machine"),
    supabase
      .from("job_runs")
      .select("ok, started_at, finished_at")
      .eq("job_name", "compute_trend_scores")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // view_events는 공개 SELECT 정책이 없어 service-role로 집계만 읽는다
    admin
      .from("view_events")
      .select("id", { count: "exact", head: true })
      .gt("created_at", dayAgo),
  ]);

  const job = jobRes.data;
  const batchLabel =
    job == null ? "기록 없음" : job.ok === true ? "정상" : job.ok === false ? "실패" : "실행 중";
  const batchTone =
    job == null
      ? "text-muted"
      : job.ok === true
        ? "text-safety-green"
        : job.ok === false
          ? "text-safety-red"
          : "text-safety-yellow";
  const batchIcon = job == null ? "◌" : job.ok === true ? "●" : job.ok === false ? "✕" : "▲";
  const batchTime = job?.started_at
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      }).format(new Date(job.started_at))
    : null;

  const tiles = [
    {
      href: "/admin/activity",
      label: "사용자 활동",
      value: "조회·구독 분석",
      sub: "사용자별 조회 콘텐츠와 일별·시간별 활동을 확인해요",
    },
    {
      href: "/admin/submissions",
      label: "대기 제보",
      value: `${pendingRes.count ?? 0}건`,
      sub: "검토를 기다리고 있어요",
    },
    {
      href: "/admin/reports",
      label: "미처리 신고",
      value: `${reportsRes.count ?? 0}건`,
      sub: "확인이 필요해요",
    },
    {
      href: "/admin/sources",
      label: "출처 검수 대기",
      value: `${sourcesRes.count ?? 0}건`,
      sub: "승인 전 임베드 후보예요",
    },
    {
      href: "/admin/translations",
      label: "번역 검수 대기",
      value: `${translationsRes.count ?? 0}건`,
      sub: "AI 초안이 검수를 기다리고 있어요",
    },
    {
      href: "/admin/radar-safety",
      label: "Radar 안전 검수",
      value: `${safetyRes.count ?? 0}건`,
      sub: "외부 신호의 등급 변경 제안이에요",
    },
    {
      href: "/admin/growth",
      label: "성장 운영",
      value: "Top 100",
      sub: "SEO 준비도와 영어 파일럿을 관리해요",
    },
    {
      href: "/admin/memes?focus=unsourced",
      label: "무출처 공개 문서",
      value: "품질 큐",
      sub: "트렌드 점수가 높은 무출처 문서부터 검수해요",
    },
    {
      href: null,
      label: "어제 배치 (trend_score)",
      value: batchLabel,
      sub: batchTime ? `최근 실행 ${batchTime}` : "compute_trend_scores 실행 기록이 없어요",
      tone: batchTone,
      icon: batchIcon,
    },
    {
      href: null,
      label: "최근 24시간 조회",
      value: `${(viewsRes.count ?? 0).toLocaleString("ko-KR")}회`,
      sub: "view_events 기준",
    },
  ];


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <GA4DashboardPanel report={ga4} />

      {/* DB 운영 지표 — GA4 방문 지표와 분리 */}
      <section aria-labelledby="today-stats" className="space-y-3">
        <h2 id="today-stats" className="text-lg font-bold">
          서비스 운영 <span className="text-sm font-normal text-muted">(DB 기준)</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="전체 회원"
            value={stats.totals.users.toLocaleString("ko-KR")}
            sub={`최근 7일 신규 ${stats.totals.newUsers7d}명`}
          />
          <StatCard
            label="Plus 구독자"
            value={stats.totals.plusActive.toLocaleString("ko-KR")}
            sub={
              stats.totals.users > 0
                ? `전환율 ${((stats.totals.plusActive / stats.totals.users) * 100).toFixed(1)}%`
                : "—"
            }
          />
        </div>
      </section>


      {/* 인기 밈 */}
      {stats.topMemes.length > 0 && (
        <section aria-labelledby="top-memes" className="rounded-xl border border-border bg-surface p-5">
          <h2 id="top-memes" className="text-lg font-bold">
            최근 14일 인기 밈 · DB view_events 기준
          </h2>
          <ol className="mt-3 divide-y divide-border">
            {stats.topMemes.map((m, i) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 shrink-0 text-center font-mono text-sm font-bold text-accent-text">
                  {i + 1}
                </span>
                <Link
                  href={memePathFrom(m.shortId, m.slug)}
                  className="min-w-0 flex-1 truncate font-semibold hover:text-accent"
                >
                  {m.title}
                </Link>
                <span className="shrink-0 tabular-nums text-sm text-muted">
                  {m.views.toLocaleString("ko-KR")}회
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 참여 지표 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="저장된 밈" value={stats.totals.savedMemes.toLocaleString("ko-KR")} sub="누적" />
        <StatCard label="커뮤니티 글" value={stats.totals.communityPosts.toLocaleString("ko-KR")} sub="누적" />
      </div>

      <h2 className="text-lg font-bold">운영 대기열</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const card = (
            <div
              key={t.label}
              className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-5"
            >
              <span className="text-base text-muted">{t.label}</span>
              <span className={`text-3xl font-bold ${t.tone ?? ""}`}>
                {t.icon ? (
                  <span aria-hidden className="mr-1.5 text-xl align-middle">
                    {t.icon}
                  </span>
                ) : null}
                {t.value}
              </span>
              <span className="text-sm text-muted">{t.sub}</span>
            </div>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="block rounded-xl hover:opacity-90">
              {card}
            </Link>
          ) : (
            card
          );
        })}
      </div>
    </div>
  );
}

/** 지표 카드 — 증감(delta)이 주어지면 색과 부호로 방향을 표시한다 */
function StatCard({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
}) {
  return (
    <div className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-5">
      <span className="text-base text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={`text-sm font-bold tabular-nums ${
              delta > 0 ? "text-safety-green" : "text-safety-red"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString("ko-KR")}
          </span>
        )}
      </span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </div>
  );
}
