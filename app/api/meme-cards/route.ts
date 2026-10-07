import { getMemeCardCatalogPage } from "@/lib/meme-collectible.server";
import { parseMemeCardPageOptions } from "@/lib/meme-collectible";
import { cardApiError } from "./_response";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const options = parseMemeCardPageOptions(new URL(request.url).searchParams);
  if (!options) return Response.json({ error: "invalid_input" }, { status: 400, headers: { "cache-control": "no-store" } });
  try {
    const page = await getMemeCardCatalogPage(options);
    return Response.json(page, {
      headers: { "cache-control": "public, max-age=0, must-revalidate", "x-content-type-options": "nosniff" },
    });
  } catch (error) { return cardApiError(error); }
}
