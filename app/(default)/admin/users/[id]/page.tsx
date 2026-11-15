import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { getUserDetail } from "@/lib/actions/admin-users";
import { UserControls } from "@/components/admin/user-controls";

export const metadata: Metadata = { title: "사용자 상세" };
export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOperatorPage("/admin/users");
  const { id } = await params;
  const res = await getUserDetail(id);
  if (!res.ok || !res.data) notFound();
  const u = res.data;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/users"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-accent"
      >
        ← 사용자 목록
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {u.email ?? "(이메일 없음)"}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">{u.id}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {u.role === "operator" && (
            <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent-text">
              운영자
            </span>
          )}
        </div>
      </div>

      {/* 계정 정보 */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold">계정 정보</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-muted">닉네임</dt>
          <dd className="text-right font-semibold">{u.nickname ?? "—"}</dd>
          <dt className="text-muted">로그인 방식</dt>
          <dd className="text-right font-semibold">{u.provider ?? "—"}</dd>
          <dt className="text-muted">가입일</dt>
          <dd className="text-right font-semibold tabular-nums">
            {fmt(u.createdAt)}
          </dd>
          <dt className="text-muted">최근 로그인</dt>
          <dd className="text-right font-semibold tabular-nums">
            {fmt(u.lastSignInAt)}
          </dd>
          <dt className="text-muted">연령대</dt>
          <dd className="text-right font-semibold">{u.ageGroup ?? "—"}</dd>
          <dt className="text-muted">신뢰도</dt>
          <dd className="text-right font-semibold tabular-nums">
            {u.trustScore ?? "—"}
          </dd>
          <dt className="text-muted">관심 카테고리</dt>
          <dd className="text-right font-semibold">
            {u.interests?.length ? u.interests.join(", ") : "—"}
          </dd>
        </dl>
      </section>

      {/* 변경 컨트롤 */}
      <div className="mt-6">
        <UserControls
          userId={u.id}
          email={u.email}
          role={u.role}
        />
      </div>
    </div>
  );
}
