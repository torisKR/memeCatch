import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminWebMcpTools } from "@/components/webmcp/admin-tools";

export const metadata: Metadata = {
  title: { default: "관리자 콘솔", template: "%s | 밈캐치 관리자" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground md:flex">
      <AdminWebMcpTools />
      {/* 데스크톱 사이드바 / 모바일 상단 내비게이션 */}
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="text-lg font-bold">밈캐치 관리자</span>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
