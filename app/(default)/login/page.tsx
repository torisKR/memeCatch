import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "로그인",
  description: "로그인하면 밈을 저장하고 직접 제보할 수 있어요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const callbackError = sp.error === "auth";
  const initialMode = sp.tab === "signup" ? "signup" : "login";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mx-auto grid w-full max-w-md overflow-hidden rounded-3xl lg:max-w-4xl lg:grid-cols-[0.85fr_1.15fr] lg:border lg:border-border lg:bg-surface">
        {/* 브랜드 비주얼 패널(lg+) — 키 비주얼 세로판. 폼 흐름과 무관한 장식 */}
        <div aria-hidden className="relative hidden lg:block">
          <img
            src="/brand/login-signal.webp"
            alt=""
            width={1024}
            height={1536}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-x-6 bottom-6 border-l-2 border-(--flame-400) pl-3">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Save / Submit / Catch first
            </p>
            <p className="mt-1 text-lg font-bold leading-snug text-white">
              저장하고, 제보하고, 가장 먼저 캐치하세요.
            </p>
          </div>
        </div>

        <div className="lg:p-8">
          <LoginForm
            next={next}
            callbackError={callbackError}
            initialMode={initialMode}
          />
        </div>
      </div>
    </main>
  );
}
