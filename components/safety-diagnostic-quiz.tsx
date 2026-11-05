"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { SafetyBadge } from "@/components/safety-badge";
import { CopyTextButton } from "@/components/copy-text-button";
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
    safeAlternative: "굳은 의지로 해결하겠습니다",
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
    safeAlternative: "피드백 주셔서 감사합니다. 말씀해 주신 부분 검토해 볼게요!",
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
    safeAlternative: "탁월한 완성도와 뛰어난 성과를 거두었습니다",
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
      { label: "🔴 쓰면 위험: 회의 연기를 방조하는 불성실한 태도로 오해받는다", level: "red", isCorrect: false },
    ],
    explanation: "‘오히려 좋아’는 불리한 국면을 유쾌하게 전환해 팀의 스트레스를 덜어주는 무해한 회복 탄력성 밈입니다. 일정 차질에 대해 팀 분위기가 가라앉지 않도록 하는 데 효과적입니다.",
    safeAlternative: "추가 확보된 시간 동안 완성도를 더욱 끌어올려 보겠습니다",
  },
  {
    id: 5,
    situation: "🏢 전체 공지 / 타 부서 협업 요청",
    targetMeme: "누칼협 (누가 칼 들고 협박함?)",
    memeHref: "/memes/nkh2021k-nu-kal-hyeop",
    scenario: "타 부서 담당자가 촉박한 마감에 대해 고충을 토로할 때 '누칼협인가요? 맡으신 업무는 기한 내에 주셔야죠'라고 답해도 될까요?",
    correctAnswerLevel: "red",
    options: [
      { label: "🟢 써도 됨: 엄정한 계약 관계를 상기시키는 효율적인 한마디다", level: "green", isCorrect: false },
      { label: "🟡 맥락 주의: 줄임말을 모를 수 있으니 풀어서 써야 한다", level: "yellow", isCorrect: false },
      { label: "🔴 쓰면 위험: 상대의 고통을 조롱하는 비인간적 밈으로 대형 사고로 이어진다", level: "red", isCorrect: true },
    ],
    explanation: "‘누칼협’은 개인의 선택과 책임을 극단적으로 조롱하며 연대감을 파괴하는 혐오성 어휘입니다. 비즈니스 관계에서 사용할 경우 치명적인 협업 파탄과 인사 징계 사유가 될 수 있습니다.",
    safeAlternative: "일정 조율이 많이 힘드셨겠어요. 우선순위 높은 항목부터 먼저 전달해 주실 수 있을까요?",
  },
];

