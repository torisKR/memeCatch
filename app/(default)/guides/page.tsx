import type { Metadata } from "next";
import Link from "next/link";
import { AdsenseScript } from "@/components/adsense-script";
import { GUIDES } from "@/lib/guides";
import { koreanPageShare } from "@/lib/korean-share-metadata";

const DESCRIPTION =
  "밈을 쓰기 전에 알아 두면 좋은 것들 — 사용 신호 읽는 법, 단톡방 점검, 한국 밈의 시대 변화, 출처 확인, 숏폼 챌린지의 권리 문제를 정리한 밈캐치 가이드입니다. 실제 밈 문서와 함께 읽어 보세요.";

export const metadata: Metadata = {
  title: "가이드",
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  ...koreanPageShare({ title: "가이드", description: DESCRIPTION, pathname: "/guides" }),
};

export default function GuidesPage() {
  return (
    <main className="mx-auto max-w-site px-4 pb-16 pt-10">
      <AdsenseScript />
      <div className="max-w-3xl">
        <h1 className="page-title">밈캐치 가이드</h1>
        <p className="page-lede">
          사전을 만들며 정리한 기준과 경험을 긴 글로 풀었습니다. 밈의 뜻을 안 다음, 실제로 쓰기 전에
          읽어 두면 좋은 글들입니다.
        </p>
        <ul className="mt-10 space-y-6">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <h2 className="text-xl font-bold">
                <Link
                  href={`/guides/${guide.slug}`}
                  className="underline decoration-transparent underline-offset-4 hover:decoration-current"
                >
                  {guide.title}
                </Link>
              </h2>
              <p className="mt-1.5 text-base leading-relaxed text-muted">{guide.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
