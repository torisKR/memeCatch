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
  const tiktokImport = typeof sp.tiktokImport === "string" ? sp.tiktokImport : null;
  const imported = typeof sp.imported === "string" ? Number(sp.imported) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold">밈 제보하기</h1>
        <p className="mt-2 text-muted">
          처음 본 밈을 알려 주세요. 검토를 거쳐 24~48시간 안에 등록 여부를 알려드려요.
        </p>

        {/* 검수 프로세스 가시화 — 제보가 어떻게 처리되는지 (E-E-A-T 신뢰 신호) */}
        <ol
          className="instrument-grid mt-4 flex items-center gap-1.5 rounded-2xl border border-border px-2.5 py-2 text-[13px] font-medium text-muted"
          aria-label="검수 절차"
        >
          {["제보", "사실 확인", "저작권 확인", "공개"].map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-border">→</span>}
              <span
                className={
                  i === 0
                    ? "rounded-full border border-flame-500/70 bg-flame-500/10 px-2.5 py-1 font-semibold text-accent"
                    : "rounded-full bg-surface-2 px-2.5 py-1"
                }
              >
                {step}
              </span>
            </li>
          ))}
        </ol>

        <section className="mt-5 rounded-2xl border border-border bg-surface p-4">
          <p className="font-semibold">내 TikTok 공개 영상 가져오기</p>
          <p className="mt-1 text-sm text-muted">
            동의한 계정의 최신 공개 영상 최대 20개를 검수 대기로만 추가해요. 자동 공개하지 않아요.
          </p>
          <Link
            href="/auth/tiktok?import=1&next=/submit"
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            TikTok 영상 가져오기
          </Link>
          {tiktokImport === "done" && (
            <p className="mt-3 text-sm text-safety-green" role="status">
              {imported ? `${imported}개 영상을 검수 대기로 추가했어요.` : "새로 추가할 영상은 없어요."}
            </p>
          )}
          {tiktokImport === "failed" && (
            <p className="mt-3 text-sm text-safety-red" role="alert">
              영상을 가져오지 못했어요. TikTok에서 video.list 권한을 허용한 뒤 다시 시도해 주세요.
            </p>
          )}
        </section>

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
      </div>
    </main>
  );
}
