import { renderLegacyLocaleMemeOpenGraph } from "@/lib/legacy-locale-meme-opengraph";

type RouteContext = { params: Promise<{ locale: string; key: string }> };

// Locale detail HTML stays on its own page. This handler only preserves
// the image URL main already served, including `/ar/memes/[key]/opengraph-image`.
export function GET(_request: Request, context: RouteContext) {
  return renderLegacyLocaleMemeOpenGraph(context);
}
