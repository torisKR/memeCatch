import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/submit-form";
import { flags } from "@/lib/flags";

export const metadata: Metadata = {
  title: "밈 제보",
  description: "처음 본 밈을 알려 주세요. 검토 후 밈캐치에 등록돼요.",
};

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const defaultName = typeof sp.name === "string" ? sp.name.slice(0, 100) : "";

  return (
    <main className="mx-auto w-full max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold">밈 제보하기</h1>
      <p className="mt-2 text-muted">
        처음 본 밈을 알려 주세요. 검토를 거쳐 24~48시간 안에 등록 여부를 알려드려요.
      </p>

      {/* 검수 프로세스 가시화 — 제보가 어떻게 처리되는지 (E-E-A-T 신뢰 신호) */}
      <ol className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-muted" aria-label="검수 절차">
        {["제보", "사실 확인", "저작권 확인", "공개"].map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-border">→</span>}
            <span className="rounded-full bg-surface-2 px-2.5 py-1">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {flags.submissionsOpen ? (
          <SubmitForm defaultName={defaultName} />
        ) : (
          <section className="rounded-2xl border border-border bg-surface p-6 text-center">
            <h2 className="text-xl font-bold">제보 준비 중이에요</h2>
            <p className="mt-2 text-muted">
              지금은 제보를 받지 않아요. 준비가 끝나면 바로 열어드릴게요.
            </p>
            <Link
              href="/"
              className="mt-6 flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-base font-semibold"
            >
              홈으로 돌아가기
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
