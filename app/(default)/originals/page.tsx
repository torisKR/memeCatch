import type { Metadata } from "next";
import Link from "next/link";
import {
  EDITORIAL_ORIGINALS,
  editorialOriginalPath,
} from "@/lib/editorial-originals";
import { koreanPageShare } from "@/lib/korean-share-metadata";

export const metadata: Metadata = {
  title: "오리지널 밈",
  description: "밈캐치가 직접 만든 일러스트와 이야기.",
  alternates: { canonical: "/originals" },
  ...koreanPageShare({
    title: "오리지널 밈",
    description: "밈캐치가 직접 만든 일러스트와 이야기.",
    pathname: "/originals",
  }),
};

export default function OriginalsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl bg-[#f3f2ed] px-4 py-12 text-[#18181a]">
      <p className="text-sm font-bold tracking-wide text-[#a52b13]">MEMECATCH ORIGINALS</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-balance [word-break:keep-all]">
        우리가 직접 만든 밈을 한곳에서
      </h1>
      <ul className="mt-8 grid gap-3">
        {EDITORIAL_ORIGINALS.map((edition) => (
          <li key={edition.slug}>
            <Link
              href={editorialOriginalPath(edition.slug)}
              className="block rounded-2xl border border-[#18181a] bg-[#fffaf4] p-4 text-base leading-7"
            >
              <span className="block font-black">{edition.title}</span>
              <span className="mt-1 block">{edition.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
