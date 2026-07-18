import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "밈캐치 서비스 이용약관 — 서비스 내용, 회원의 의무, 콘텐츠 권리, 책임 제한.",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE = "2026년 7월 18일";

/** 이용약관 — 커뮤니티·제보 서비스 기준 최소 필수 조항 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight">이용약관</h1>
      <p className="mt-2 text-sm text-muted">시행일: {EFFECTIVE}</p>

      <div className="mt-8 max-w-3xl space-y-8 text-base leading-relaxed">
        <section>
          <h2 className="text-xl font-bold">제1조 (목적과 서비스)</h2>
          <p className="mt-3">
            본 약관은 밈캐치(이하 &ldquo;서비스&rdquo;)의 이용 조건을 정합니다.
            서비스는 한국 밈·유행어의 뜻·유래·사용 정보를 제공하는 사전과,
            회원이 참여하는 제보·커뮤니티 기능, 선택형 유료 멤버십
            MemeCatch Plus로 구성됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">제2조 (회원)</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>소셜 로그인(카카오·구글) 또는 이메일로 가입할 수 있습니다.</li>
            <li>회원은 언제든지 탈퇴할 수 있으며, 탈퇴 처리는 문의처를 통해 요청할 수 있습니다.</li>
            <li>타인의 계정 도용, 부정 이용 시 이용이 제한될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">제3조 (MemeCatch Plus)</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              Plus는 관심사 맞춤 트렌드 피드와 무제한 저장 기능을 제공하는 월간
              유료 멤버십입니다. 가격과 제공 기능은 구매 화면에 표시합니다.
            </li>
            <li>
              결제는 Latpeed에서 처리되며, 자동 권한 연결을 위해 MemeCatch
              계정과 같은 이메일로 구매해야 합니다.
            </li>
            <li>
              취소·환불은 Latpeed 구매 조건과 관계 법령에 따르며, 직접 처리가
              어려운 경우 서비스 문의처로 요청할 수 있습니다.
            </li>
            <li>
              결제 확인이 지연되거나 이메일이 일치하지 않으면 Plus 권한 연결에
              시간이 걸릴 수 있으며, 구매 내역 확인 후 지원합니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">제4조 (회원이 올린 콘텐츠)</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>제보·댓글·게시글의 저작권은 작성자에게 있습니다.</li>
            <li>
              작성자는 서비스가 해당 콘텐츠를 사전 편찬·노출·홍보 목적으로
              사용(편집·요약 포함)하는 것을 허락합니다.
            </li>
            <li>
              타인의 권리를 침해하거나 혐오·비하·불법 정보를 포함한 콘텐츠는
              사전 통지 없이 숨김·삭제될 수 있습니다.
            </li>
            <li>제보는 운영자 검수를 거쳐 게시 여부가 결정되며, 게시를 보장하지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">제5조 (금지 행위)</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>허위 정보의 고의 유포, 스팸·광고성 게시</li>
            <li>자동화 수단을 통한 대량 수집(공개 API·피드 제외)·서비스 방해</li>
            <li>타인의 개인정보 게시, 명예훼손, 저작권 침해</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">제6조 (책임의 제한)</h2>
          <p className="mt-3">
            서비스의 밈 정보(뜻·유래·사용 안전도)는 검수를 거치지만 완전성을
            보장하지 않는 참고 정보입니다. 밈 사용으로 발생한 결과, 외부 링크
            콘텐츠, 천재지변·인프라 장애로 인한 중단에 대해 서비스는 고의·중과실이
            없는 한 책임지지 않습니다. 무료로 제공되는 서비스의 내용은 사전
            공지 후 변경·중단될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">제7조 (문의 및 분쟁)</h2>
          <p className="mt-3">
            약관·저작권·정정 요청 문의:{" "}
            <a
              href="mailto:ironjustlikethat@gmail.com"
              className="text-accent-text underline underline-offset-2"
            >
              ironjustlikethat@gmail.com
            </a>
            <br />
            본 약관은 대한민국 법률에 따르며, 변경 시 시행 7일 전 공지합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
