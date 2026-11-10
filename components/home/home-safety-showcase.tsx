"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, MessageCircle } from "lucide-react";
import { SafetyBadge } from "@/components/safety-badge";
import { CURATED_CORE_MEMES } from "@/lib/curated-memes";

type FilterTab = "work_safe" | "caution_needed" | "everyday";

export function HomeSafetyShowcase() {
  const [activeTab, setActiveTab] = useState<FilterTab>("work_safe");

  const filteredMemes = CURATED_CORE_MEMES.filter((m) => {
    if (activeTab === "work_safe") {
      return m.usage_context.work === "green";
    }
    if (activeTab === "caution_needed") {
      return m.safety_level === "red" || m.safety_level === "yellow";
    }
    if (activeTab === "everyday") {
      return m.usage_context.friends === "green";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-safety-green/30 bg-safety-green/10 px-3 py-1 text-xs font-semibold text-safety-green">
            <ShieldCheck className="h-3.5 w-3.5" />
            TPO별 밈 검증 가이드
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            이 밈, 지금 써도 될까? 상황별 안전 가이드
          </h2>
          <p className="mt-1 text-base leading-7 text-foreground">
            밈의 뜻만 아는 것으로는 부족합니다. 직장 동료, 단톡방, SNS 등 장소와 대상에 따른 검증된 실전 가이드를 확인하세요.
          </p>
        </div>

        {/* 필터 탭 (모바일 터치 타깃 44px 이상, 수평 스크롤 지원) */}
        <div className="flex max-w-full overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <div className="inline-flex shrink-0 rounded-2xl border border-border bg-surface-2 p-1 text-xs font-semibold shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("work_safe")}
              className={`min-h-[44px] rounded-xl px-3.5 py-2 transition-all active:scale-[0.98] ${
                activeTab === "work_safe"
                  ? "bg-accent-strong text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              💼 직장 슬랙 가능
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("caution_needed")}
              className={`min-h-[44px] rounded-xl px-3.5 py-2 transition-all active:scale-[0.98] ${
                activeTab === "caution_needed"
                  ? "bg-accent-strong text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              ⚠️ 주의·금기 밈
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("everyday")}
              className={`min-h-[44px] rounded-xl px-3.5 py-2 transition-all active:scale-[0.98] ${
                activeTab === "everyday"
                  ? "bg-accent-strong text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              ☕ 일상·친구 대화
            </button>
          </div>
        </div>
      </div>

      {/* 밈 카드 그리드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMemes.slice(0, 6).map((meme) => {
          const detailHref = `/memes/${meme.short_id}-${meme.slug}`;
          const dialogueSample = meme.usage_examples[0]?.dialogue;
          const punchline = dialogueSample?.[1]?.line ?? meme.summary;
          const speakerName = dialogueSample?.[1]?.speaker ?? "실전 대사";

          return (
            <Link
              key={meme.id}
              href={detailHref}
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg active:scale-[0.99]"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <SafetyBadge level={meme.safety_level} />
                  <span className="font-mono text-xs text-muted">
                    {meme.origin_year}년 유래
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-accent transition-colors">
                    {meme.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-base leading-7 text-foreground">
                    {meme.summary}
                  </p>
                </div>

                {/* 실전 대사 미니 말풍선 */}
                <div className="rounded-xl border border-border/80 bg-surface-2 p-3 text-base">
                  <div className="flex items-center gap-1.5 font-semibold text-accent mb-1">
                    <MessageCircle className="size-3" />
                    <span>{speakerName}</span>
                  </div>
                  <p className="line-clamp-2 italic text-foreground/90 leading-relaxed">
                    “{punchline}”
                  </p>
                </div>
              </div>

              {/* 하단 TPO 상태 칩 */}
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted">직장</span>
                  <span className={meme.usage_context.work === "green" ? "font-bold text-safety-green" : "font-bold text-safety-red"}>
                    {meme.usage_context.work === "green" ? "안전 🟢" : "주의 🔴"}
                  </span>
                </div>
                <span className="flex items-center gap-1 font-semibold text-accent group-hover:translate-x-0.5 transition-transform">
                  상세 가이드
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
