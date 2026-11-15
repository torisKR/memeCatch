import type { Metadata } from "next";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { InquiryActions } from "@/components/admin/inquiry-actions";
import {
  INQUIRY_CATEGORY_LABEL,
  INQUIRY_STATUS_BADGE_CLASS,
  INQUIRY_STATUS_LABEL,
  type InquiryCategory,
  type InquiryStatus,
} from "@/lib/support";

export const metadata: Metadata = { title: "문의 관리" };

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

/** 관리자 — 고객센터 문의 목록(최신순)과 답변/상태 관리 */
export default async function AdminInquiriesPage() {
  const { supabase } = await requireOperatorPage("/admin/inquiries");

  const { data: inquiries } = await supabase
    .from("support_inquiries")
    .select("id, user_id, category, subject, body, status, admin_reply, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const userIds = [...new Set((inquiries ?? []).map((i) => i.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, nickname").in("id", userIds)
    : { data: [] as { id: string; nickname: string }[] };
  const nicknameById = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));

  const openCount = (inquiries ?? []).filter((i) => i.status === "open").length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">문의 관리</h1>
      <p className="mt-1 text-sm text-muted">
        미답변 {openCount}건 · 전체 {(inquiries ?? []).length}건 (최근 100건)
      </p>

      {!inquiries?.length ? (
        <p className="mt-6 rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          접수된 문의가 없어요.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {inquiries.map((inq) => {
            const status = inq.status as InquiryStatus;
            const category = inq.category as InquiryCategory;
            return (
              <li key={inq.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${INQUIRY_STATUS_BADGE_CLASS[status]}`}
                  >
                    {INQUIRY_STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs text-muted">
                    {INQUIRY_CATEGORY_LABEL[category] ?? category}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {nicknameById.get(inq.user_id) ?? "(탈퇴한 사용자)"}
                  </span>
                  <time dateTime={inq.created_at} className="ml-auto text-xs text-muted">
                    {dateFmt.format(new Date(inq.created_at))}
                  </time>
                </div>
                <h2 className="mt-2 text-sm font-semibold text-foreground">{inq.subject}</h2>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {inq.body}
                </p>
                <InquiryActions
                  inquiryId={inq.id}
                  status={status}
                  initialReply={inq.admin_reply}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
