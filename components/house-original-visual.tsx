"use client";

import { useState } from "react";
import { generateHouseMemeCardDataUrl } from "@/lib/meme-generator/image-generator";

type HouseOriginalVisualProps = {
  title: string;
  summary: string;
  category?: string;
  safetyLevel?: string;
  exampleDialogue?: string;
};

export function HouseOriginalVisual({
  title,
  summary,
  category = "phrase",
  safetyLevel = "green",
  exampleDialogue,
}: HouseOriginalVisualProps) {
  const [activeTab, setActiveTab] = useState<"card" | "storyboard">("card");

  const cardDataUrl = generateHouseMemeCardDataUrl(
    {
      title,
      summary,
      category: category as any,
      safety_level: safetyLevel as any,
      usage_examples: [
        {
          situation: "대화 예시",
          dialogue: [
            { speaker: "A", line: "일상 대화" },
            { speaker: "B", line: exampleDialogue || "이 밈을 센스 있게 사용해 보세요!" },
          ],
        },
      ],
    },
    "square",
    "obsidian_coral",
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
            ✨ 밈캐치 자체 제작
          </span>
          <span className="text-xs text-muted">타 SNS 의존 없는 오리지널 콘텐츠</span>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-surface p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("card")}
            className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              activeTab === "card"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            🎨 밈 카드
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("storyboard")}
            className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              activeTab === "storyboard"
                ? "bg-accent text-white shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            🎬 숏폼 스토리보드
          </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === "card" ? (
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-md overflow-hidden rounded-xl shadow-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cardDataUrl}
                alt={`${title} 자체 밈 카드`}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-2.5 text-xs text-muted">
              외부 플랫폼 링크 유실 걱정 없이 밈캐치 엔진으로 자체 렌더링된 공식 카드입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent">Scene 1 (00:00 - 00:03)</span>
                <span className="text-xs text-muted">타이틀 인트로</span>
              </div>
              <p className="mt-1 text-sm font-semibold">"{title}" 요즘 대세 밈 30초 완성</p>
              <p className="text-xs text-muted mt-0.5">화면 중앙 볼드 타이포그래피 + 다이내믹 사운드</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent">Scene 2 (00:03 - 00:08)</span>
                <span className="text-xs text-muted">핵심 뜻과 유래</span>
              </div>
              <p className="mt-1 text-sm font-semibold">{summary}</p>
              <p className="text-xs text-muted mt-0.5">상황을 직관적으로 보여주는 키 비주얼 및 요약 자막</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent">Scene 3 (00:08 - 00:12)</span>
                <span className="text-xs text-muted">실전 톡 예시</span>
              </div>
              <p className="mt-1 text-sm font-semibold">"{exampleDialogue || '대화에서 실제로 어떻게 쓰는지 보여주기'}"</p>
              <p className="text-xs text-muted mt-0.5">메신저 말풍선 인터랙션 애니메이션</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent">Scene 4 (00:12 - 00:15)</span>
                <span className="text-xs text-muted">안전 사용 아웃트로</span>
              </div>
              <p className="mt-1 text-sm font-semibold">초록불 — 일상에서 안전하게 써도 됨</p>
              <p className="text-xs text-muted mt-0.5">밈캐치 오리지널 검증 마크 노출</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
