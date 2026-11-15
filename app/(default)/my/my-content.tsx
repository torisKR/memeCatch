"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CATEGORIES,
  DISPLAY_CATEGORIES,
  memePathFrom,
  resolveDisplayCategory,
  SAFETY_LEVELS,
  SUBMISSION_STATUS,
  type DisplayCategoryKey,
  type MemeCategory,
  type SafetyLevel,
} from "@/lib/labels";
import { signOut, updateNickname } from "@/lib/actions/auth";
import { MyRecent } from "@/components/my-recent";
import { useLocale } from "@/lib/i18n-client";
import { MY_COPY } from "@/lib/i18n-my";
import { savedLibraryHref } from "@/lib/saved-library";
import { CONTACT_EMAIL } from "@/lib/site";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";

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

const SUBMISSION_STATUS_CLASSES: Record<
  keyof typeof SUBMISSION_STATUS,
  string
> = {
  pending: "bg-safety-gray-bg text-safety-gray",
  reviewing: "bg-safety-yellow-bg text-safety-yellow",
  approved: "bg-safety-green-bg text-safety-green",
  rejected: "bg-safety-red-bg text-safety-red",
};

const NICKNAME_ERROR_SOURCE = {
  invalidLength: "닉네임은 2~20자로 지어 주세요",
  taken: "이미 사용 중인 닉네임이에요",
} as const;

