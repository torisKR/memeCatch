import type { Metadata } from "next";
import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { listUsers } from "@/lib/actions/admin-users";

export const metadata: Metadata = { title: "사용자 관리" };
export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("ko-KR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
      });
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireOperatorPage("/admin/users");
  const { q } = await searchParams;
  const res = await listUsers({ query: q });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">사용자 관리</h1>
      <p className="mt-1.5 text-sm text-muted">
        계정 정보·비밀번호·Plus 구독·결제 이력을 사용자별로 관리해요.
      </p>

      <form method="get" className="mt-5 flex gap-2">
        <label htmlFor="user-q" className="sr-only">
          이메일 또는 닉네임 검색
        </label>
        <input
          id="user-q"
          name="q"
          defaultValue={q ?? ""}
          placeholder="이메일 또는 닉네임 검색"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20"
        />
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white active:scale-[0.97]"
        >
          검색
        </button>
      </form>

      {!res.ok ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-safety-red-bg px-4 py-3 text-sm font-semibold text-safety-red"
        >
          {res.error}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {res.data?.length ?? 0}명
            {q ? ` · "${q}" 검색 결과` : ""}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-3 font-semibold">이메일</th>
                  <th className="py-2 pr-3 font-semibold">닉네임</th>
                  <th className="py-2 pr-3 font-semibold">권한</th>
                  <th className="py-2 pr-3 font-semibold">Plus</th>
                  <th className="py-2 pr-3 font-semibold">가입</th>
                  <th className="py-2 font-semibold">최근 로그인</th>
                </tr>
              </thead>
              <tbody>
                {(res.data ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-border">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-semibold text-accent-text hover:text-accent"
                      >
                        {u.email ?? "(이메일 없음)"}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">{u.nickname ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      {u.role === "operator" ? (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-text">
                          운영자
                        </span>
                      ) : (
                        <span className="text-muted">일반</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {u.isPremium ? (
                        <span className="rounded-full bg-safety-green-bg px-2 py-0.5 text-xs font-bold text-safety-green">
                          Plus
                        </span>
                      ) : (
                        <span className="text-muted">무료</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted">
                      {fmt(u.createdAt)}
                    </td>
                    <td className="py-2.5 tabular-nums text-muted">
                      {fmt(u.lastSignInAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
