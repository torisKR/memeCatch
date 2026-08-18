import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { loadBrandWorkspace } from "@/lib/actions/brand-workspace";
import { BrandWorkspaceForms } from "./workspace-forms";

export const metadata: Metadata = {
  title: "브랜드 워크스페이스 | MemeCatch Plus",
  description: "브랜드 문맥과 밈 적합도, 승인 기록을 한곳에서 관리하세요.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BrandWorkspacePage() {
  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) redirect("/login?next=/premium/brand-workspace");
  if (!entitlement.isPremium) redirect("/pricing?from=brand-workspace");
  const bundle = await loadBrandWorkspace();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-accent-text">MemeCatch Plus</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">브랜드 워크스페이스</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          브랜드 기준을 저장하고 밈별 적합도를 검토한 뒤, 변경할 수 없는 승인·반려 기록을 남기세요.
        </p>
      </header>
      <BrandWorkspaceForms bundle={bundle} />
    </main>
  );
}
