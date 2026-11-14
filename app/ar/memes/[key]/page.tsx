import { generateMetadata as generateLocaleMetadata, default as LocaleMemePage } from "@/app/[locale]/memes/[key]/page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ key: string }> };

/** `/ar` is not a locale segment (`dynamicParams` is false). This static route is the Arabic meme share. */
export async function generateMetadata({ params }: Props) {
  const { key } = await params;
  return generateLocaleMetadata({ params: Promise.resolve({ locale: "ar", key }) });
}

export default async function ArabicMemePage({ params }: Props) {
  const { key } = await params;
  return LocaleMemePage({ params: Promise.resolve({ locale: "ar", key }) });
}
