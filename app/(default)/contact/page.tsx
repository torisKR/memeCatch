import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

const CONTACT_DESCRIPTION =
  "밈캐치 운영자 toris에게 문의하거나 게시물 삭제를 요청하는 페이지입니다. 로그인 없이 이메일로 연락할 수 있습니다.";

export const metadata: Metadata = {
  title: "문의",
  description: CONTACT_DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "문의",
    description: CONTACT_DESCRIPTION,
    url: "/contact",
  },
};

const DELETION_MAIL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("밈캐치 삭제 요청")}`;

/** Login-free contact. Removal requests go to the same operator inbox. */
export default function ContactPage() {
  return (
    <main className="mx-auto max-w-[680px] px-4 pb-16 pt-10 text-foreground">
      <h1 className="text-3xl font-extrabold tracking-tight">문의</h1>
      <p className="mt-3 text-[17px] leading-[1.75] text-muted">
        밈캐치는 toris가 운영합니다. 로그인하지 않아도 이메일로 연락할 수 있어요.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold">이메일</h2>
        <p className="mt-3 text-[17px] leading-[1.75]">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">삭제 요청</h2>
        <p className="mt-3 text-[17px] leading-[1.75]">
          게시된 밈, 계정, 또는 개인정보가 담긴 내용을 내려 달라고 요청할 수 있어요.
          대상 주소와 요청 이유를 적어 보내 주세요.
        </p>
        <p className="mt-3">
          <a
            href={DELETION_MAIL}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            삭제 요청 메일 보내기
          </a>
        </p>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/editorial" className="underline underline-offset-4">
          편집 방침
        </Link>
        <span aria-hidden className="mx-2">·</span>
        <Link href="/privacy" className="underline underline-offset-4">
          개인정보처리방침
        </Link>
      </p>
    </main>
  );
}
