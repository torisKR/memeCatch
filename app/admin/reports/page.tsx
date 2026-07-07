import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReportActions } from "@/components/admin/report-actions";
import { memePathFrom } from "@/lib/labels";

export const metadata = { title: "신고" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

const TARGET_LABEL: Record<string, string> = {
  meme: "밈",
  discussion: "댓글",
  submission: "제보",
};

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, created_at, reporter:profiles!reports_reporter_id_fkey(nickname)")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`신고 목록을 불러오지 못했어요: ${error.message}`);

  const byType = (t: string) =>
    (reports ?? []).filter((r) => r.target_type === t).map((r) => r.target_id);

  const [memesRes, discussionsRes, submissionsRes] = await Promise.all([
    byType("meme").length
      ? supabase.from("memes").select("id, title, short_id, slug").in("id", byType("meme"))
      : Promise.resolve({ data: [] as { id: string; title: string; short_id: string; slug: string }[] }),
    byType("discussion").length
      ? supabase.from("discussions").select("id, body, status").in("id", byType("discussion"))
      : Promise.resolve({ data: [] as { id: string; body: string; status: string }[] }),
    byType("submission").length
      ? supabase.from("meme_submissions").select("id, name").in("id", byType("submission"))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const memeMap = new Map((memesRes.data ?? []).map((m) => [m.id, m]));
  const discussionMap = new Map((discussionsRes.data ?? []).map((d) => [d.id, d]));
  const submissionMap = new Map((submissionsRes.data ?? []).map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">신고</h1>
        <p className="mt-1 text-base text-muted">
          미처리 신고를 확인하고 처리(resolve) 또는 기각(dismiss)해요. 댓글은 신고 5회 누적 시
          자동으로 숨겨져요.
        </p>
      </div>

      {!reports || reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-lg font-semibold">미처리 신고가 없어요</p>
          <p className="mt-1 text-base text-muted">새 신고가 들어오면 여기에 표시돼요.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const meme = r.target_type === "meme" ? memeMap.get(r.target_id) : undefined;
            const discussion =
              r.target_type === "discussion" ? discussionMap.get(r.target_id) : undefined;
            const submission =
              r.target_type === "submission" ? submissionMap.get(r.target_id) : undefined;
            return (
              <li key={r.id} className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-base">
                  <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold">
                    {TARGET_LABEL[r.target_type] ?? r.target_type}
                  </span>
                  <span className="text-muted">
                    {r.reporter?.nickname ?? "탈퇴한 사용자"} · {fmt.format(new Date(r.created_at))}
                  </span>
                </div>

                <p className="text-base">
                  <span className="font-medium">신고 사유:</span> {r.reason}
                </p>

                {/* 대상 미리보기 */}
                <div className="rounded-lg bg-surface-2 p-3 text-base">
                  {meme && (
                    <Link href={memePathFrom(meme.short_id, meme.slug)} className="text-accent underline">
                      밈: {meme.title}
                    </Link>
                  )}
                  {discussion && (
                    <div>
                      <p className="whitespace-pre-wrap">{discussion.body}</p>
                      <p className="mt-1 text-sm text-muted">
                        현재 상태: {discussion.status === "hidden" ? "숨김" : discussion.status === "deleted" ? "삭제됨" : "공개"}
                      </p>
                    </div>
                  )}
                  {submission && (
                    <Link href={`/admin/submissions/${submission.id}`} className="text-accent underline">
                      제보: {submission.name}
                    </Link>
                  )}
                  {!meme && !discussion && !submission && (
                    <p className="text-muted">대상을 찾을 수 없어요 (삭제됐을 수 있어요).</p>
                  )}
                </div>

                <ReportActions
                  reportId={r.id}
                  discussion={
                    discussion
                      ? { id: discussion.id, status: discussion.status as "visible" | "hidden" | "deleted" }
                      : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
