import Link from "next/link";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { HouseOriginalForm } from "@/components/admin/house-original-form";

export const metadata = { title: "자체 제작 등록" };

export default async function AdminHouseOriginalNewPage() {
  await requireOperatorPage("/admin/memes/new");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/memes" className="text-base text-muted hover:text-foreground">
          ← 밈 관리로
        </Link>
        <h1 className="mt-2 text-2xl font-bold">자체 제작 등록</h1>
      </div>
      <HouseOriginalForm />
    </div>
  );
}
