import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperatorPage } from "@/app/admin/require-operator";
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

function won(n: number | null): string {
  return n == null ? "—" : `₩${n.toLocaleString("ko-KR")}`;
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
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              u.isPremium
                ? "bg-safety-green-bg text-safety-green"
                : "bg-safety-gray-bg text-safety-gray"
            }`}
          >
            {u.isPremium ? "Plus 활성" : "무료"}
          </span>
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
          <dt className="text-muted">결제 이메일 연결</dt>
          <dd className="text-right font-semibold">
            {u.hasBillingIdentity ? "연결됨" : "미연결"}
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
          isPremium={u.isPremium}
        />
      </div>

      {/* 구독 내역 */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold">구독 내역</h2>
        {u.subscriptions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">구독 기록이 없어요.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-3 font-semibold">주문</th>
                  <th className="py-2 pr-3 font-semibold">상태</th>
                  <th className="py-2 pr-3 font-semibold">금액</th>
                  <th className="py-2 pr-3 font-semibold">유효기간</th>
                  <th className="py-2 font-semibold">구분</th>
                </tr>
              </thead>
              <tbody>
                {u.subscriptions.map((s) => (
                  <tr key={s.orderId} className="border-b border-border">
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {s.orderId}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold">{s.status}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {won(s.amount)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted">
                      {fmt(s.currentPeriodEnd)}
                    </td>
                    <td className="py-2.5">
                      {s.isManual ? "수동 부여" : "결제"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 결제 이력 */}
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold">결제 이력</h2>
        <p className="mt-1 text-sm text-muted">
          Latpeed 웹훅으로 수신한 결제 이벤트예요. 처리 오류가 있으면 사유가
          함께 보여요.
        </p>
        {u.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">결제 이벤트가 없어요.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-3 font-semibold">발생</th>
                  <th className="py-2 pr-3 font-semibold">주문</th>
                  <th className="py-2 pr-3 font-semibold">상태</th>
                  <th className="py-2 pr-3 font-semibold">금액</th>
                  <th className="py-2 font-semibold">처리</th>
                </tr>
              </thead>
              <tbody>
                {u.payments.map((p) => (
                  <tr key={p.id} className="border-b border-border">
                    <td className="py-2.5 pr-3 tabular-nums text-muted">
                      {fmt(p.occurredAt ?? p.receivedAt)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {p.orderId}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold">{p.status}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {won(p.amount)}
                    </td>
                    <td className="py-2.5">
                      {p.processingError ? (
                        <span className="font-semibold text-safety-red">
                          {p.processingError}
                        </span>
                      ) : p.processedAt ? (
                        <span className="text-safety-green">완료</span>
                      ) : (
                        <span className="text-muted">대기</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
