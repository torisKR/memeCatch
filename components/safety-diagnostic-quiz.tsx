"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, RotateCcw, Sparkles, ShieldCheck } from "lucide-react";
import { SafetyBadge } from "@/components/safety-badge";
import type { SafetyLevel } from "@/lib/labels";

type QuizQuestion = {
  id: number;
  situation: string;
  targetMeme: string;
  memeHref: string;
  scenario: string;
  correctAnswerLevel: SafetyLevel;
  options: Array<{
    label: string;
    level: SafetyLevel;
    isCorrect: boolean;
  }>;
  explanation: string;
  safeAlternative: string;
};

const DIAGNOSTIC_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 1,
    situation: "💼 직장 슬랙 / 팀 메신저",
    targetMeme: "중꺾마 (중요한 건 꺾이지 않는 마음)",
    memeHref: "/memes/jkm2022k-jung-kkuk-ma",
    scenario: "월요일 아침, 신규 기능 배포 중 오류가 난 상황에서 팀 채널에 '중꺾마 정신으로 버그 잡겠습니다!'라고 올려도 될까요?",
    correctAnswerLevel: "green",
    options: [
      { label: "🟢 써도 됨: 팀원들의 사기를 북돋고 끈기를 표현하는 긍정적인 밈이다", level: "green", isCorrect: true },
      { label: "🟡 맥락 주의: 직장에서는 유행어 사용 자체가 사규 위반이다", level: "yellow", isCorrect: false },
      { label: "🔴 쓰면 위험: 버그를 희화화하는 것이므로 팀장에게 혼난다", level: "red", isCorrect: false },
    ],
    explanation: "‘중꺾마’는 현대 사회에서 공인된 대표적 극복 밈으로 사내 메신저나 팀 채널에서 유쾌한 도전 의지를 보여주는 데 널리 활용됩니다. 단, 대외 공문이나 엄격한 계약서 등 초격식 문서에는 ‘끝까지 완수하겠다’는 표현을 권장합니다.",
    safeAlternative: "초격식 문서 대체어: '굳은 의지로 해결하겠습니다'",
  },
  {
    id: 2,
    situation: "💼 사내 피드백 / 메신저 댓글",
    targetMeme: "너 뭐 돼?",
    memeHref: "/memes/nmd2022k-ne-mwo-dwae",
    scenario: "동료가 디자인 시안에 피드백을 주었을 때, 메신저에 '너 뭐 돼? ㅋㅋ'라고 답변을 달아도 될까요?",
    correctAnswerLevel: "red",
    options: [
      { label: "🟢 써도 됨: 예능 유행어이므로 분위기를 가볍게 풀어준다", level: "green", isCorrect: false },
      { label: "🟡 맥락 주의: 선배한테만 안 쓰면 동기끼리는 아무 문제 없다", level: "yellow", isCorrect: false },
      { label: "🔴 쓰면 위험: 상대방의 존재를 깎아내리는 공격적 표현으로 갈등을 유발한다", level: "red", isCorrect: true },
    ],
    explanation: "‘너 뭐 돼?’는 상대의 분수를 따져 묻는 날카로운 조롱형 밈입니다. 100% 장난을 허용하는 절친 사이가 아니라면 직장 내 괴롭힘 또는 인성 논란으로 직결될 수 있는 초고위험 어휘입니다.",
    safeAlternative: "안전 대체어: '피드백 주셔서 감사합니다. 말씀해 주신 부분 검토해 볼게요!'",
  },
  {
    id: 3,
    situation: "☕ 동료와의 커피챗 / 캐주얼 대화",
    targetMeme: "폼 미쳤다",
    memeHref: "/memes/fmc2022k-form-crazy",
    scenario: "동료가 멋진 발표 자료를 만들어왔을 때 '오늘 발표 폼 미쳤다!'라고 칭찬해도 될까요?",
    correctAnswerLevel: "green",
    options: [
      { label: "🟢 써도 됨: 뛰어난 성과와 센스를 기분 좋게 극찬하는 대중적 표현이다", level: "green", isCorrect: true },
      { label: "🟡 맥락 주의: 축구 선수에게만 써야 하는 전문 은어다", level: "yellow", isCorrect: false },
      { label: "🔴 쓰면 위험: 외모를 평가하는 실례가 될 수 있다", level: "red", isCorrect: false },
    ],
    explanation: "스포츠 은어에서 출발했으나 전 국민적인 ‘칭찬 감탄사’로 안착했습니다. 동료의 센스나 성과를 즉각적으로 치켜세울 때 무해하고 강력한 유대감을 형성합니다.",
    safeAlternative: "임원 보고용 대체어: '탁월한 완성도와 뛰어난 성과를 거두었습니다'",
  },
  {
    id: 4,
    situation: "🌧️ 돌발 상황 / 프로젝트 일정 지연",
    targetMeme: "오히려 좋아",
    memeHref: "/memes/oyj2021k-ohiryeo-joha",
    scenario: "오후 회의 일정이 갑자기 다음 주로 연기되었을 때, 팀원에게 '오히려 좋아! 다른 기획 다듬을 시간 벌었네'라고 말해도 될까요?",
    correctAnswerLevel: "green",
    options: [
      { label: "🟢 써도 됨: 악재를 긍정적 기회로 전환하는 건강한 멘탈케어 밈이다", level: "green", isCorrect: true },
      { label: "🟡 맥락 주의: 회의를 싫어하는 게 들통나므로 절대 비밀로 해야 한다", level: "yellow", isCorrect: false },
      { label: "🔴 쓰면 위험: 회의 취소를 비꼬는 블랙코미디로 읽힌다", level: "red", isCorrect: false },
    ],
    explanation: "‘오히려 좋아’는 불운을 기회로 바꾸는 대표적인 무해 밈입니다. 직장 내에서도 팀 분위기를 환기하고 스트레스를 덜어내는 긍정적 어휘로 평가받습니다.",
    safeAlternative: "격식 대체어: '충분한 검토 시간을 확보하여 완성도를 높이겠습니다'",
  },
  {
    id: 5,
    situation: "📧 대외 비즈니스 이메일",
    targetMeme: "디토 (Ditto 감성)",
    memeHref: "/memes/jkm2022k-jung-kkuk-ma",
    scenario: "협력사 담당자의 제안에 동의한다는 뜻으로 '보내주신 제안에 디토합니다'라고 회신 메일을 보내도 될까요?",
    correctAnswerLevel: "red",
    options: [
      { label: "🟢 써도 됨: 라틴어 어원이라 세련된 글로벌 비즈니스 용어다", level: "green", isCorrect: false },
      { label: "🟡 맥락 주의: 담당자가 뉴진스 팬인 경우에만 통한다", level: "yellow", isCorrect: false },
      { label: "🔴 쓰면 위험: 격식 있는 비즈니스 서신에서는 '동의합니다' 표준어 사용 필수", level: "red", isCorrect: true },
    ],
    explanation: "‘디토’는 라틴어 유래이지만 국내에서는 K-POP 유행어 및 감성 밈으로 소비됩니다. 대외 비즈니스 이메일에서는 신뢰도 하락의 원인이 될 수 있으므로 엄격히 ‘동의합니다’, ‘전적으로 공감합니다’를 사용해야 합니다.",
    safeAlternative: "비즈니스 표준어: '제안해 주신 방향에 적극 동의하며, 후속 절차를 진행하겠습니다'",
  },
];

