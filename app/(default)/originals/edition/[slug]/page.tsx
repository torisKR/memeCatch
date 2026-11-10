import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OriginalEditionContent } from "@/components/originals-editorial/original-edition-content";
import {
  EDITORIAL_ORIGINALS,
  editorialOriginalPath,
  getEditorialOriginal,
  nextEditorialOriginal,
} from "@/lib/editorial-originals";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams(): Array<{ slug: string }> {
  return EDITORIAL_ORIGINALS.map((edition) => ({ slug: edition.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const edition = getEditorialOriginal(slug);
  if (!edition) notFound();
  const path = editorialOriginalPath(edition.slug);
  return {
    title: edition.title,
    description: edition.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: edition.title,
      description: edition.summary,
      siteName: "밈캐치",
      locale: "ko_KR",
      url: path,
    },
  };
}

export default async function OriginalEditionPage({ params }: Props) {
  const { slug } = await params;
  const edition = getEditorialOriginal(slug);
  if (!edition) notFound();
  const next = nextEditorialOriginal(edition.slug);

  return (
    <OriginalEditionContent
      edition={edition}
      next={next}
      shareUrl={`${SITE_URL}${editorialOriginalPath(edition.slug)}`}
    />
  );
}
