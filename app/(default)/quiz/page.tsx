import type { Metadata } from "next";
import { QuizApp } from "@/components/quiz-app";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";

/**
 * /quiz — 밈력고사. 문서는 완전 정적 셸(○)이고 문항은 시작 시
 * /api/quiz에서 클라이언트가 가져온다(매번 새 출제). 쿠키/헤더 읽기 금지.
 */

const TITLE = "밈력고사 — 내 밈력은 몇 점?";
const DESCRIPTION =
  "밈캐치 사전 4,000여 개 밈에서 매번 새로 출제되는 10문항 밈 지식 퀴즈. 요즘 밈·추억 밈 모드로 풀고, 등급과 나의 밈 감성 연대까지 확인해 보세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/quiz" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 공유 유입 페이지라 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: TITLE,
    description: DESCRIPTION,
    url: "/quiz",
    images: [ogDefaultImageDescriptor("ko")],
  },
};

export default function QuizPage() {
  return (
    <main className="ink-grid mx-auto max-w-site px-4 pb-14 pt-8">
      <h1 className="page-title">밈력고사, 내 밈력은 몇 점?</h1>
      <p className="page-lede">
        밈 사전 데이터로 자동 출제되는 밈 지식 퀴즈예요. 제목만 보고 진짜 뜻을
        맞혀 보세요.
      </p>
      <QuizApp />
    </main>
  );
}