export function SafetyDiagnosticQuiz() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQ = DIAGNOSTIC_QUESTIONS[currentIndex];

  function handleSelect(index: number) {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (currentQ.options[index].isCorrect) {
      setScore((prev) => prev + 20);
    }
  }

  function handleNext() {
    if (currentIndex + 1 < DIAGNOSTIC_QUESTIONS.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsCompleted(true);
    }
  }

  function handleReset() {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsCompleted(false);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
      {/* 장식용 배경 글로우 */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-safety-green/10 blur-3xl" />

      {/* 상단 헤더 */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-text">
            <ShieldCheck className="h-4 w-4" />
            밈캐치 실전 진단기
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
            직장·일상 밈 소통 안전도 자가진단
          </h3>
          <p className="mt-1 text-sm text-neutral-400">
            “이 상황에서 이 밈, 써도 될까?” 5가지 실제 상황을 통해 나의 밈 감각과 안전도를 테스트해 보세요.
          </p>
        </div>

        {!isCompleted && (
          <div className="flex items-center gap-2 font-mono text-sm font-semibold text-neutral-300">
            <span className="text-accent">{currentIndex + 1}</span>
            <span className="text-neutral-600">/</span>
            <span>{DIAGNOSTIC_QUESTIONS.length}</span>
          </div>
        )}
      </div>

      {!isCompleted ? (
        <div className="relative mt-6 space-y-6">
          {/* 상황 뱃지 및 문항 */}
          <div className="space-y-2">
            <div className="inline-block rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-neutral-300">
              {currentQ.situation}
            </div>
            <h4 className="text-lg font-bold leading-snug text-white sm:text-xl">
              {currentQ.scenario}
            </h4>
            <div className="flex items-center gap-2 pt-1 text-sm text-neutral-400">
              <span>판별 대상 밈:</span>
              <span className="font-semibold text-white underline decoration-accent/50 underline-offset-4">
                {currentQ.targetMeme}
              </span>
            </div>
          </div>

          {/* 선택지 목록 */}
          <div className="grid gap-3">
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              let btnClass = "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08] text-neutral-200";

              if (isAnswered) {
                if (option.isCorrect) {
                  btnClass = "border-safety-green/60 bg-safety-green/15 text-white font-semibold ring-1 ring-safety-green/50";
                } else if (isSelected && !option.isCorrect) {
                  btnClass = "border-safety-red/60 bg-safety-red/15 text-white font-semibold ring-1 ring-safety-red/50";
                } else {
                  btnClass = "opacity-40 border-white/5 bg-transparent text-neutral-500";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  disabled={isAnswered}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-left text-sm transition-all sm:text-base ${btnClass}`}
                >
                  <span className="flex-1 pr-3">{option.label}</span>
                  {isAnswered && (
                    <span className="shrink-0">
                      {option.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-safety-green" />
                      ) : isSelected ? (
                        <XCircle className="h-5 w-5 text-safety-red" />
                      ) : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 피드백 및 해설 영역 */}
          {isAnswered && (
            <div className="animate-in fade-in space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <SafetyBadge level={currentQ.correctAnswerLevel} />
                <span className="font-mono text-xs font-semibold text-neutral-400">
                  {currentQ.correctAnswerLevel === "green"
                    ? "안전 판정"
                    : currentQ.correctAnswerLevel === "yellow"
                    ? "맥락 가림 필요"
                    : "사용 위험 금지"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-neutral-200 sm:text-base">
                {currentQ.explanation}
              </p>
              <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-neutral-300">
                💡 <span className="font-semibold text-accent-text">{currentQ.safeAlternative}</span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {currentIndex + 1 < DIAGNOSTIC_QUESTIONS.length ? "다음 상황 진단하기" : "진단 결과 보기"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 최종 진단 결과 화면 */
        <div className="relative mt-8 space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-accent/40 bg-accent/20">
            <Sparkles className="h-10 w-10 text-accent" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              진단 완료 · 나의 밈 소통 지수
            </p>
            <h4 className="text-3xl font-black text-white sm:text-4xl">
              {score}점 / 100점
            </h4>
            <p className="text-base text-neutral-300">
              {score >= 80
                ? "🎉 축하합니다! 직장과 일상에서 TPO를 완벽히 가려 쓰는 센스 만점 소통가입니다."
                : score >= 60
                ? "👍 훌륭해요! 대부분의 밈 맥락을 잘 파악하고 있으나 비즈니스 서신에서는 조금 더 보수적인 표현이 안전합니다."
                : "⚠️ 주의가 필요해요! 친밀하지 않은 관계나 공식 채널에서 밈을 썼다가 오해를 살 수 있으니 밈캐치 안전 신호를 꼭 확인해 보세요."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" />
              다시 진단하기
            </button>
            <Link
              href="/explore?sort=recent"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              검증된 밈 사전 탐색하기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
