import type { Metadata } from "next";
import AdminLayout from "@/app/(default)/admin/layout";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "관리자 콘솔", template: "%s | 밈캐치 관리자" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PrivateAdminDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="theme-ink bg-background text-foreground">
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}
