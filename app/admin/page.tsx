import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoursAgoIso } from "@/components/admin/constants";

export const metadata = { title: "대시보드" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "operator") redirect("/");

  const admin = createAdminClient();
  const dayAgo = hoursAgoIso(24);

  const [pendingRes, reportsRes, jobRes, viewsRes] = await Promise.all([
    supabase
      .from("meme_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
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
