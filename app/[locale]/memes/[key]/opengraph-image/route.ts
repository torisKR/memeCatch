import { renderLegacyLocaleMemeOpenGraph } from "@/lib/legacy-locale-meme-opengraph";

type RouteContext = { params: Promise<{ locale: string; key: string }> };

// Translated locale detail HTML stays on its own page. This handler serves
// `/[locale]/memes/[key]/opengraph-image` for en, ja, zh, and zh-tw.
// `/ar/memes/*` is not a locale segment and stays unpublished.
export function GET(_request: Request, context: RouteContext) {
  return renderLegacyLocaleMemeOpenGraph(context);
}
