import "server-only";
import {
  canSendMemeIntent,
  fallbackMemeIntent,
  type MemeIntentDecision,
  type MemeIntentReason,
} from "@/lib/meme-intent";

/**
 * Returns a bounded local routing hint. It never calls a model or external service,
 * and it never establishes meme facts, ranking, safety, or publication status.
 */
export async function classifyMemeIntent(
  input: { query: string; locale?: string },
  signal?: AbortSignal,
): Promise<MemeIntentDecision> {
  const query = input.query.normalize("NFKC").trim();
  const decision = (reason: MemeIntentReason): MemeIntentDecision => ({
    intent: fallbackMemeIntent(query),
    source: "fallback",
    reason,
  });

  if (signal?.aborted) return decision("aborted");
  if ((input.locale ?? "ko") !== "ko") return decision("unsupported_locale");
  if (!canSendMemeIntent(query)) return decision("input_not_sent");
  return decision("local_only");
}
