import Link from "next/link";
import { requireOperatorPage } from "@/app/admin/require-operator";
import { OverdueBadge } from "@/components/admin/badges";
import { isSubmissionOverdue } from "@/components/admin/constants";
import { SUBMISSION_STATUS } from "@/lib/labels";

export const metadata = { title: "제보 큐" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export default async function SubmissionsQueuePage() {
  // 방어심화 — 미들웨어와 별개로 페이지에서 operator 재검증
  const { supabase } = await requireOperatorPage("/admin/submissions");
  const { data: submissions, error } = await supabase
    .from("meme_submissions")
    .select(
      "id, name, seen_at, source_url, status, dup_of, claimed_by, created_at, dup:memes!meme_submissions_dup_of_fkey(title, short_id)"
    )
    .in("status", ["pending", "reviewing"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(`제보 목록을 불러오지 못했어요: ${error.message}`);

  const list = [...(submissions ?? [])].sort((a, b) => {
    const ao = isSubmissionOverdue(a.created_at) ? 0 : 1;
    const bo = isSubmissionOverdue(b.created_at) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">제보 큐</h1>
        <p className="mt-1 text-base text-muted">
          접수 순서대로 검토해요. 48시간이 지난 제보가 먼저 보여요.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-lg font-semibold">대기 중인 제보가 없어요</p>
          <p className="mt-1 text-base text-muted">새 제보가 들어오면 여기에 표시돼요.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/submissions/${s.id}`}
                className="flex min-h-11 flex-col gap-2 rounded-xl border border-border bg-surface p-4 hover:border-accent sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{s.name}</span>
                    {isSubmissionOverdue(s.created_at) && <OverdueBadge />}
                    {s.dup_of && (
                      <span className="inline-flex items-center rounded-full bg-safety-yellow-bg px-2.5 py-0.5 text-sm font-semibold text-safety-yellow">
                        중복 의심{s.dup ? `: ${s.dup.title}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-base text-muted">
                    {s.seen_at ? `본 곳: ${s.seen_at}` : "본 곳 미기재"}
                    {s.source_url ? ` · ${s.source_url}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-base text-muted">
                  <span
                    className={
                      s.status === "reviewing" ? "font-medium text-accent" : undefined
                    }
                  >
                    {SUBMISSION_STATUS[s.status as "pending" | "reviewing"].user}
                  </span>
                  <span>{fmt.format(new Date(s.created_at))}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
