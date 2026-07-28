import type { Metadata } from "next";
import NotFound from "@/app/(default)/not-found";
import { SHARED_ROOT_METADATA } from "@/app/_root/metadata";
import "./globals.css";

export const metadata: Metadata = {
  ...SHARED_ROOT_METADATA,
  title: "페이지를 찾을 수 없어요 | 밈캐치",
  description: "요청한 밈캐치 페이지를 찾을 수 없습니다.",
};

/** Router-level fallback for an app that intentionally has multiple roots. */
export default function GlobalNotFound() {
  return (
    <html lang="ko" dir="ltr">
      <body className="theme-ink min-h-dvh bg-background text-foreground">
        <NotFound />
      </body>
    </html>
  );
}
