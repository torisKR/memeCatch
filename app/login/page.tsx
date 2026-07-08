import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인",
  description: "로그인하면 밈을 저장하고 직접 제보할 수 있어요.",
};

/** 내부 경로만 허용 (open redirect 방지) */
function safeNext(raw: string | string[] | undefined): string {
  const next = typeof raw === "string" ? raw : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const callbackError = sp.error === "auth";

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <LoginForm next={next} callbackError={callbackError} />
    </main>
  );
}
