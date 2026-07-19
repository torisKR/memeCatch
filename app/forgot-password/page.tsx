import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "비밀번호 찾기",
  description: "가입한 이메일로 비밀번호 재설정 링크를 보내드려요.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">비밀번호 찾기</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        가입하신 이메일을 입력하면 비밀번호를 다시 설정할 수 있는 링크를
        보내드려요.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
