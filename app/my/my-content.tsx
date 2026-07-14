"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CATEGORIES,
  memePathFrom,
  SAFETY_LEVELS,
  SUBMISSION_STATUS,
  type MemeCategory,
  type SafetyLevel,
} from "@/lib/labels";
import { signOut, updateNickname } from "@/lib/actions/auth";
import { SubmissionStatusBadge } from "@/components/submission-status";
import { MyRecent } from "@/components/my-recent";

export type SavedMeme = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string | null;
  safetyLevel: SafetyLevel;
};

export type MySubmission = {
  id: string;
  name: string;
  status: keyof typeof SUBMISSION_STATUS;
  rejectReason: string | null;
  createdAt: string;
  dup: { title: string; shortId: string; slug: string } | null;
};

const SAFETY_CHIP_CLASSES: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

/** 연령대 코드 → 노출 라벨 (labels.ts 미포함 값이라 이 화면에서만 매핑) */
const AGE_LABELS: Record<string, string> = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s+": "50대 이상",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

function categoryLabel(key: string): string {
  return (CATEGORIES as Record<string, { user: string }>)[key]?.user ?? key;
}

export function MyContent({
  nickname,
  ageGroup,
  interests,
  saved,
  submissions,
  loadError,
  nicknameError,
  nicknameSaved,
  myFeed,
}: {
  nickname: string;
  ageGroup: string | null;
  interests: string[];
  saved: SavedMeme[];
  submissions: MySubmission[];
  loadError: boolean;
  nicknameError?: string;
  nicknameSaved: boolean;
  /** 관심 카테고리 맞춤 피드 — 서버 컴포넌트(components/my-feed.tsx)를 페이지에서 슬롯으로 전달 */
  myFeed: ReactNode;
}) {
  const reduce = useReducedMotion();
  const avatarChar = (nickname.trim()[0] ?? "밈").toUpperCase();
  const knownInterests = interests.filter(
    (c) => c in CATEGORIES
  ) as MemeCategory[];

  // 섹션 진입 리빌 (reduced-motion이면 정적)
  const section = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-40px" },
        transition: { duration: 0.35, ease: "easeOut" as const },
      };

  const listContainer = reduce
    ? {}
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, margin: "-40px" },
        variants: {
          hidden: {},
          show: { transition: { staggerChildren: 0.04 } },
        },
      };
  const listItem = reduce
    ? {}
    : {
        variants: {
          hidden: { opacity: 0, y: 12 },
          show: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.3, ease: "easeOut" as const },
          },
        },
      };

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      {/* 프로필 헤더 */}
      <motion.div
        {...section}
        className="flex items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl font-bold text-accent"
          >
            {avatarChar}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">
              {nickname || "밈캐치 유저"}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {ageGroup && AGE_LABELS[ageGroup]
                ? `${AGE_LABELS[ageGroup]} · 반가워요`
                : "반가워요, 오늘의 밈 찾아볼까요?"}
            </p>
          </div>
        </div>
        <form action={signOut} className="shrink-0">
          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            로그아웃
          </button>
        </form>
      </motion.div>

      {loadError && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red"
        >
          일부 정보를 불러오지 못했어요. 새로고침해 주세요.
        </p>
      )}

      {/* 닉네임 수정 */}
      <motion.section
        {...section}
        className="mt-6 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="text-lg font-bold">닉네임</h2>
        <form action={updateNickname} className="mt-3 flex gap-2">
          <label htmlFor="nickname" className="sr-only">
            닉네임
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            defaultValue={nickname}
            minLength={2}
            maxLength={20}
            required
            aria-invalid={!!nicknameError}
            aria-describedby={nicknameError ? "nickname-error" : undefined}
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            저장
          </button>
        </form>
        {nicknameError && (
          <p
            id="nickname-error"
            role="alert"
            className="mt-2 text-sm text-safety-red"
          >
            {nicknameError}
          </p>
        )}
        {nicknameSaved && !nicknameError && (
          <p role="status" className="mt-2 text-sm text-safety-green">
            닉네임을 저장했어요.
          </p>
        )}
      </motion.section>

      {/* 관심 카테고리 */}
      <motion.section
        {...section}
        className="mt-6 rounded-2xl border border-border bg-surface p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">관심 카테고리</h2>
          <Link
            href="/onboarding?next=/my"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
          >
            {knownInterests.length > 0 ? "수정" : "설정하기"}
          </Link>
        </div>
        {knownInterests.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {knownInterests.map((c) => (
              <li
                key={c}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium"
              >
                {categoryLabel(c)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            관심 카테고리를 설정하면 취향에 맞는 밈을 먼저 보여드려요.
          </p>
        )}
      </motion.section>

      {/* 관심 카테고리 맞춤 피드 — 서버 컴포넌트 슬롯 */}
      {myFeed}

      {/* 저장한 밈 */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">저장한 밈</h2>
          {saved.length > 0 && (
            <span className="text-sm text-muted">{saved.length}개</span>
          )}
        </div>
        {saved.length === 0 ? (
          <motion.div
            {...section}
            className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center"
          >
            <p className="text-muted">아직 저장한 밈이 없어요.</p>
            <p className="mt-1 text-muted">
              궁금한 밈을 저장해 두면 여기서 다시 볼 수 있어요.
            </p>
            <Link
              href="/explore"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              탐색하러 가기
            </Link>
          </motion.div>
        ) : (
          <motion.ul
            {...listContainer}
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {saved.map((meme) => {
              const safety = SAFETY_LEVELS[meme.safetyLevel];
              return (
                <motion.li key={meme.id} {...listItem}>
                  <Link
                    href={memePathFrom(meme.shortId, meme.slug)}
                    className="flex h-full flex-col rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-base font-bold">
                        {meme.title}
                      </h3>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${SAFETY_CHIP_CLASSES[meme.safetyLevel]}`}
                      >
                        <span aria-hidden>{safety.icon}</span>
                        {safety.user}
                      </span>
                    </div>
                    {meme.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {meme.summary}
                      </p>
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </section>

      {/* 최근 본 밈 — 기록 없으면 컴포넌트가 자체적으로 숨김 */}
      <MyRecent />

      {/* 내 제보 */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">내 제보</h2>
        {submissions.length === 0 ? (
          <motion.div
            {...section}
            className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center"
          >
            <p className="text-muted">아직 제보한 밈이 없어요.</p>
            <p className="mt-1 text-muted">
              처음 본 밈을 알려 주시면 검토 후 등록해 드려요.
            </p>
            <Link
              href="/submit"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              첫 밈 제보하기
            </Link>
          </motion.div>
        ) : (
          <motion.ul {...listContainer} className="mt-3 flex flex-col gap-3">
            {submissions.map((sub) => (
              <motion.li
                key={sub.id}
                {...listItem}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate text-base font-bold">
                    {sub.name}
                  </h3>
                  <SubmissionStatusBadge
                    status={sub.status}
                    className="shrink-0"
                  />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {dateFormatter.format(new Date(sub.createdAt))} 제보
                </p>
                {sub.status === "pending" && (
                  <p className="mt-2 text-muted">
                    {SUBMISSION_STATUS.pending.user}
                  </p>
                )}
                {sub.status === "rejected" && sub.rejectReason && (
                  <p className="mt-2 rounded-xl bg-safety-red-bg px-3 py-2 text-safety-red">
                    반려 사유: {sub.rejectReason}
                  </p>
                )}
                {sub.dup && (
                  <p className="mt-2 text-muted">
                    이미 등록된 밈이에요 →{" "}
                    <Link
                      href={memePathFrom(sub.dup.shortId, sub.dup.slug)}
                      className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
                    >
                      {sub.dup.title}
                    </Link>
                  </p>
                )}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>
    </main>
  );
}
