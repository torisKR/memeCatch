"use client";

import { useId, useState } from "react";
import { BrandTile } from "@/components/brand-mark";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  DISPLAY_CATEGORY_LIST,
  type MemeCategory,
} from "@/lib/labels";
import { completeOnboarding } from "@/lib/actions/auth";
import { useLocale } from "@/lib/i18n-client";
import { MY_COPY } from "@/lib/i18n-my";

/**
 * 레인 C — 온보딩 폼(클라이언트). DESIGN.md §10 여정1 온보딩.
 * - 닉네임(프리필·수정 가능) + 관심 카테고리 다중 선택 칩 + 연령대(선택, 선택 안 함 포함).
 * - completeOnboarding 서버액션 form(hidden next). "건너뛰기"는 next로 바로 이동.
 * - 강제 선형 투어 금지: 모두 선택이며 건너뛸 수 있어요.
 * - motion 스태거 진입, prefers-reduced-motion 존중.
 */

const AGE_GROUPS = ["10s", "20s", "30s", "40s", "50s+"] as const;

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
  const { locale } = useLocale();
  const myCopy = MY_COPY[locale];
  const copy = myCopy.onboarding;
  const nickId = useId();
  const [interests, setInterests] = useState<Set<MemeCategory>>(
    () =>
      new Set(
        DISPLAY_CATEGORY_LIST.flatMap(({ categories }) =>
          categories.some((category) => defaultInterests.includes(category))
            ? [...categories]
            : []
        ) as MemeCategory[]
      )
  );
  const [ageGroup, setAgeGroup] = useState<string>(defaultAgeGroup);

  function toggleInterest(categories: readonly MemeCategory[]) {
    setInterests((prev) => {
      const nextSet = new Set(prev);
      const active = categories.some((category) => nextSet.has(category));
      for (const category of categories) {
        if (active) nextSet.delete(category);
        else nextSet.add(category);
      }
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
        <BrandTile className="size-9" />
        <span className="text-sm font-semibold text-muted">{copy.step}</span>
      </motion.div>

      <motion.h1
        variants={item}
        className="mt-4 text-[1.75rem] font-extrabold leading-tight"
      >
        {copy.title}
      </motion.h1>
      <motion.p variants={item} className="mt-2 text-muted">
        {copy.body}
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
            {copy.nicknameLabel}
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
            placeholder={copy.nicknamePlaceholder}
            className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/20"
          />
        </motion.section>

        {/* 관심 카테고리 */}
        <motion.section variants={item}>
          <h2 className="font-bold">{copy.interestsTitle}</h2>
          <p className="mt-1 text-sm text-muted">{copy.interestsBody}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {DISPLAY_CATEGORY_LIST.map(({ key, categories }) => {
              const legacyCategories = categories as readonly MemeCategory[];
              const active = legacyCategories.some((category) =>
                interests.has(category)
              );
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggleInterest(legacyCategories)}
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-base font-medium transition-colors active:scale-[0.97] ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-foreground hover:border-accent"
                    }`}
                  >
                    {myCopy.categories[legacyCategories[0] ?? "phrase"]}
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>

        {/* 연령대 */}
        <motion.section variants={item}>
          <h2 className="font-bold">
            {copy.ageTitle}{" "}
            <span className="font-normal text-muted">({copy.optional})</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            {copy.ageBody}
          </p>
          <ul
            role="radiogroup"
            aria-label={copy.ageTitle}
            className="mt-3 flex flex-wrap gap-2"
          >
            {[...AGE_GROUPS, "" as const].map((age) => {
              const active = ageGroup === age;
              return (
                <li key={age || "none"}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setAgeGroup(age)}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-base font-medium transition-colors active:scale-[0.97] ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-foreground hover:border-accent"
                    }`}
                  >
                    {age ? myCopy.ageGroups[age] : copy.notSelected}
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>

        <motion.div variants={item} className="flex flex-col gap-3">
          <SubmitButton copy={copy} />
          <Link
            href={next}
            className="inline-flex min-h-11 items-center justify-center text-base font-medium text-muted underline underline-offset-4 hover:text-foreground"
          >
            {copy.skip}
          </Link>
        </motion.div>
      </form>
    </motion.div>
  );
}

function SubmitButton({
  copy,
}: {
  copy: (typeof MY_COPY)["ko"]["onboarding"];
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {pending && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {pending ? copy.submitting : copy.submit}
    </button>
  );
}
