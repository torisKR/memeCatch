import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  memePathFrom,
  SAFETY_LEVELS,
  SUBMISSION_STATUS,
  type SafetyLevel,
} from "@/lib/labels";
import { signOut, updateNickname } from "@/lib/actions/auth";
import { SubmissionStatusBadge } from "@/components/submission-status";

export const metadata: Metadata = {
  title: "MY",
  description: "저장한 밈과 내 제보를 한눈에 볼 수 있어요.",
};

const SAFETY_CHIP_CLASSES: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const nicknameError =
    typeof sp.nickname_error === "string" ? sp.nickname_error : undefined;
  const nicknameSaved = sp.nickname_saved === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my");

  const [profileRes, savedRes, subsRes] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", user.id).single(),
    supabase
      .from("saved_memes")
      .select(
        "created_at, memes(id, short_id, slug, title, summary, safety_level)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("meme_submissions")
      .select(
        "id, name, status, reject_reason, created_at, dup:memes!dup_of(title, short_id, slug)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const nickname = profileRes.data?.nickname ?? "";
  const saved = savedRes.data ?? [];
  const submissions = subsRes.data ?? [];
  const loadError = !!(profileRes.error || savedRes.error || subsRes.error);

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">MY</h1>
          <p className="mt-1 text-muted">{nickname}님, 어서 오세요.</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-base font-medium text-muted"
          >
            로그아웃
          </button>
        </form>
      </div>

      {loadError && (
        <p role="alert" className="mt-4 rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red">
          일부 정보를 불러오지 못했어요. 새로고침해 주세요.
        </p>
      )}

      {/* 닉네임 수정 */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
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
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 text-base"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-xl bg-accent px-5 text-base font-bold text-white"
          >
            저장
          </button>
        </form>
        {nicknameError && (
          <p id="nickname-error" role="alert" className="mt-2 text-sm text-safety-red">
            {nicknameError}
          </p>
        )}
        {nicknameSaved && !nicknameError && (
          <p role="status" className="mt-2 text-sm text-safety-green">
            닉네임을 저장했어요.
          </p>
        )}
      </section>

      {/* 저장한 밈 */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">저장한 밈</h2>
        {saved.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-muted">아직 저장한 밈이 없어요.</p>
            <p className="mt-1 text-muted">
              궁금한 밈을 저장해 두면 여기서 다시 볼 수 있어요.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-base font-bold text-white"
            >
              밈 구경하러 가기
            </Link>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {saved.map((row) => {
              const meme = row.memes;
              if (!meme) return null;
              const safety = SAFETY_LEVELS[meme.safety_level];
              return (
                <li key={meme.id}>
                  <Link
                    href={memePathFrom(meme.short_id, meme.slug)}
                    className="block rounded-2xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="min-w-0 truncate text-base font-bold">
                        {meme.title}
                      </h3>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${SAFETY_CHIP_CLASSES[meme.safety_level]}`}
                      >
                        <span aria-hidden>{safety.icon}</span>
                        {safety.user}
                      </span>
                    </div>
                    {meme.summary && (
                      <p className="mt-1 line-clamp-2 text-muted">{meme.summary}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 내 제보 */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">내 제보</h2>
        {submissions.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-muted">아직 제보한 밈이 없어요.</p>
            <p className="mt-1 text-muted">
              처음 본 밈을 알려 주시면 검토 후 등록해 드려요.
            </p>
            <Link
              href="/submit"
              className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-base font-bold text-white"
            >
              첫 밈 제보하기
            </Link>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {submissions.map((sub) => (
              <li
                key={sub.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate text-base font-bold">{sub.name}</h3>
                  <SubmissionStatusBadge status={sub.status} className="shrink-0" />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {dateFormatter.format(new Date(sub.created_at))} 제보
                </p>
                {sub.status === "pending" && (
                  <p className="mt-2 text-muted">{SUBMISSION_STATUS.pending.user}</p>
                )}
                {sub.status === "rejected" && sub.reject_reason && (
                  <p className="mt-2 rounded-xl bg-safety-red-bg px-3 py-2 text-safety-red">
                    반려 사유: {sub.reject_reason}
                  </p>
                )}
                {sub.dup && (
                  <p className="mt-2 text-muted">
                    이미 등록된 밈이에요 →{" "}
                    <Link
                      href={memePathFrom(sub.dup.short_id, sub.dup.slug)}
                      className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
                    >
                      {sub.dup.title}
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
