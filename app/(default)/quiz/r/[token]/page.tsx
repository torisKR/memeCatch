import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizApp } from "@/components/quiz-app";
import {
  decodeQuizShareToken,
  QUIZ_MODE_LABEL,
  quizResultOgPath,
  QUIZ_OG_SIZE,
  quizResultPath,
} from "@/lib/quiz-share";

/**
 * /quiz/r/{token} — 밈력고사 결과 공유 링크.
 * 토큰에 모드·정오 패턴·문제 세트(short_id)가 담겨 있어 DB 없이 렌더한다.
 * 받은 사람은 "내 점수 이겨보기"로 같은 문제 세트를 풀 수 있다.
 * 개인 결과 페이지라 검색 색인은 막고 미리보기(OG)만 결과별로 만든다.
 */

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = decodeQuizShareToken(token);
  if (!result) return { title: "결과를 찾을 수 없어요", robots: { index: false } };
  const title = `밈력고사 ${result.score}/${result.total}점 · ${result.grade.label}`;
  const description = `친구의 밈력은 ${result.score}점! 같은 ${result.total}문항(${QUIZ_MODE_LABEL[result.mode]} 모드)으로 내 점수 이겨보기.`;
  const path = quizResultPath(result.token);
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title,
      description,
      url: path,
      images: [
        {
          url: quizResultOgPath(result.token),
          ...QUIZ_OG_SIZE,
          alt: `밈력고사 결과 ${result.score}/${result.total}점, ${result.grade.label}`,
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function QuizResultPage({ params }: PageProps) {
  const { token } = await params;
  const result = decodeQuizShareToken(token);
  if (!result) notFound();

  return (
    <main className="ink-grid mx-auto max-w-5xl px-4 pb-14 pt-8">
      <p className="text-sm font-semibold text-accent-strong">밈력고사</p>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
        친구의 밈력은 {result.score}점!
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        같은 문제를 풀고 누가 더 밈잘알인지 겨뤄 보세요.
      </p>
      <QuizApp
        challenge={{
          mode: result.mode,
          shortIds: result.shortIds,
          correct: result.correct,
          score: result.score,
          total: result.total,
          gradeLabel: result.grade.label,
          gradeComment: result.grade.comment,
        }}
      />
    </main>
  );
}
