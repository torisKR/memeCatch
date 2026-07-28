import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { OverdueBadge } from "@/components/admin/badges";
import { isSubmissionOverdue } from "@/components/admin/constants";
import { SubmissionReview } from "@/components/admin/submission-review";
import { memePathFrom, SUBMISSION_STATUS } from "@/lib/labels";

export const metadata = { title: "제보 검토" };

const fmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 방어심화 — 미들웨어와 별개로 페이지에서 operator 재검증
  const { supabase, user } = await requireOperatorPage(`/admin/submissions/${id}`);

  const { data: submission } = await supabase
    .from("meme_submissions")
    .select(
      "*, dup:memes!meme_submissions_dup_of_fkey(id, title, short_id, slug), submitter:profiles!meme_submissions_submitter_id_fkey(nickname), claimer:profiles!meme_submissions_claimed_by_fkey(nickname)"
    )
    .eq("id", id)
    .single();

  if (!submission) notFound();

  const overdue =
    ["pending", "reviewing"].includes(submission.status) &&
    isSubmissionOverdue(submission.created_at);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/submissions" className="text-base text-muted hover:text-foreground">
          ← 제보 큐로
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{submission.name}</h1>
          {overdue && <OverdueBadge />}
          <span className="text-base text-muted">
            {SUBMISSION_STATUS[submission.status].user}
          </span>
        </div>
      </div>

      {submission.dup_of && submission.dup && (
        <div className="rounded-xl border border-safety-yellow bg-safety-yellow-bg p-4">
          <p className="text-base font-semibold text-safety-yellow">
            <span aria-hidden>▲</span> 중복 의심 — 같은 이름의 밈이 이미 있어요
          </p>
          <Link
            href={memePathFrom(submission.dup.short_id, submission.dup.slug)}
            className="mt-1 inline-flex min-h-11 items-center text-base underline"
          >
            기존 밈 보기: {submission.dup.title}
          </Link>
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">제보 내용</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-3 text-base sm:grid-cols-2">
          <Field label="제보자" value={submission.submitter?.nickname ?? "탈퇴한 사용자"} />
          <Field label="접수 시각" value={fmt.format(new Date(submission.created_at))} />
          <Field label="본 곳" value={submission.seen_at || "미기재"} />
          <Field
            label="담당자"
            value={submission.claimer?.nickname ?? "아직 없음"}
          />
          <div className="sm:col-span-2">
            <dt className="text-muted">출처 링크</dt>
            <dd className="mt-0.5 break-all">
              {submission.source_url ? (
                <a
                  href={submission.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent-text underline"
                >
                  {submission.source_url}
                </a>
              ) : (
                "미기재"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted">설명</dt>
            <dd className="mt-0.5 whitespace-pre-wrap">{submission.description || "미기재"}</dd>
          </div>
          {submission.guess_reason && (
            <div className="sm:col-span-2">
              <dt className="text-muted">유행 이유 추측</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{submission.guess_reason}</dd>
            </div>
          )}
          {submission.attachment_path && (
            <div className="sm:col-span-2">
              <dt className="text-muted">첨부 이미지</dt>
              <dd className="mt-2">
                <a
                  href={`/api/media/${submission.attachment_path}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/media/${submission.attachment_path}`}
                    alt={`${submission.name} 제보 첨부 이미지`}
                    loading="lazy"
                    className="max-h-80 w-auto max-w-full rounded-xl border border-border object-contain"
                  />
                </a>
              </dd>
            </div>
          )}
          {submission.tags.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-muted">태그</dt>
              <dd className="mt-0.5">{submission.tags.join(", ")}</dd>
            </div>
          )}
          {submission.reject_reason && (
            <div className="sm:col-span-2">
              <dt className="text-safety-red">반려 사유</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{submission.reject_reason}</dd>
            </div>
          )}
        </dl>
      </section>

      {["pending", "reviewing"].includes(submission.status) ? (
        <SubmissionReview
          submissionId={submission.id}
          submissionName={submission.name}
          submissionTags={submission.tags}
          status={submission.status as "pending" | "reviewing"}
          claimedByMe={submission.claimed_by === user?.id}
          hasAnthropicKey={Boolean(process.env.ANTHROPIC_API_KEY)}
        />
      ) : (
        <p className="rounded-xl border border-border bg-surface-2 p-4 text-base text-muted">
          이미 처리된 제보예요.
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
