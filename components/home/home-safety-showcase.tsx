"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, AlertCircle, Sparkles } from "lucide-react";
import { SafetyBadge } from "@/components/safety-badge";
import { CURATED_CORE_MEMES } from "@/lib/curated-memes";
import type { SafetyLevel } from "@/lib/labels";

type FilterTab = "all" | "work_safe" | "caution_needed" | "everyday";

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
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            이 밈, 지금 써도 될까? 상황별 안전 가이드
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            밈의 뜻만 아는 것으로는 부족합니다. 직장 동료, 단톡방, SNS 등 장소와 대상에 따른 검증된 실전 가이드를 확인하세요.
          </p>
        </div>

        {/* 필터 탭 */}
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("work_safe")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              activeTab === "work_safe"
                ? "bg-accent text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            💼 직장 슬랙 가능
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("caution_needed")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              activeTab === "caution_needed"
                ? "bg-accent text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            ⚠️ 주의·금기 밈
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("everyday")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              activeTab === "everyday"
                ? "bg-accent text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            ☕ 일상·친구 대화
          </button>
        </div>
      </div>

      {/* 밈 카드 그리드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMemes.slice(0, 6).map((meme) => {
          const detailHref = `/memes/${meme.short_id}-${meme.slug}`;
          const sampleDialogue = meme.usage_examples[0]?.dialogue[1]?.line ?? meme.summary;

          return (
            <Link
              key={meme.id}
              href={detailHref}
              className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <SafetyBadge level={meme.safety_level} />
                  <span className="font-mono text-xs text-neutral-400">
                    {meme.origin_year}년 유래
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white transition-colors group-hover:text-accent">
                    {meme.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-neutral-300">
                    {meme.summary}
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-neutral-300">
                  <div className="font-semibold text-accent-text">💬 실전 예시</div>
                  <p className="mt-1 line-clamp-2 italic text-neutral-200">
                    &ldquo;{sampleDialogue}&rdquo;
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
                <span className="text-neutral-400">
                  {meme.trend_now.status_label}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-white group-hover:text-accent">
                  상세 분석 <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
