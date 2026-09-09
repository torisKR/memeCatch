import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "밈캐치 개인정보처리방침 — 수집 항목, 이용 목적, 보관 기간, 이용자 권리.",
  alternates: { canonical: "/privacy" },
  robots: { index: true },
};

const EFFECTIVE = "2026년 8월 18일";

/** 개인정보처리방침 — 정보통신망법·개인정보보호법 기준 최소 필수 고지 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-muted">시행일: {EFFECTIVE}</p>

      <div className="prose-sm mt-8 max-w-3xl space-y-8 text-base leading-relaxed">
        <section>
          <h2 className="text-xl font-bold">1. 수집하는 개인정보와 방법</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              <strong>회원가입(카카오·구글 소셜 로그인)</strong>: 이메일 주소,
              소셜 계정 식별자, 닉네임 — 이용자가 로그인 시 직접 제공
            </li>
            <li>
              <strong>회원가입(TikTok 로그인)</strong>: TikTok 앱 전용 계정
              식별자(open_id), 표시 이름, 프로필 사진 — 로그인 시 TikTok에서
              제공받습니다. 계정 식별자는 일방향 변환한 값만 저장하며 TikTok
              계정의 이메일 주소는 제공받지 않습니다.
            </li>
            <li>
              <strong>TikTok 공개 영상 가져오기(선택)</strong>: 공개 영상
              ID·제목·설명·공유 URL — 이용자가 video.list 권한을 허용한 경우
              최신 공개 영상 최대 20개를 검수 대기 제보로 저장합니다. 로그인과
              영상 가져오기에 사용하는 TikTok 액세스 토큰은 요청 처리 중에만
              사용하고 저장하지 않습니다.
            </li>
            <li>
              <strong>서비스 이용 중 생성</strong>: 제보·댓글·좋아요·저장 활동
              기록, 관심 카테고리, 가명 세션 식별자와 조회·공유·퀴즈·유입 이벤트
            </li>
            <li>
              <strong>MemeCatch Plus 구매</strong>: MemeCatch 계정 식별자, Unifi Pay
              결제 링크·주문·거래 식별자, 결제 상태·금액·통화·발생 시각 — Unifi
              Pay의 결제 알림을 받은 뒤 서버 간 거래 조회로 확인합니다. Fairy 후원으로
              Plus를 받는 경우 후원 결제 식별자, 후원 금액, 계정 연결용 의도 식별자를
              확인합니다. 지갑 비밀키 등 결제수단 인증정보는 서비스가 직접 수집하거나
              저장하지 않습니다.
            </li>
            <li>
              <strong>자동 수집</strong>: 접속 로그, 쿠키(로그인 세션 유지
              목적) — 서비스 인프라(Vercel)와 인증(Supabase Auth)이 처리
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">2. 이용 목적</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>회원 식별·로그인 상태 유지</li>
            <li>이용자가 선택한 TikTok 공개 영상을 검수 대기 제보로 가져오기</li>
            <li>제보 검수·커뮤니티 운영·부정 이용 방지</li>
            <li>저장한 밈·관심 카테고리 등 개인화 기능 제공</li>
            <li>유료 멤버십 구매 확인·권한 제공·취소 및 환불 문의 처리</li>
            <li>밈 유행 지표 집계(익명화된 통계 목적)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">3. 보관 기간 및 파기</h2>
          <p className="mt-3">
            회원 탈퇴 시 개인정보는 지체 없이 파기합니다. 다만 관계 법령에 따라
            보존이 필요한 기록(예: 접속 로그 3개월, 통신비밀보호법)은 해당 기간
            동안 보관 후 파기합니다. 탈퇴 후 제보·댓글은 작성자 정보가 분리된
            상태로 남거나 삭제됩니다. 결제·취소·환불 기록은 관계 법령상 보존
            의무가 있는 경우 해당 기간 동안 분리 보관한 뒤 파기합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">
            4. 처리 위탁·외부 서비스 및 국외 이전
          </h2>
          <p className="mt-3">
            서비스 운영을 위해 아래 업체에 개인정보 처리를 위탁하거나 외부
            서비스를 이용하며, 데이터는 해당 서비스의 해외 리전에서 처리될 수
            있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li><strong>Supabase</strong> — 데이터베이스·인증·저장소</li>
            <li><strong>Vercel</strong> — 웹 호스팅·접속 로그</li>
            <li><strong>Cloudflare</strong> — 이미지 저장소(R2)</li>
            <li>
              <strong>TikTok</strong> — 소셜 로그인 인증과 이용자가 선택한 공개
              영상 목록 제공. 사용자가 허용한 TikTok 계정·영상 정보만 암호화된
              통신으로 제공받으며, 액세스 토큰은 저장하지 않습니다.
            </li>
            <li>
              <strong>Unifi Pay</strong> — 신규 MemeCatch Plus 30일 이용권의 결제
              링크 제공, 스테이블코인 결제 처리 및 거래 상태 확인. 결제 요청 시
              계정 식별자 일부에서 만든 가명 요청 식별자, 상품·금액·통화, 복귀·알림
              주소를 암호화된 통신으로 전달하며, 거래 식별자·상태·통화·시각은 결제
              확인과 법정 보존 기간 동안 보관합니다.
            </li>
            <li>
              <strong>Fairy</strong> — 한국에서 카드·간편결제로 MemeCatch Plus 30일
              이용권을 후원하는 경로. 계정 연결용 의도 식별자와 결제 식별자·금액을
              암호화된 통신으로 확인하며, 알림은 catchmeme.com의 Fairy 웹훅으로
              수신합니다. 결제수단 정보는 서비스가 직접 수집하지 않습니다.
            </li>
            <li>
              <strong>Latpeed</strong> — 기존 구매자의 주문·취소·환불 기록 보존과
              권한 및 고객 문의 처리. 신규 Plus 결제에는 사용하지 않습니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">5. 이용자의 권리</h2>
          <p className="mt-3">
            이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할
            수 있습니다. MY 페이지에서 닉네임 변경이 가능하며, 탈퇴·기타 요청은
            아래 문의처로 연락 주시면 지체 없이 처리합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold">6. 쿠키 및 광고</h2>
          <p className="mt-3">
            로그인 세션 유지를 위한 필수 쿠키를 사용합니다. 브라우저 설정에서
            쿠키를 거부할 수 있으나 로그인 기능이 제한될 수 있습니다.
          </p>
          <p className="mt-3">
            본 서비스는 이용 통계 분석을 위해 <strong>Google 애널리틱스</strong>를
            사용합니다. 수집되는 정보는 익명화된 이용 행태(방문 페이지, 유입
            경로, 기기 유형, 문서 내 출처 링크·정정 제보 링크 클릭 — 문서 ID와
            플랫폼명만 기록하며 개인을 식별할 수 있는 정보는 포함하지 않습니다)이며
            개인을 식별하지 않습니다.
          </p>
          <p className="mt-3">
            본 서비스는 광고 게재를 위해 <strong>Google AdSense</strong>를
            사용할 수 있습니다. Google을 포함한 제3자 광고 사업자는 쿠키를
            사용해 이용자의 이전 방문 기록을 기반으로 광고를 게재하며, Google의
            광고 쿠키 사용으로 이용자에게 맞춤형 광고가 표시될 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              이용자는{" "}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline underline-offset-2"
              >
                Google 광고 설정
              </a>
              에서 맞춤 광고를 해제할 수 있습니다.
            </li>
            <li>
              제3자 광고 사업자의 쿠키 사용은{" "}
              <a
                href="https://policies.google.com/technologies/ads?hl=ko"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline underline-offset-2"
              >
                Google 광고 정책
              </a>
              을 참고하세요.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold">7. 개인정보 보호책임자 및 문의</h2>
          <p className="mt-3">
            개인정보 보호책임자: 밈캐치 운영자
            <br />
            문의:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-accent-text underline underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="mt-3 text-sm text-muted">
            본 방침이 변경되는 경우 시행 7일 전 사이트 공지로 알립니다.
          </p>
        </section>
      </div>
    </main>
  );
}
