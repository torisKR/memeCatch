import type { Metadata } from "next";
import Link from "next/link";
import { koreanPageShare } from "@/lib/korean-share-metadata";
import { CONTACT_EMAIL } from "@/lib/site";

const DESCRIPTION =
  "밈캐치 문의 이메일입니다. 콘텐츠 정정, 저작권, 제휴 문의를 받으며 보통 24~48시간 안에 답변드립니다.";

export const metadata: Metadata = {
  title: "문의",
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  ...koreanPageShare({ title: "문의", description: DESCRIPTION, pathname: "/contact" }),
};

const LINK = "text-accent-text underline underline-offset-2";

/**
 * Public contact page. The address and reply window are already published on
 * the site; this page explains what each kind of request needs and where it
 * goes, so a reader (or a reviewer) can see how the site is run.
 */
export default function ContactPage() {
  return (
    <main className="mx-auto max-w-site px-4 pb-16 pt-10">
      <div className="max-w-3xl">
        <h1 className="page-title">문의</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          콘텐츠 정정, 저작권 삭제, 제휴 문의는 이메일로 보내 주세요.
        </p>
        <p className="mt-6 text-base leading-relaxed">
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-4 text-base leading-relaxed">보통 24~48시간 안에 답변드려요.</p>

        <section className="mt-10">
          <h2 className="text-xl font-bold">문의 종류별로 보내 주실 내용</h2>
          <dl className="mt-4 space-y-5 text-base leading-relaxed">
            <div>
              <dt className="font-bold">뜻·유래가 틀렸을 때</dt>
              <dd className="mt-1 text-muted">
                밈 문서 주소와 틀린 부분, 그리고 근거가 되는 링크를 함께 보내 주세요.
                출처나 실제 쓰인 예문은 각 밈 문서의 「이 문서에 출처·예문 보태기」로
                바로 보내셔도 됩니다. 운영자가 출처를 확인한 뒤 고치고, 고친 날짜를
                문서에 남깁니다.
              </dd>
            </div>
            <div>
              <dt className="font-bold">저작권·초상권 삭제 요청</dt>
              <dd className="mt-1 text-muted">
                밈캐치는 영상과 이미지를 저장하지 않고 원래 플랫폼의 링크와 임베드만
                보여 줍니다. 권리자이시거나 본인이 나온 영상이라면 해당 문서 주소와
                내릴 링크를 알려 주세요. 확인되면 링크와 임베드를 내리고 결과를
                답장으로 알려 드립니다.
              </dd>
            </div>
            <div>
              <dt className="font-bold">개인정보</dt>
              <dd className="mt-1 text-muted">
                계정 삭제나 수집 정보 확인은{" "}
                <Link href="/privacy" className={LINK}>
                  개인정보처리방침
                </Link>
                의 절차를 따릅니다. 같은 주소로 보내 주시면 됩니다.
              </dd>
            </div>
            <div>
              <dt className="font-bold">제휴·광고</dt>
              <dd className="mt-1 text-muted">
                회사나 단체 이름, 제안 내용, 원하는 일정을 적어 주세요. 사용 안전
                신호등과 문서 내용은 제휴와 관계없이 편집 원칙에 따라 정합니다.
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">로그인했다면</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            버그 신고나 건의는{" "}
            <Link href="/support" className={LINK}>
              고객센터
            </Link>
            에 남기면 답변이 같은 화면에 표시돼 진행 상황을 확인할 수 있어요.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">누가 답하나요</h2>
          <p className="mt-3 text-base leading-relaxed text-muted">
            밈캐치는 1인이 기획·개발·편집을 맡아 운영합니다. 모든 문의는 운영자가
            직접 읽고 답합니다. 운영 방식과 수록 기준은{" "}
            <Link href="/about" className={LINK}>
              소개
            </Link>
            와{" "}
            <Link href="/editorial" className={LINK}>
              편집 원칙
            </Link>
            에 공개해 두었습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
