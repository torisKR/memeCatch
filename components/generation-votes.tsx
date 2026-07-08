"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { flags } from "@/lib/flags";
import { CommunityGate } from "@/components/community-gate";
import { castGenerationVote } from "@/lib/actions/community";

/** 표본 20표 미만인 세대는 분포 비노출 (기획 확정) */
const MIN_SAMPLE = 20;

type VoteValue = "know" | "dont_know" | "use" | "wont_use";
type AgeGroup = "10s" | "20s" | "30s" | "40s" | "50s+";

// generation_votes enum의 노출 문구 — labels.ts에 미정의라 이 컴포넌트에서만 관리
const VOTE_OPTIONS: { value: VoteValue; label: string }[] = [
  { value: "know", label: "알아요" },
  { value: "use", label: "써요" },
  { value: "dont_know", label: "몰라요" },
  { value: "wont_use", label: "안 써요" },
];
const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: "10s", label: "10대" },
  { value: "20s", label: "20대" },
  { value: "30s", label: "30대" },
  { value: "40s", label: "40대" },
  { value: "50s+", label: "50대 이상" },
];

type StatRow = { age_group: string | null; vote: string | null; cnt: number | null };

/**
 * 레인 F — 세대별 인지도 투표 (독립 export, 레인 B가 상세 페이지에 삽입).
 * cast_generation_vote RPC + generation_vote_stats 뷰.
 */
export function GenerationVotes({ memeId }: { memeId: string }) {
  const pathname = usePathname();
  const [stats, setStats] = useState<StatRow[] | null>(null);
  const [error, setError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [myVote, setMyVote] = useState<VoteValue | null>(null);
  const [pendingVote, setPendingVote] = useState<VoteValue | null>(null);
  const [notice, setNotice] = useState<{ message: string; loginLink?: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: statRows, error: statErr }, { data: auth }] = await Promise.all([
      supabase.from("generation_vote_stats").select("*").eq("meme_id", memeId),
      supabase.auth.getUser(),
    ]);
    if (statErr) {
      setError(true);
      return;
    }
    setError(false);
    setStats(statRows ?? []);

    const user = auth.user;
    setUserId(user?.id ?? null);
    if (user) {
      const [{ data: profile }, { data: mine }] = await Promise.all([
        supabase.from("profiles").select("age_group").eq("id", user.id).single(),
        supabase
          .from("generation_votes")
          .select("vote, age_group")
          .eq("meme_id", memeId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (profile?.age_group) setAgeGroup(profile.age_group as AgeGroup);
      else if (mine?.age_group) setAgeGroup(mine.age_group as AgeGroup);
      if (mine?.vote) setMyVote(mine.vote as VoteValue);
    }
  }, [memeId]);

  useEffect(() => {
    // 비동기 데이터 페칭 후 setState — await 이후라 cascading render 아님(규칙 오탐)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flags.communityEnabled) void load();
  }, [load]);

  if (!flags.communityEnabled) {
    return (
      <CommunityGate
        title="세대별 투표는 곧 열려요"
        description="이 밈을 세대별로 얼마나 아는지, 곧 함께 투표할 수 있어요."
        showReactionHint={false}
      />
    );
  }

  function cast(vote: VoteValue, group: AgeGroup) {
    setNotice(null);
    startTransition(async () => {
      const res = await castGenerationVote({ memeId, ageGroup: group, vote });
      if (res.ok) {
        setMyVote(vote);
        setAgeGroup(group);
        setPendingVote(null);
        void load();
      } else {
        setNotice({ message: res.message, loginLink: res.error === "login_required" });
      }
    });
  }

  function handleVote(vote: VoteValue) {
    if (!userId) {
      setNotice({ message: "투표하려면 로그인이 필요해요.", loginLink: true });
      return;
    }
    if (!ageGroup) {
      setPendingVote(vote); // 연령대 미설정 → 그 자리에서 1회 질문
      return;
    }
    cast(vote, ageGroup);
  }

  // 세대별 집계
  const byGroup = new Map<AgeGroup, { total: number; know: number }>();
  for (const row of stats ?? []) {
    const g = row.age_group as AgeGroup | null;
    if (!g || !row.vote) continue;
    const cur = byGroup.get(g) ?? { total: 0, know: 0 };
    cur.total += row.cnt ?? 0;
    if (row.vote === "know" || row.vote === "use") cur.know += row.cnt ?? 0;
    byGroup.set(g, cur);
  }
  const groupsWithData = AGE_GROUPS.filter((g) => (byGroup.get(g.value)?.total ?? 0) > 0);

  return (
    <section aria-label="세대별 투표" className="space-y-4">
      <h2 className="text-lg font-bold">이 밈, 세대별로 얼마나 알까요?</h2>

      {/* 투표 버튼 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="내 투표">
        {VOTE_OPTIONS.map((opt) => {
          const selected = myVote === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleVote(opt.value)}
              disabled={isPending}
              aria-pressed={selected}
              className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-base font-semibold disabled:opacity-50 ${
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-foreground"
              }`}
            >
              {selected && <span aria-hidden className="mr-1">✓</span>}
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* 연령대 1회 질문 */}
      {pendingVote && (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-base font-semibold">어느 연령대이신가요?</p>
          <p className="mt-0.5 text-sm text-muted">딱 한 번만 여쭤봐요 — 세대별 집계에만 써요.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {AGE_GROUPS.map((g) => (
              <button
                key={g.value}
                type="button"
                disabled={isPending}
                onClick={() => cast(pendingVote, g.value)}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-base font-medium disabled:opacity-50"
              >
                {g.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPendingVote(null)}
            className="mt-2 inline-flex min-h-11 items-center px-2 text-sm text-muted"
          >
            다음에 할게요
          </button>
        </div>
      )}

      {notice && (
        <p role="alert" className="text-base" style={{ color: "var(--safety-red)" }}>
          {notice.message}
          {notice.loginLink && (
            <>
              {" "}
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="font-semibold underline underline-offset-2"
              >
                로그인하기
              </Link>
            </>
          )}
        </p>
      )}

      {/* 분포 — 로딩 */}
      {stats === null && !error && (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div role="alert" className="rounded-xl bg-surface-2 p-4 text-center">
          <p className="text-base text-muted">투표 현황을 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => {
              setStats(null);
              void load();
            }}
            className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 빈 상태 */}
      {stats !== null && !error && groupsWithData.length === 0 && (
        <p className="rounded-xl bg-surface-2 p-6 text-center text-base text-muted">
          아직 투표가 없어요. 첫 표를 던져보세요!
        </p>
      )}

      {/* 세대별 분포 */}
      {stats !== null && !error && groupsWithData.length > 0 && (
        <ul className="space-y-3">
          {groupsWithData.map((g) => {
            const agg = byGroup.get(g.value)!;
            if (agg.total < MIN_SAMPLE) {
              return (
                <li key={g.value} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-base font-medium">{g.label}</span>
                  <span className="text-base text-muted">
                    아직 표본이 부족해요 ({agg.total.toLocaleString("ko-KR")}표)
                  </span>
                </li>
              );
            }
            const pct = Math.round((agg.know / agg.total) * 100);
            return (
              <li key={g.value} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-base font-medium">{g.label}</span>
                <div
                  className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2"
                  role="img"
                  aria-label={`${g.label} ${pct}%가 알아요 (${agg.total.toLocaleString("ko-KR")}표)`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "var(--accent)" }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-base">
                  <strong>{pct}%</strong>
                  <span className="text-sm text-muted"> 알아요</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