export function SafetyDiagnosticQuiz() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentQ = DIAGNOSTIC_QUESTIONS[currentIndex];
  const progressPercent = Math.round(((currentIndex + (isAnswered ? 1 : 0)) / DIAGNOSTIC_QUESTIONS.length) * 100);

  function handleSelect(index: number) {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (currentQ.options[index]?.isCorrect) {
      setScore((prev) => prev + 1);
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
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-xl sm:p-8">
      {/* 장식용 배경 글로우 */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-safety-green/10 blur-3xl" />

      {/* 상단 헤더 */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-text">
            <ShieldCheck className="h-4 w-4" />
            밈캐치 실전 진단기
          </div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">
            직장·일상 밈 소통 안전도 자가진단
          </h3>
          <p className="mt-1 text-sm text-muted">
            “이 상황에서 이 밈, 써도 될까?” 5가지 실제 상황을 통해 나의 밈 감각과 안전도를 테스트해 보세요.
          </p>
        </div>

        {!isCompleted && (
          <div className="flex items-center gap-2 font-mono text-sm font-semibold text-muted">
            <span className="text-accent">{currentIndex + 1}</span>
            <span>/</span>
            <span>{DIAGNOSTIC_QUESTIONS.length}</span>
          </div>
        )}
      </div>

      {/* 진행도 게이지 바 */}
      {!isCompleted && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {!isCompleted ? (
        <div className="relative mt-6 space-y-6">
          {/* 상황 뱃지 및 문항 */}
          <div className="space-y-2">
            <div className="inline-block rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground">
              {currentQ.situation}
            </div>
            <h4 className="text-lg font-bold leading-snug text-foreground sm:text-xl">
              {currentQ.scenario}
            </h4>
            <div className="flex items-center gap-2 pt-1 text-sm text-muted">
              <span>판별 대상 밈:</span>
              <span className="font-semibold text-foreground underline decoration-accent/50 underline-offset-4">
                {currentQ.targetMeme}
              </span>
            </div>
          </div>

          {/* 선택지 목록 (모바일 터치 타깃 48px 이상) */}
          <div className="grid gap-3">
            {currentQ.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              let btnClass = "border-border bg-surface-2 hover:border-accent/40 text-foreground";

              if (isAnswered) {
                if (option.isCorrect) {
                  btnClass = "border-safety-green/60 bg-safety-green/10 text-foreground font-semibold ring-2 ring-safety-green/50";
                } else if (isSelected && !option.isCorrect) {
                  btnClass = "border-safety-red/60 bg-safety-red/10 text-foreground font-semibold ring-2 ring-safety-red/50";
                } else {
                  btnClass = "opacity-40 border-border bg-surface-2 text-muted";
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  disabled={isAnswered}
                  className={`flex min-h-[50px] w-full items-center justify-between rounded-xl border p-4 text-left text-sm transition-all sm:text-base active:scale-[0.99] ${btnClass}`}
                >
                  <span className="flex-1 pr-3 leading-relaxed">{option.label}</span>
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

          {/* 해설 및 안전 대체어 카드 */}
          {isAnswered && (
            <div className="rounded-2xl border border-border bg-surface-2 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2">
                {selectedOption !== null && currentQ.options[selectedOption]?.isCorrect ? (
                  <div className="flex items-center gap-2 font-bold text-safety-green">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>정답입니다! 정확한 밈 판별 감각을 지니셨네요.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 font-bold text-safety-red">
                    <AlertTriangle className="h-5 w-5" />
                    <span>주의가 필요해요! 상황별 파급력을 꼭 확인하세요.</span>
                  </div>
                )}
              </div>

              <p className="text-sm leading-relaxed text-foreground/90">
                {currentQ.explanation}
              </p>

              {/* 안전 대체어 및 복사 버튼 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5">
                <div className="text-xs sm:text-sm">
                  <span className="font-bold text-accent">안전 대체 표현: </span>
                  <span className="text-foreground font-medium">“{currentQ.safeAlternative}”</span>
                </div>
                <CopyTextButton
                  text={currentQ.safeAlternative}
                  label="대체어 복사"
                  ariaLabel="안전 대체어 복사"
                  variant="mini"
                  className="self-start sm:self-auto shrink-0"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <Link
                  href={currentQ.memeHref}
                  className="text-xs font-semibold text-muted hover:text-accent flex items-center gap-1"
                >
                  ‘{currentQ.targetMeme.split(" ")[0]}’ 상세 사전 보기
                  <ArrowRight className="h-3 w-3" />
                </Link>

                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95"
                >
                  <span>{currentIndex + 1 < DIAGNOSTIC_QUESTIONS.length ? "다음 문항 풀기" : "결과 확인하기"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 최종 완료 화면 */
        <div className="relative mt-8 space-y-6 text-center">
          <div className="inline-flex size-16 items-center justify-center rounded-3xl bg-accent/15 text-accent shadow-inner">
            <Sparkles className="size-8" />
          </div>

          <div className="space-y-2">
            <h4 className="text-2xl font-black text-foreground sm:text-3xl">
              자가진단 완료!
            </h4>
            <p className="text-base text-muted">
              총 {DIAGNOSTIC_QUESTIONS.length}문항 중 <strong className="text-accent text-lg">{score}문항</strong>을 맞히셨습니다.
            </p>
          </div>

          <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface-2 p-5 text-sm leading-relaxed text-foreground">
            {score === 5 ? (
              <p>
                🎉 <strong>완벽한 밈 센스 & TPO 안전 마스터!</strong><br />
                직장과 일상 소통의 경계를 완벽히 짚어내며, 밈을 위트 있게 활용할 줄 아는 최상위 소통 능력자입니다.
              </p>
            ) : score >= 3 ? (
              <p>
                👍 <strong>안정적인 밈 센스를 갖추셨습니다!</strong><br />
                대체로 밈의 안전성을 잘 판별하고 계시며, 조금 애매한 밈은 밈캐치 사전에서 맥락과 대체어를 확인하면 더욱 완벽해집니다.
              </p>
            ) : (
              <p>
                💡 <strong>위험한 밈 사용에 주의가 필요해요!</strong><br />
                악의 없는 유행어라도 상대방에게는 상처나 갈등이 될 수 있습니다. 밈캐치의 TPO별 신호등 가이드를 적극 참고해 보세요!
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground hover:border-accent hover:text-accent shadow-xs active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span>진단 다시 풀기</span>
            </button>
            <Link
              href="/explore"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-95 active:scale-95"
            >
              <span>트렌드 밈 탐색하기</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
