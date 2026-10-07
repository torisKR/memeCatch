import { isMemeCardId } from "@/lib/meme-collectible";
import { getMemeCollectibleCard } from "@/lib/meme-collectible.server";

export const runtime = "nodejs";

const REVEAL_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    if (!isMemeCardId(id)) {
      return Response.json({ error: "invalid_input" }, { status: 400, headers: REVEAL_HEADERS });
    }
    const card = await getMemeCollectibleCard(id);
    if (!card) {
      return Response.json({ error: "card_unavailable" }, { status: 404, headers: REVEAL_HEADERS });
    }
    return Response.json({ card }, { headers: REVEAL_HEADERS });
  } catch {
    return Response.json({ error: "cards_unavailable" }, { status: 503, headers: REVEAL_HEADERS });
  }
}
