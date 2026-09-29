import type { Metadata } from "next";
import Link from "next/link";
import { SubmitForm } from "@/components/submit-form";
import { flags } from "@/lib/flags";
import { getRequestLocale } from "@/lib/i18n-server";
import { SUBMIT_COPY } from "@/lib/i18n-submit";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    ...SUBMIT_COPY[locale].metadata,
    robots: { index: false, follow: false },
  };
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [sp, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const copy = SUBMIT_COPY[locale];
  const defaultName = typeof sp.name === "string" ? sp.name.slice(0, 100) : "";
  const tiktokImport =
    typeof sp.tiktokImport === "string" ? sp.tiktokImport : null;
  const imported = typeof sp.imported === "string" ? Number(sp.imported) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold">{copy.page.title}</h1>
        <p className="mt-2 text-muted">{copy.page.intro}</p>

        {/* 검수 프로세스 가시화 — 제보가 어떻게 처리되는지 (E-E-A-T 신뢰 신호) */}
        <ol
          className="instrument-grid mt-4 flex items-center gap-1.5 rounded-2xl border border-border px-2.5 py-2 text-[13px] font-medium text-muted"
          aria-label={copy.page.reviewProcess}
        >
          {copy.page.reviewSteps.map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-border">
                  →
                </span>
              )}
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
          <p className="font-semibold">{copy.page.tiktokTitle}</p>
          <p className="mt-1 text-sm text-muted">{copy.page.tiktokBody}</p>
          <Link
            href="/auth/tiktok?import=1&next=/submit"
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
          >
            {copy.page.tiktokAction}
          </Link>
          {tiktokImport === "done" && (
            <p className="mt-3 text-sm text-safety-green" role="status">
              {imported
                ? copy.page.tiktokDone(imported)
                : copy.page.tiktokEmpty}
            </p>
          )}
          {tiktokImport === "failed" && (
            <p className="mt-3 text-sm text-safety-red" role="alert">
              {copy.page.tiktokFailed}
            </p>
          )}
        </section>

        <div className="mt-6">
          {flags.submissionsOpen ? (
            <SubmitForm defaultName={defaultName} />
          ) : (
            <section className="rounded-2xl border border-border bg-surface p-6 text-center">
              <h2 className="text-xl font-bold">{copy.page.closedTitle}</h2>
              <p className="mt-2 text-muted">{copy.page.closedBody}</p>
              <Link
                href="/"
                className="mt-6 flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-base font-semibold"
              >
                {copy.page.home}
              </Link>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
