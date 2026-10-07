import { MemeCardServiceError } from "@/lib/meme-collectible.server";

export const PRIVATE_CARD_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};

export function cardApiError(error: unknown): Response {
  return Response.json(
    { error: error instanceof MemeCardServiceError ? error.code : "cards_unavailable" },
    { status: error instanceof MemeCardServiceError ? error.status : 503, headers: PRIVATE_CARD_HEADERS },
  );
}
