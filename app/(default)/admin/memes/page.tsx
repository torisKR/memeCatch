import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { ModerationBadge, SafetyBadge } from "@/components/admin/badges";
import { LIFECYCLE_STATUS, MODERATION_STATUS, type SafetyLevel } from "@/lib/labels";
import type { ModerationStatus } from "@/components/admin/constants";
import {
  ADMIN_UNSOURCED_FOCUS,
  ADMIN_UNSOURCED_OVERFETCH,
  parseAdminMemeFocus,
  rankUnsourcedQualityQueue,
} from "@/lib/admin-quality-queue";

export const metadata = { title: "밈 관리" };

const STATUS_FILTERS = Object.keys(MODERATION_STATUS) as ModerationStatus[];
const MEME_LIST_COLUMNS =
  "id, title, short_id, moderation_status, safety_level, lifecycle_status, trend_score, updated_at";

export default async function AdminMemesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; focus?: string }>;
}) {
  const { q = "", status = "", focus: focusRaw } = await searchParams;
  const { supabase } = await requireOperatorPage("/admin/memes", {
    q,
    status,
    focus: focusRaw,
  });
  const focus = parseAdminMemeFocus(focusRaw);
  const qualityQueue = focus === ADMIN_UNSOURCED_FOCUS;

  let memes:
    | Array<{
        id: string;
        title: string;
        short_id: string;
        moderation_status: string;
        safety_level: SafetyLevel;
        lifecycle_status: keyof typeof LIFECYCLE_STATUS;
        trend_score: number;
      }>
    | null = null;
  let error: { message: string } | null = null;

  if (qualityQueue) {
    let query = supabase
      .from("memes")
      .select(`${MEME_LIST_COLUMNS}, meme_sources(source_url)`)
      .in("moderation_status", ["approved", "limited"])
      .order("trend_score", { ascending: false })
      .limit(ADMIN_UNSOURCED_OVERFETCH);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    if (STATUS_FILTERS.includes(status as ModerationStatus)) {
      query = query.eq("moderation_status", status as ModerationStatus);
    }
    const result = await query;
    error = result.error;
    memes = rankUnsourcedQualityQueue(result.data ?? []);
  } else {
    let query = supabase
      .from("memes")
      .select(MEME_LIST_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    if (STATUS_FILTERS.includes(status as ModerationStatus)) {
      query = query.eq("moderation_status", status as ModerationStatus);
    }
    const result = await query;
    error = result.error;
    memes = result.data;
  }

  if (error) throw new Error(`밈 목록을 불러오지 못했어요: ${error.message}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">밈 관리</h1>
        <Link
          href="/admin/memes/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-4 text-base font-semibold text-white"
        >
          자체 제작 등록
        </Link>
      </div>

      {qualityQueue && (
        <p className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed">
          공개 문서 중 근거 출처 URL이 없는 항목을 트렌드 점수 순으로 보여 줍니다.
          데이터는 읽기만 하며 자동 공개하지 않습니다.
        </p>
      )}

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <label className="block grow sm:max-w-xs">
          <span className="mb-1 block text-base font-medium">검색</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="제목으로 검색"
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">검수 상태</span>
          <select
            name="status"
            defaultValue={status}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base"
          >
            <option value="">전체</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {MODERATION_STATUS[s].admin}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base font-medium">품질 큐</span>
          <select
            name="focus"
            defaultValue={focus ?? ""}
            className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base"
          >
            <option value="">최근 수정</option>
            <option value={ADMIN_UNSOURCED_FOCUS}>무출처 공개 문서</option>
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white"
        >
          적용
        </button>
      </form>

      {!memes || memes.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-lg font-semibold">조건에 맞는 밈이 없어요</p>
          <p className="mt-1 text-base text-muted">
            {qualityQueue
              ? "무출처 공개 문서가 없거나, 검색어·상태 필터를 바꿔 보세요."
              : "검색어나 상태 필터를 바꿔 보세요."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-left text-base">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-4 py-3 font-medium">제목</th>
                <th className="px-4 py-3 font-medium">검수 상태</th>
                <th className="px-4 py-3 font-medium">신호등</th>
                <th className="px-4 py-3 font-medium">생명주기</th>
                <th className="px-4 py-3 font-medium">트렌드 점수</th>
              </tr>
            </thead>
            <tbody>
              {memes.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/memes/${m.id}`}
                      className="flex min-h-11 items-center font-semibold text-accent-text underline-offset-2 hover:underline"
                    >
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ModerationBadge status={m.moderation_status as ModerationStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <SafetyBadge level={m.safety_level} />
                  </td>
                  <td className="px-4 py-3">{LIFECYCLE_STATUS[m.lifecycle_status].user}</td>
                  <td className="px-4 py-3 tabular-nums">{m.trend_score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
