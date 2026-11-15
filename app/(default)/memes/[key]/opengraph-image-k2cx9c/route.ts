import { renderLegacyKoreanMemeOpenGraph } from "@/lib/legacy-korean-meme-opengraph";

type RouteContext = { params: Promise<{ key: string }> };

// The metadata file inside `(default)` published this exact suffix:
// djb2(`/(default)/memes/[key]`).toString(36).slice(0, 6) === "k2cx9c".
// A route handler keeps that URL without adding og:image metadata.
export function GET(_request: Request, context: RouteContext) {
  return renderLegacyKoreanMemeOpenGraph(context);
}
