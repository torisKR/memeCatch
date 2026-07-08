"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { CATEGORIES, type MemeCategory } from "@/lib/labels";
import { completeOnboarding } from "@/lib/actions/auth";

/**
 * 레인 C — 온보딩 폼(클라이언트). DESIGN.md §10 여정1 온보딩.
 * - 닉네임(프리필·수정 가능) + 관심 카테고리 다중 선택 칩 + 연령대(선택, 선택 안 함 포함).
 * - completeOnboarding 서버액션 form(hidden next). "건너뛰기"는 next로 바로 이동.
 * - 강제 선형 투어 금지: 모두 선택이며 건너뛸 수 있어요.
 * - motion 스태거 진입, prefers-reduced-motion 존중.
 */

const AGE_GROUPS = [
  { value: "10s", label: "10대" },
  { value: "20s", label: "20대" },
  { value: "30s", label: "30대" },
  { value: "40s", label: "40대" },
  { value: "50s+", label: "50대+" },
  { value: "", label: "선택 안 함" },
] as const;

const CATEGORY_ENTRIES = Object.entries(CATEGORIES) as [
  MemeCategory,
  (typeof CATEGORIES)[MemeCategory],
][];

export function OnboardingForm({
  next,
  defaultNickname,
  defaultInterests,
  defaultAgeGroup,
}: {
  next: string;
  defaultNickname: string;
  defaultInterests: string[];
  defaultAgeGroup: string;
}) {
  const reduce = useReducedMotion();
  const nickId = useId();
  const [interests, setInterests] = useState<Set<string>>(
    () => new Set(defaultInterests)
  );
  const [ageGroup, setAgeGroup] = useState<string>(defaultAgeGroup);

  function toggleInterest(key: string) {
    setInterests((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      return nextSet;
    });
  }

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.06 } },
  };
  const item: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
        },
      };

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="flex items-center gap-2">
        <FlameMark className="h-8 w-8 text-accent" />
        <span className="text-sm font-semibold text-muted">1 / 1 단계</span>
      </motion.div>

      <motion.h1
        variants={item}
        className="mt-4 text-[1.75rem] font-extrabold leading-tight"
      >
        밈캐치에 오신 걸 환영해요
      </motion.h1>
      <motion.p variants={item} className="mt-2 text-muted">
        취향을 알려 주시면 딱 맞는 밈을 먼저 보여드려요. 지금 정하지 않아도
        괜찮아요.
      </motion.p>

      <form action={completeOnboarding} className="mt-8 flex flex-col gap-8">
        <input type="hidden" name="next" value={next} />
        {/* 선택한 관심 카테고리를 서버액션에 전달 */}
        {[...interests].map((key) => (
          <input key={key} type="hidden" name="interests" value={key} />
        ))}
        <input type="hidden" name="age_group" value={ageGroup} />

        {/* 닉네임 */}
        <motion.section variants={item}>
          <label htmlFor={nickId} className="mb-2 block font-bold">
            닉네임
          </label>
          <input
            id={nickId}
            name="nickname"
            type="text"
            autoComplete="nickname"
            minLength={2}
            maxLength={20}
            required
            defaultValue={defaultNickname}
            placeholder="2~20자로 지어 주세요"
            className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20"
          />
        </motion.section>

        {/* 관심 카테고리 */}
        <motion.section variants={item}>
          <h2 className="font-bold">관심 있는 밈은 무엇인가요?</h2>
          <p className="mt-1 text-sm text-muted">여러 개 골라도 돼요.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_ENTRIES.map(([key, cat]) => {
              const active = interests.has(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggleInterest(key)}
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-base font-medium transition-colors active:scale-[0.97] ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-foreground hover:border-accent"
                    }`}
                  >
                    {cat.user}
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>

        {/* 연령대 */}
        <motion.section variants={item}>
          <h2 className="font-bold">
            연령대{" "}
            <span className="font-normal text-muted">(선택)</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            비슷한 또래에게 인기인 밈을 추천하는 데만 써요.
          </p>
          <ul
            role="radiogroup"
            aria-label="연령대"
            className="mt-3 flex flex-wrap gap-2"
          >
            {AGE_GROUPS.map((age) => {
              const active = ageGroup === age.value;
              return (
                <li key={age.value || "none"}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setAgeGroup(age.value)}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-base font-medium transition-colors active:scale-[0.97] ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-foreground hover:border-accent"
                    }`}
                  >
                    {age.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>

        <motion.div variants={item} className="flex flex-col gap-3">
          <SubmitButton />
          <Link
            href={next}
            className="inline-flex min-h-11 items-center justify-center text-base font-medium text-muted underline underline-offset-4 hover:text-foreground"
          >
            건너뛰기
          </Link>
        </motion.div>
      </form>
    </motion.div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {pending && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {pending ? "저장 중…" : "밈캐치 시작하기"}
    </button>
  );
}

function FlameMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12.8 2.3c.2 2.4-.7 3.9-2 5.2-1.5 1.5-3.4 3-3.4 5.9A6.6 6.6 0 0 0 18 13c0-2-.9-3.6-1.7-4.6.1.9-.2 1.7-.9 2.2.3-2.3-.6-4.9-2.6-8.3Z" />
      <path
        d="M12 21.7a3.9 3.9 0 0 0 3.9-3.9c0-1.7-1-2.8-1.8-3.7.1.7-.2 1.3-.7 1.7.2-1.5-.5-3.2-1.9-5-.5 1.7-1.6 2.4-2.4 3.4-.6.8-1 1.6-1 2.6A3.9 3.9 0 0 0 12 21.7Z"
        opacity=".55"
      />
    </svg>
  );
}
