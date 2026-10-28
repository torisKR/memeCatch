import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "이용약관",
  description: "밈캐치 서비스 이용약관 — 서비스 내용, 회원의 의무, 콘텐츠 권리, 책임 제한.",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE = "2026년 8월 18일";

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
            <li>소셜 로그인(카카오·구글·TikTok) 또는 이메일로 가입할 수 있습니다.</li>
            <li>회원은 언제든지 탈퇴할 수 있으며, 탈퇴 처리는 문의처를 통해 요청할 수 있습니다.</li>
            <li>타인의 계정 도용, 부정 이용 시 이용이 제한될 수 있습니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">제3조 (MemeCatch Plus)</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              Plus는 관심사 맞춤 트렌드 피드와 무제한 저장 기능을 제공하는
              <strong> 30일 이용권</strong>입니다. Unifi Pay에서는
              <strong> 10 USDT 상당</strong>으로 결제하고, 한국에서는 Fairy 후원
              (카드·간편결제)으로도 같은 기간의 Plus를 받을 수 있습니다. 실제
              주문 금액과 제공 기능은 구매 화면에 표시합니다.
            </li>
            <li>
              <strong>자동 갱신되지 않습니다.</strong> 결제 1회당 30일 이용
              기간이 부여되며, 기간이 끝나면 별도 해지 절차 없이 Plus 기능이
              종료됩니다. 계속 이용하려면 만료 전후에 다시 결제해야 하며, 남은
              기간이 있으면 그 뒤에 30일이 이어서 부여됩니다.
              정기 결제를 위한 결제수단 정보는 보관하지 않습니다.
            </li>
            <li>
              결제는 Unifi Pay에서 Kaia 네트워크의 USDT로 처리하거나, 한국
              이용자는 Fairy 후원(카드·간편결제)으로 30일 Plus를 받을 수
              있습니다. Unifi 결제는 서버에서 거래 상태·상점·금액·통화를 확인한
              뒤, Fairy 후원은 연결된 계정과 최소 금액을 확인한 뒤 결제를 시작한
              MemeCatch 계정에 이용 기간이 연결됩니다. 결제창 복귀만으로 권한이
              생기지 않습니다.
            </li>
            <li>
              <strong>환불</strong>은 결제 대행사 정책상 자동 처리가 지원되지
              않아, 회사가 콘솔에서 수동으로 진행합니다. 아래 문의처 또는
              고객센터로 결제 일시와 계정을 알려 주시면 관계 법령과 결제 대행사
              정책에 따라 검토 후 처리합니다. 블록체인 전송 특성상 환불에는
              영업일 기준 며칠이 걸릴 수 있습니다.
            </li>
            <li>
              결제 확인이 지연되면 Plus 권한 연결에 시간이 걸릴 수 있으며,
              결제 내역 확인 후 지원합니다.
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

        <section className="rounded-2xl border border-border bg-surface-2 p-5">
          <h2 className="text-xl font-bold">
            YouTube API 서비스 보충 안내 (2026년 10월 14일)
          </h2>
          <p className="mt-3">
            서비스의 YouTube 출처 확인·공식 플레이어 기능은 YouTube API
            Services(YouTube API 서비스)를 사용합니다. 해당 기능을 이용하면{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline underline-offset-2"
            >
              YouTube 이용약관
            </a>
            에도 동의하는 것으로 봅니다. YouTube 콘텐츠와 플레이어에는 YouTube의
            정책과 권리 관계가 적용되며, 공개 영상 후보는 운영자 검수 전에는 밈
            문서나 트렌드 순위에 자동 공개되지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">제7조 (문의 및 분쟁)</h2>
          <p className="mt-3">
            약관·저작권·정정 요청 문의:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-accent-text underline underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
            <br />
            본 약관은 대한민국 법률에 따르며, 변경 시 시행 7일 전 공지합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
