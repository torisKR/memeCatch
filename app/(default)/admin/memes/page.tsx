import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { ModerationBadge, SafetyBadge } from "@/components/admin/badges";
import { LIFECYCLE_STATUS, MODERATION_STATUS } from "@/lib/labels";
import type { ModerationStatus } from "@/components/admin/constants";

export const metadata = { title: "밈 관리" };

const STATUS_FILTERS = Object.keys(MODERATION_STATUS) as ModerationStatus[];

export default async function AdminMemesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  // 방어심화 — 미들웨어와 별개로 페이지에서 operator 재검증
  const { supabase } = await requireOperatorPage("/admin/memes");
  const { q = "", status = "" } = await searchParams;

  let query = supabase
    .from("memes")
    .select("id, title, short_id, moderation_status, safety_level, lifecycle_status, trend_score, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  if (STATUS_FILTERS.includes(status as ModerationStatus)) {
    query = query.eq("moderation_status", status as ModerationStatus);
  }

  const { data: memes, error } = await query;
  if (error) throw new Error(`밈 목록을 불러오지 못했어요: ${error.message}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">밈 관리</h1>

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
          <p className="mt-1 text-base text-muted">검색어나 상태 필터를 바꿔 보세요.</p>
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
