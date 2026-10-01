import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { CatalogRegistrationForm } from "@/components/admin/catalog-registration-form";

export const metadata = { title: "외부 밈 카탈로그 등록" };

export default async function AdminCatalogMemeNewPage() {
  await requireOperatorPage("/admin/memes/catalog/new");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/memes" className="text-base text-muted hover:text-foreground">← 밈 관리로</Link>
        <h1 className="mt-2 text-2xl font-bold">외부 밈 카탈로그 등록</h1>
      </div>
      <CatalogRegistrationForm />
    </div>
  );
}
