import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

const DESCRIPTION =
  "밈캐치 문의 이메일입니다. 콘텐츠 정정, 저작권, 제휴 문의를 받으며 보통 24~48시간 안에 답변드립니다.";

export const metadata: Metadata = {
  title: "문의",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "문의",
    description: DESCRIPTION,
    url: "/contact",
  },
};

/** Public contact page. The address and reply window are already published on the site. */
export default function ContactPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">문의</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          콘텐츠 정정, 저작권 삭제, 제휴 문의는 이메일로 보내 주세요.
        </p>
        <p className="mt-6 text-base leading-relaxed">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-accent-text underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-4 text-base leading-relaxed">보통 24~48시간 안에 답변드려요.</p>
      </div>
    </main>
  );
}
