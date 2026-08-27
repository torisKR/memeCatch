import type { Metadata } from "next";

import { MemeStudioApp } from "@/components/studio/meme-studio-app";
import { isMemeStudioAiEnabled } from "@/lib/meme-studio.server";

export const metadata: Metadata = {
  title: "밈 스튜디오",
  description:
    "게시물 아이디어를 만들고, 내가 권리를 가진 이미지로 PNG 밈과 사전 카드를 출력합니다.",
  alternates: { canonical: "/studio" },
};

export default function StudioPage() {
  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-10">
        <header className="max-w-3xl">
          <p className="text-sm font-bold text-accent">밈 스튜디오</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            아이디어를 만들고, 내 콘텐츠로 출력하세요
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted sm:text-sm">
            두 작업 공간을 오가며 문구를 구상하고, 권리를 확인한 이미지로 PNG 밈과 사전 카드를 만들 수 있습니다.
          </p>
        </header>

        <MemeStudioApp aiEnabled={isMemeStudioAiEnabled()} />
      </div>
    </main>
  );
}
