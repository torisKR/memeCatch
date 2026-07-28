import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

const ABOUT_DESCRIPTION =
  "밈캐치는 한국 밈·유행어 3,000여 건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전입니다. 콘텐츠 검수 원칙과 운영 방침을 소개합니다.";

export const metadata: Metadata = {
  title: "소개",
  description: ABOUT_DESCRIPTION,
  alternates: { canonical: "/about" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "소개",
    description: ABOUT_DESCRIPTION,
    url: "/about",
  },
};

/** 소개 — 운영 주체·검수 프로세스·콘텐츠 원칙 (E-E-A-T 신뢰 문서) */
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">밈캐치 소개</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          밈캐치는 한국 밈·유행어·챌린지의 <strong className="text-foreground">뜻·유래·지금 써도
          되는지</strong>를 한 번에 알려주는 실시간 밈 사전입니다. 1990년대부터
          오늘까지 3,000여 건의 밈을 기록하고 있습니다.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-bold">왜 만들었나</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈의 뜻을 알려주는 곳은 이미 많습니다. 정작 아쉬웠던 건 뜻을 알고
            난 다음이었습니다. 뜻을 알아도 &ldquo;이걸 회사 단톡방에서 써도
            되나&rdquo;는 여전히 알 수 없었고, 유행이 지난 줄 모르고 썼다가
            분위기가 식는 일도 흔했습니다. 밈은 뜻보다 <strong>쓸 자리</strong>
            에서 사고가 납니다. 밈캐치는 그 지점에 답하려고 만든 사전입니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">다른 밈 위키와 무엇이 다른가요</h2>
          <p className="mt-3 text-base leading-relaxed">
            기존 밈 위키는 대체로 &ldquo;이 밈이 무엇인가&rdquo;를 설명하는 데서
            멈춥니다. 밈캐치는 거기에 <strong>지금 써도 되는지에 대한 판단</strong>
            을 근거와 함께 붙입니다.
          </p>
          <ul className="mt-4 space-y-3 text-base leading-relaxed">
            <li>
              <strong>🚦 사용 안전 신호등</strong> — 밈마다 &ldquo;써도 됨 / 맥락
              주의 / 이미 늦음 / 쓰면 위험&rdquo;을 표시합니다. 직장·친구·가족·SNS
              상황별 가이드도 함께 제공합니다. 등급만 던지지 않고 상세의
              &lsquo;이 판정의 근거&rsquo;에서 왜 그렇게 판정했는지를 밝히며,
              어떤 기준으로 등급을 나누는지는{" "}
              <Link href="/editorial" className="text-accent-text underline underline-offset-2">
                편집 원칙
              </Link>
              에 공개해 두었습니다.
            </li>
            <li>
              <strong>🔥 밈 생명 게이지</strong> — 급상승부터 추억 밈까지, 밈의
              생애주기를 실시간 조회 데이터 기반으로 보여줍니다. &ldquo;아직
              뜨거운 밈인지, 이미 식은 밈인지&rdquo;를 감이 아니라 추이로
              확인할 수 있습니다.
            </li>
            <li>
              <strong>출처 중심</strong> — 원본 영상·이미지를 무단 저장하지 않고
              유튜브 임베드·출처 링크로만 연결합니다. 공개한 뒤에도 링크가
              살아 있는지 주기적으로 확인해, 원저작자가 내린 영상은 저희
              화면에서도 자동으로 내려갑니다.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">콘텐츠는 이렇게 검수됩니다</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-relaxed">
            <li>
              <strong>제보 접수</strong> — 누구나{" "}
              <Link href="/submit" className="text-accent-text underline underline-offset-2">
                밈 제보
              </Link>
              로 새 밈을 알려줄 수 있습니다.
            </li>
            <li>
              <strong>사실 확인</strong> — 유래·연도·의미를 복수 출처로
              교차 확인합니다. 확인되지 않는 항목은 공개하지 않습니다.
            </li>
            <li>
              <strong>저작권 확인</strong> — 임베드·링크가 원저작자 권리를
              침해하지 않는지 확인합니다.
            </li>
            <li>
              <strong>공개 및 갱신</strong> — 공개 후에도 유행 상태와 사용
              안전도를 계속 갱신합니다. 제보는 보통 24~48시간 안에 등록 여부를
              회신하며, 유래 확인에 자료가 더 필요하면 사흘까지 걸릴 수
              있습니다.
            </li>
          </ol>
          <p className="mt-4 text-base leading-relaxed">
            어떤 밈을 수록하고 무엇을 수록하지 않는지, 사용 안전 등급을 어떤
            근거로 매기는지, 출처의 권리를 어떻게 확인하는지는{" "}
            <Link href="/editorial" className="text-accent-text underline underline-offset-2">
              편집 원칙
            </Link>
            에 전부 공개해 두었습니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">누가 만드나요</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈캐치는 온라인 커뮤니티와 인터넷 방송 문화를 오래 지켜본 개인
            개발자(<strong>toris-dev</strong>)가 기획·개발·편집을 모두 맡아
            운영합니다. 편집을 맡는 팀이 따로 있지 않고, 수록 여부와 사용 안전
            등급 판정도 같은 사람이 직접 확인합니다. 회사가 아니라 1인이 만드는
            사전이라는 점을 먼저 밝히는 것이 맞다고 생각합니다. 코드는{" "}
            <a
              href="https://github.com/toris-dev/memeCatch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline underline-offset-2"
            >
              GitHub
            </a>
            에 공개되어 있습니다.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            운영비는 광고와 제휴 링크, 후원, 그리고 선택형 멤버십으로
            충당합니다. 광고주는 밈의 수록 여부나 안전 등급에 관여하지
            않습니다. 서비스가 도움이 됐다면{" "}
            <a
              href="https://fairy.hada.io/@toris-dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline underline-offset-2"
            >
              후원(Fairy)
            </a>
            으로 응원할 수 있습니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">문의·정정·삭제 요청</h2>
          <p className="mt-3 text-base leading-relaxed">
            틀린 내용이나 저작권 문제를 발견하셨다면 알려 주세요. 확인 후
            정정하거나 내립니다.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed">
            <li>
              <strong>이메일</strong>{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent-text underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              — 문의·제휴·저작권 삭제 요청. 로그인 없이 보낼 수 있습니다.
            </li>
            <li>
              <strong>
                <Link href="/support" className="text-accent-text underline underline-offset-2">
                  고객센터
                </Link>
              </strong>{" "}
              — 로그인 후 1:1 문의. 답변이 같은 화면에 기록돼 진행 상황을
              확인할 수 있습니다.
            </li>
            <li>
              <strong>
                <Link href="/submit" className="text-accent-text underline underline-offset-2">
                  밈 제보
                </Link>
              </strong>{" "}
              — 아직 없는 밈이나 빠진 정보 알려주기.
            </li>
          </ul>
          <p className="mt-4 text-base leading-relaxed">
            요청별 처리 방식은{" "}
            <Link href="/editorial" className="text-accent-text underline underline-offset-2">
              편집 원칙
            </Link>
            의 정정·삭제 항목에 정리해 두었습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
