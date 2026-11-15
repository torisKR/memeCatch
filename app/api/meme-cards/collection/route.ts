import { createClient } from "@/lib/supabase/server";
import { parseMemeCardIds, parseMemeCardPageOptions } from "@/lib/meme-collectible";
import { getMemeCardAuthenticatedUser, getMemeCardCollectionPage, getOwnedMemeCardIds } from "@/lib/meme-collectible.server";
import { cardApiError, PRIVATE_CARD_HEADERS } from "../_response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const idsValue = params.get("cardIds");
  const ids = idsValue === null ? null : parseMemeCardIds(idsValue);
  const options = idsValue === null ? parseMemeCardPageOptions(params) : null;
  if ((!options && !ids) || (ids && (params.size !== 1 || params.getAll("cardIds").length !== 1))) {
    return Response.json({ error: "invalid_input" }, { status: 400, headers: PRIVATE_CARD_HEADERS });
  }
  try {
    const client = await createClient();
    const user = await getMemeCardAuthenticatedUser(client);
    const result = ids ? { ownedCardIds: await getOwnedMemeCardIds(client, user.id, ids) }
      : await getMemeCardCollectionPage(client, user.id, options!);
    return Response.json(result, { headers: PRIVATE_CARD_HEADERS });
  } catch (error) { return cardApiError(error); }
}