export function MyContent({
  nickname,
  ageGroup,
  interests,
  saved,
  submissions,
  loadError,
  nicknameError,
  nicknameSaved,
  savedTotal,
  savedResultTotal,
  savedQuery,
  savedSafety,
  savedPage,
  savedPageCount,
  memeCards,
}: {
  nickname: string;
  ageGroup: string | null;
  interests: string[];
  saved: SavedMeme[];
  submissions: MySubmission[];
  loadError: boolean;
  nicknameError?: string;
  nicknameSaved: boolean;
  /** All saved memes; never reduced by the active library filters. */
  savedTotal: number;
  /** Matching saved memes after the server-side library filters. */
  savedResultTotal: number;
  savedQuery: string;
  savedSafety: SafetyLevel | null;
  savedPage: number;
  savedPageCount: number;
  /** Private meme card collection; independent of the saved library. */
  memeCards?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const { locale } = useLocale();
  const copy = MY_COPY[locale];
  const avatarChar = (nickname.trim()[0] ?? copy.avatarFallback).toUpperCase();
  const knownInterests = interests.filter(
    (c) => c in CATEGORIES,
  ) as MemeCategory[];
  const displayInterests = [
    ...new Set(knownInterests.map(resolveDisplayCategory)),
  ] as DisplayCategoryKey[];
  const ageLabel =
    ageGroup && ageGroup in copy.ageGroups
      ? copy.ageGroups[ageGroup as keyof typeof copy.ageGroups]
      : undefined;
  const nicknameErrorMessage = !nicknameError
    ? undefined
    : nicknameError === NICKNAME_ERROR_SOURCE.invalidLength
      ? copy.nickname.errors.invalidLength
      : nicknameError === NICKNAME_ERROR_SOURCE.taken
        ? copy.nickname.errors.taken
        : copy.nickname.errors.saveFailed;
  const dateFormatter = new Intl.DateTimeFormat(copy.dateLocale, {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  });
  const hasSavedVaultFilter = Boolean(savedQuery || savedSafety);
  const savedLibraryPageHref = (page = 1) =>
    savedLibraryHref({ query: savedQuery, safety: savedSafety }, page);

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
    // 컨테이너는 헤더(max-w-5xl px-4)와 사이드 간격을 정확히 일치시킨다.
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
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
              {nickname || copy.defaultNickname}
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {copy.greeting(ageLabel)}
            </p>
          </div>
        </div>
        <form action={signOut} className="shrink-0">
          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {copy.logout}
          </button>
        </form>
      </motion.div>

      {loadError && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red"
        >
          {copy.loadError}
        </p>
      )}

      {/* 반응형 2컬럼 — lg+: 좌측 설정 레일(sticky) + 우측 콘텐츠.
          좁아지면(<lg) 자연스럽게 한 컬럼으로 내려간다(설정 → 피드 → 저장 → 제보). */}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:w-80 lg:shrink-0">
          {/* 닉네임 수정 */}
          <motion.section
            {...section}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <h2 className="text-lg font-bold">{copy.nickname.title}</h2>
            <form action={updateNickname} className="mt-3 flex gap-2">
              <label htmlFor="nickname" className="sr-only">
                {copy.nickname.label}
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                defaultValue={nickname}
                minLength={2}
                maxLength={20}
                required
                aria-invalid={!!nicknameErrorMessage}
                aria-describedby={
                  nicknameErrorMessage ? "nickname-error" : undefined
                }
                className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <button
                type="submit"
                className="h-12 shrink-0 rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {copy.nickname.save}
              </button>
            </form>
            {nicknameErrorMessage && (
              <p
                id="nickname-error"
                role="alert"
                className="mt-2 text-sm text-safety-red"
              >
                {nicknameErrorMessage}
              </p>
            )}
            {nicknameSaved && !nicknameErrorMessage && (
              <p role="status" className="mt-2 text-sm text-safety-green">
                {copy.nickname.saved}
              </p>
            )}
          </motion.section>

          {/* 관심 카테고리 */}
          <motion.section
            {...section}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{copy.interests.title}</h2>
              <Link
                href="/onboarding?next=/my"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
              >
                {displayInterests.length > 0
                  ? copy.interests.edit
                  : copy.interests.set}
              </Link>
            </div>
            {displayInterests.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {displayInterests.map((key) => {
                  const category = DISPLAY_CATEGORIES[key].categories[0];
                  return (
                    <li
                      key={key}
                      className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium"
                    >
                      {copy.categories[category]}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{copy.interests.empty}</p>
            )}
          </motion.section>

          <motion.section
            {...section}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <h2 className="text-lg font-bold">{copy.accountDelete.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {copy.accountDelete.body}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
              >
                {copy.accountDelete.request}
              </Link>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
              >
                {copy.accountDelete.mail}
              </a>
            </div>
          </motion.section>
        </aside>

        {/* 우측 콘텐츠 컬럼 — 첫 섹션의 자체 mt-8은 컬럼 정렬을 위해 상쇄 */}
        <div className="min-w-0 flex-1 [&>*:first-child]:mt-0">
          {memeCards && <>
            <nav aria-label={copy.saved.title} className="mt-6 flex flex-wrap gap-3 border-b border-border pb-3">
              <Link href="#meme-cards" className="inline-flex min-h-11 items-center rounded-xl bg-accent-soft px-4 text-sm font-bold text-accent-text">{MEME_CARDS_COPY[locale].nav}</Link>
              <Link href="#saved" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">{copy.saved.title}</Link>
            </nav>
            {memeCards}
          </>}

          {/* 저장한 밈 — 저장 라이브러리를 검색·안전 신호로 다시 찾는다. */}
          <section id="saved" className="mt-8 scroll-mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-bold">{copy.saved.title}</h2>
              </div>
              <span className="text-sm text-muted">
                {savedTotal}
              </span>
            </div>

            {savedTotal > 0 && (
              <form
                action="/my#saved"
                method="get"
                role="search"
                className="mt-3 rounded-2xl border border-border bg-surface p-3 sm:flex sm:items-end sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="saved-library-query"
                    className="block text-xs font-bold text-muted"
                  >
                    {copy.saved.library.searchLabel}
                  </label>
                  <input
                    id="saved-library-query"
                    name="saved_q"
                    type="search"
                    defaultValue={savedQuery}
                    maxLength={80}
                    placeholder={copy.saved.library.searchPlaceholder}
                    aria-describedby="saved-library-results"
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div className="mt-3 min-w-40 sm:mt-0">
                  <label
                    htmlFor="saved-library-safety"
                    className="block text-xs font-bold text-muted"
                  >
                    {copy.saved.library.safetyLabel}
                  </label>
                  <select
                    id="saved-library-safety"
                    name="saved_safety"
                    defaultValue={savedSafety ?? ""}
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">{copy.saved.library.allSafety}</option>
                    {(["green", "yellow", "gray", "red"] as const).map(
                      (level) => (
                        <option key={level} value={level}>
                          {copy.safety[level]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="mt-3 flex shrink-0 items-center gap-3 sm:mt-0">
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {copy.saved.library.apply}
                  </button>
                  {hasSavedVaultFilter && (
                    <Link
                      href={savedLibraryPageHref()}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-4"
                    >
                      {copy.saved.library.clear}
                    </Link>
                  )}
                </div>
                <p
                  id="saved-library-results"
                  role="status"
                  className="mt-3 text-xs text-muted sm:order-last sm:mt-0 sm:w-full"
                >
                  {copy.saved.library.results(savedResultTotal, savedTotal)}
                </p>
              </form>
            )}

            {saved.length === 0 ? (
              <motion.div
                {...section}
                className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center"
              >
                <p className="text-muted">
                  {hasSavedVaultFilter
                    ? copy.saved.library.emptyFilteredTitle
                    : copy.saved.emptyTitle}
                </p>
                <p className="mt-1 text-muted">
                  {hasSavedVaultFilter
                    ? copy.saved.library.emptyFilteredBody
                    : copy.saved.emptyBody}
                </p>
                {hasSavedVaultFilter ? (
                  <Link
                    href={savedLibraryPageHref()}
                    className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {copy.saved.library.clear}
                  </Link>
                ) : (
                  <Link
                    href="/explore"
                    className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {copy.saved.explore}
                  </Link>
                )}
              </motion.div>
            ) : (
              <motion.ul
                {...listContainer}
                className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {saved.map((meme) => {
                  const safety = SAFETY_LEVELS[meme.safetyLevel];
                  return (
                    <motion.li
                      key={meme.id}
                      {...listItem}
                      className="flex h-full flex-col rounded-2xl border border-border bg-surface transition-colors hover:border-accent"
                    >
                      <Link
                        href={memePathFrom(meme.shortId, meme.slug)}
                        className="flex flex-1 flex-col p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-base font-bold">
                            {meme.title}
                          </h3>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${SAFETY_CHIP_CLASSES[meme.safetyLevel]}`}
                          >
                            <span aria-hidden>{safety.icon}</span>
                            {copy.safety[meme.safetyLevel]}
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
            {savedPageCount > 1 && (
              <nav
                aria-label={copy.saved.library.pagination.label}
                className="mt-5 flex items-center justify-between gap-3"
              >
                {savedPage > 1 ? (
                  <Link
                    href={savedLibraryPageHref(savedPage - 1)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {copy.saved.library.pagination.previous}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-muted opacity-50"
                  >
                    {copy.saved.library.pagination.previous}
                  </span>
                )}
                <span
                  aria-current="page"
                  className="text-sm font-medium text-muted"
                >
                  {copy.saved.library.pagination.status(savedPage, savedPageCount)}
                </span>
                {savedPage < savedPageCount ? (
                  <Link
                    href={savedLibraryPageHref(savedPage + 1)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {copy.saved.library.pagination.next}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-muted opacity-50"
                  >
                    {copy.saved.library.pagination.next}
                  </span>
                )}
              </nav>
            )}
          </section>

          {/* 최근 본 밈 — 기록 없으면 컴포넌트가 자체적으로 숨김 */}
          <MyRecent />

          {/* 내 제보 */}
          <section className="mt-8">
            <h2 className="text-lg font-bold">{copy.submissions.title}</h2>
            {submissions.length === 0 ? (
              <motion.div
                {...section}
                className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center"
              >
                <p className="text-muted">{copy.submissions.emptyTitle}</p>
                <p className="mt-1 text-muted">{copy.submissions.emptyBody}</p>
                <Link
                  href="/submit"
                  className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {copy.submissions.first}
                </Link>
              </motion.div>
            ) : (
              <motion.ul
                {...listContainer}
                className="mt-3 flex flex-col gap-3"
              >
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
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${SUBMISSION_STATUS_CLASSES[sub.status]}`}
                      >
                        {copy.submissions.status[sub.status].badge}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {copy.submissions.submittedAt(
                        dateFormatter.format(new Date(sub.createdAt)),
                      )}
                    </p>
                    {sub.status === "pending" && (
                      <p className="mt-2 text-muted">
                        {copy.submissions.pendingDetail}
                      </p>
                    )}
                    {sub.status === "rejected" && sub.rejectReason && (
                      <p className="mt-2 rounded-xl bg-safety-red-bg px-3 py-2 text-safety-red">
                        {copy.submissions.rejectionReason}: {sub.rejectReason}
                      </p>
                    )}
                    {sub.dup && (
                      <p className="mt-2 text-muted">
                        {copy.submissions.duplicate} →{" "}
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
        </div>
      </div>
    </main>
  );
}
