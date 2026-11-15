import { createClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/origin";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";
import { isMemeCardId } from "@/lib/meme-collectible";
import { claimMemeCollectibleCard, getMemeCardAuthenticatedUser } from "@/lib/meme-collectible.server";
import { cardApiError, PRIVATE_CARD_HEADERS } from "../_response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403, headers: PRIVATE_CARD_HEADERS });
  let body: unknown;
  try { body = await readBoundedJson(request, 1024); }
  catch (error) {
    return Response.json({ error: error instanceof RequestBodyTooLargeError ? "body_too_large" : "invalid_input" }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers: PRIVATE_CARD_HEADERS,
    });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)
    || Object.keys(body).length !== 1 || !("cardId" in body) || !isMemeCardId(body.cardId)) {
    return Response.json({ error: "invalid_input" }, { status: 400, headers: PRIVATE_CARD_HEADERS });
  }
  try {
    const client = await createClient();
    const user = await getMemeCardAuthenticatedUser(client);
    const result = await claimMemeCollectibleCard(client, user.id, body.cardId);
    return Response.json(result, { headers: PRIVATE_CARD_HEADERS });
  } catch (error) { return cardApiError(error); }
}
