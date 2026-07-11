import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "소개",
  description:
    "밈캐치는 한국 밈·유행어 3,000여 건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전입니다. 콘텐츠 검수 원칙과 운영 방침을 소개합니다.",
  alternates: { canonical: "/about" },
};

/** 소개 — 운영 주체·검수 프로세스·콘텐츠 원칙 (E-E-A-T 신뢰 문서) */
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight">밈캐치 소개</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        밈캐치는 한국 밈·유행어·챌린지의 <strong className="text-foreground">뜻·유래·지금 써도
        되는지</strong>를 한 번에 알려주는 실시간 밈 사전입니다. 1990년대부터
        오늘까지 3,000여 건의 밈을 기록하고 있습니다.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold">무엇이 다른가요</h2>
        <ul className="mt-3 space-y-3 text-base leading-relaxed">
          <li>
            <strong>🚦 사용 안전 신호등</strong> — 밈마다 &ldquo;써도 됨 / 맥락
            주의 / 이미 늦음 / 쓰면 위험&rdquo;을 표시합니다. 직장·친구·가족·SNS
            상황별 가이드도 함께 제공합니다.
          </li>
          <li>
            <strong>🔥 밈 생명 게이지</strong> — 급상승부터 추억 밈까지, 밈의
            생애주기를 실시간 조회 데이터 기반으로 보여줍니다.
          </li>
          <li>
            <strong>출처 중심</strong> — 원본 영상·이미지를 무단 저장하지 않고
            유튜브 임베드·출처 링크로만 연결합니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">콘텐츠는 이렇게 검수됩니다</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-base leading-relaxed">
          <li>
            <strong>제보 접수</strong> — 누구나{" "}
            <Link href="/submit" className="text-accent underline underline-offset-2">
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
            안전도를 계속 갱신합니다. 통상 검수에는 1~3일이 걸립니다.
          </li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">콘텐츠 정책</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed">
          <li>혐오·비하 소지가 있는 밈은 기록하되 &ldquo;쓰면 위험&rdquo; 신호와 함께 추천에서 제외합니다.</li>
          <li>출처가 소실된 밈은 뜻과 맥락만 보존하고 원본을 임의 복제하지 않습니다.</li>
          <li>잘못된 정보나 저작권 문제 발견 시 아래 문의처로 알려주시면 확인 후 정정·삭제합니다.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">큐레이션 기준</h2>
        <p className="mt-3 text-base leading-relaxed">
          모든 항목은 같은 기준으로 기록합니다 — <strong>정의는 한 문장으로
          독립적으로 이해될 것</strong>, 유래는 최초 발생 시점·발원지를 특정할
          것, 사용 안전도는 실제 커뮤니티에서의 쓰임(비하 맥락 여부, 세대 간
          수용도)을 근거로 판정할 것. 확인되지 않는 유래는 &ldquo;~로
          알려짐&rdquo;으로 표기하고 단정하지 않습니다.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">운영 및 문의</h2>
        <p className="mt-3 text-base leading-relaxed">
          밈캐치는 온라인 커뮤니티와 인터넷 방송 문화를 오래 지켜본 개인
          개발자가 만들고 운영하는 비영리적 프로젝트이며 광고·후원으로
          유지됩니다. 서비스가 도움이 됐다면{" "}
          <a
            href="https://fairy.hada.io/@toris-dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            후원(Fairy)
          </a>
          으로 응원할 수 있습니다. 문의·제휴·삭제 요청:{" "}
          <a
            href="mailto:ironjustlikethat@gmail.com"
            className="text-accent underline underline-offset-2"
          >
            ironjustlikethat@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
