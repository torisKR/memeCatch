import type { Metadata } from "next";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { PlusManager } from "@/components/admin/plus-manager";

export const metadata: Metadata = { title: "구독 관리" };

export default async function AdminSubscriptionsPage() {
  await requireOperatorPage("/admin/subscriptions");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Plus 구독 관리</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        이메일로 사용자의 MemeCatch Plus 상태를 확인하고, 결제 이메일 불일치·웹훅
        지연 등 지원 케이스에서 수동으로 Plus를 부여하거나 해제할 수 있어요.
      </p>
      <PlusManager />
    </div>
  );
}
