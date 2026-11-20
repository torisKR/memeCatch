import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { OverdueBadge } from "@/components/admin/badges";
import { isSubmissionOverdue } from "@/components/admin/constants";
import { memePathFrom, SUBMISSION_STATUS } from "@/lib/labels";
import {
  ContributionReview,
  type ContributionQueueItem,
} from "@/components/admin/contribution-review";

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
  const { db } = await requireOperatorPage("/admin/submissions");
  const { data: submissions, error } = await db
    .from("meme_submissions")
    .select(
      "id, name, seen_at, source_url, status, dup_of, claimed_by, created_at, dup:memes!meme_submissions_dup_of_fkey(title, short_id)"
    )
    .in("status", ["pending", "reviewing"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(`제보 목록을 불러오지 못했어요: ${error.message}`);

  // 문서 보강 제보(밈 상세의 출처·예문). 이 큐가 깨져도 새 밈 제보 큐는 보여야 하므로
  // 조회 실패는 안내만 하고 넘어간다(마이그레이션 적용 전 환경 포함).
  const { data: contributionRows, error: contributionError } = await db
    .from("meme_contributions")
    .select(
      "id, kind, source_url, note, example_situation, example_text, credit_public, created_at, meme:memes!meme_contributions_meme_id_fkey(title, short_id, slug), contributor:profiles!meme_contributions_contributor_id_fkey(nickname)"
    )
    .in("status", ["pending", "reviewing"])
    .order("created_at", { ascending: true })
    .limit(100);
  const contributions: ContributionQueueItem[] = (contributionRows ?? []).map((c) => ({
    id: c.id,
    kind: c.kind === "example" ? "example" : "source",
    sourceUrl: c.source_url,
    note: c.note,
    situation: c.example_situation,
    text: c.example_text,
    creditPublic: c.credit_public,
    contributorNickname: c.contributor?.nickname ?? null,
    memeTitle: c.meme?.title ?? "(삭제된 밈)",
    memePath: c.meme ? memePathFrom(c.meme.short_id, c.meme.slug) : null,
    createdAtLabel: fmt.format(new Date(c.created_at)),
  }));

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

      <section aria-labelledby="contribution-queue" className="space-y-3">
        <div>
          <h2 id="contribution-queue" className="text-xl font-bold">
            문서 보강 제보 {contributions.length > 0 && <span className="text-muted">{contributions.length}</span>}
          </h2>
          <p className="mt-1 text-base text-muted">
            밈 상세에서 받은 출처 링크·사용 예문이에요. 승인하면 새 밈을 만들지 않고 그 밈 문서에 바로 붙어요.
          </p>
        </div>
        {contributionError ? (
          <p className="rounded-xl border border-border bg-surface-2 p-4 text-base text-muted">
            보강 제보를 불러오지 못했어요. ({contributionError.message})
          </p>
        ) : contributions.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-base text-muted">
            대기 중인 보강 제보가 없어요.
          </p>
        ) : (
          <ul className="space-y-3">
            {contributions.map((item) => (
              <li key={item.id}>
                <ContributionReview item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="text-xl font-bold">새 밈 제보</h2>
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
