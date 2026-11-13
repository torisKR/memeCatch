import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InquiryForm } from "@/components/support/inquiry-form";
import {
  INQUIRY_CATEGORY_LABEL,
  INQUIRY_STATUS_BADGE_CLASS,
  INQUIRY_STATUS_LABEL,
  type InquiryCategory,
  type InquiryStatus,
} from "@/lib/support";
import { koreanPageShare } from "@/lib/korean-share-metadata";

export const metadata: Metadata = {
  title: "고객센터",
  description: "밈캐치에 버그 신고, 콘텐츠 정정·삭제 요청, 건의사항을 보내 주세요.",
  robots: { index: false },
  alternates: { canonical: "/support" },
  ...koreanPageShare({
    title: "고객센터",
    description: "밈캐치에 버그 신고, 콘텐츠 정정·삭제 요청, 건의사항을 보내 주세요.",
    pathname: "/support",
  }),
};

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

/**
 * 고객센터 — 로그인 사용자가 운영자에게 1:1 문의를 보내고,
 * 보낸 문의와 답변을 모아보는 페이지. 비로그인은 로그인 유도.
 */
export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inquiries } = user
    ? await supabase
        .from("support_inquiries")
        .select("id, category, subject, body, status, admin_reply, replied_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: null };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">고객센터</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        버그 신고, 콘텐츠 정정·삭제 요청, 건의사항을 보내 주세요. 답변이 등록되면 이
        페이지에서 확인할 수 있어요.
      </p>

      <section aria-labelledby="inquiry-form-heading" className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 id="inquiry-form-heading" className="text-lg font-bold text-foreground">
          문의하기
        </h2>
        {user ? (
          <div className="mt-4">
            <InquiryForm />
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-surface-2 px-4 py-5 text-center">
            <p className="text-sm text-muted">문의를 보내려면 로그인이 필요해요.</p>
            <Link
              href="/login?next=/support"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-accent-strong px-6 text-sm font-bold text-white transition-transform active:scale-[0.98]"
            >
              로그인하고 문의하기
            </Link>
          </div>
        )}
      </section>

      {user && (
        <section aria-labelledby="my-inquiries-heading" className="mt-8">
          <h2 id="my-inquiries-heading" className="text-lg font-bold text-foreground">
            내 문의 내역
          </h2>
          {!inquiries?.length ? (
            <p className="mt-3 rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              아직 보낸 문의가 없어요.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {inquiries.map((inq) => {
                const status = inq.status as InquiryStatus;
                const category = inq.category as InquiryCategory;
                return (
                  <li
                    key={inq.id}
                    className={`rounded-2xl border border-border bg-surface p-4 ${
                      inq.admin_reply ? "hover-glow-flame" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${INQUIRY_STATUS_BADGE_CLASS[status]}`}
                      >
                        {INQUIRY_STATUS_LABEL[status]}
                      </span>
                      <span className="text-xs text-muted">
                        {INQUIRY_CATEGORY_LABEL[category] ?? category}
                      </span>
                      <time dateTime={inq.created_at} className="ml-auto text-xs text-muted">
                        {dateFmt.format(new Date(inq.created_at))}
                      </time>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-foreground">{inq.subject}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
                      {inq.body}
                    </p>
                    {inq.admin_reply && (
                      <div className="mt-3 rounded-xl bg-surface-2 p-3">
                        <p className="text-xs font-bold text-accent">운영자 답변</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
                          {inq.admin_reply}
                        </p>
                        {inq.replied_at && (
                          <time
                            dateTime={inq.replied_at}
                            className="mt-1.5 block text-right text-xs text-muted"
                          >
                            {dateFmt.format(new Date(inq.replied_at))}
                          </time>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
