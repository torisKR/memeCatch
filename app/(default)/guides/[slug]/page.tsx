import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdsenseScript } from "@/components/adsense-script";
import { GUIDES, getGuide } from "@/lib/guides";
import { koreanPageShare } from "@/lib/korean-share-metadata";

type Props = { params: Promise<{ slug: string }> };

const LINK = "text-accent-text underline underline-offset-2";

export function generateStaticParams(): { slug: string }[] {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return { title: "가이드를 찾을 수 없어요" };
  const pathname = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: pathname },
    ...koreanPageShare({ title: guide.title, description: guide.description, pathname }),
  };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();

  return (
    <main className="mx-auto max-w-site px-4 pb-16 pt-10">
      <AdsenseScript />
      <article className="max-w-3xl">
        <p className="text-sm">
          <Link href="/guides" className={LINK}>
            가이드
          </Link>
        </p>
        <h1 className="page-title mt-2">{guide.title}</h1>
        <p className="mt-2 text-sm text-muted">
          최종 수정: <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
        </p>
        <p className="page-lede">{guide.intro}</p>

        {guide.sections.map((section) => (
          <section key={section.heading} className="mt-12">
            <h2 className="text-xl font-bold">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-3 text-base leading-relaxed">
                {paragraph}
              </p>
            ))}
            {section.links && (
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-base">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {guide.sources.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold">참고한 자료</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
              {guide.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {source.title}
                  </a>{" "}
                  <span className="text-muted">— {source.publisher}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-base leading-relaxed text-muted">
          이 글은 밈캐치의{" "}
          <Link href="/editorial" className={LINK}>
            편집 원칙
          </Link>
          을 바탕으로 썼습니다. 틀린 내용을 발견하셨다면{" "}
          <Link href="/editorial#corrections" className={LINK}>
            정정 요청
          </Link>
          으로 알려 주세요.
        </p>
      </article>
    </main>
  );
}
