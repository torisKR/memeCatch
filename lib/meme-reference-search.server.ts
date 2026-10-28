import "server-only";
import { createStaticClient } from "@/lib/supabase/server";
import { searchMemes } from "@/lib/queries";
import { embedMemeQuery, semanticSearchEnabled } from "@/lib/meme-vector-lookup.server";
import { type MemeReference, type MemeReferenceResult } from "@/lib/meme-vectors";
import { classifyMemeIntent } from "@/lib/meme-intent.server";
import { canSendMemeIntent, type MemeIntentDecision } from "@/lib/meme-intent";
import { memeTitleKey } from "../scripts/meme-title-key.mjs";

function reference({ id, short_id, slug, title, summary }: MemeReference): MemeReference {
  return { id, short_id, slug, title, summary };
}

export async function searchMemeReferences(query: string, limit = 12, options?: {
  intentRouting?: boolean; locale?: string; signal?: AbortSignal;
}): Promise<MemeReferenceResult> {
  const q = query.trim();
  if (q.length < 2 || q.length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("invalid_reference_query");
  const active = () => { if (options?.signal?.aborted) throw new DOMException("Request cancelled", "AbortError"); };
  active();
  let keyword: MemeReference[] | undefined;
  let decision: MemeIntentDecision | undefined;
  if (options?.intentRouting && (!options.locale || options.locale === "ko")) {
    keyword = (await searchMemes(q, limit)).map(reference);
    active();
    const key = memeTitleKey(q);
    if (key && keyword.some(item => memeTitleKey(item.title) === key)) {
      return { mode: "keyword", items: keyword, decision: { intent: "lookup", source: "fallback", reason: "exact_match" } };
    }
    decision = await classifyMemeIntent({ query: q, locale: options.locale }, options.signal);
    active();
    if (!canSendMemeIntent(q) || ["lookup", "unclear", "out_of_scope"].includes(decision.intent)) {
      return { mode: "keyword", items: keyword, decision };
    }
  }
  const fallback = async (reason: MemeReferenceResult["reason"]): Promise<MemeReferenceResult> => ({
    mode: "keyword", reason, items: keyword ?? (await searchMemes(q, limit)).map(reference),
    ...(decision ? { decision } : {}),
  });
  if (!semanticSearchEnabled()) return fallback("disabled");
  const vector = await embedMemeQuery(q);
  active();
  if (!vector) return fallback("model_unavailable");
  try {
    // One RPC ranks bounded lexical/semantic candidates and returns only public metadata.
    const { data, error } = await createStaticClient().rpc("search_meme_references", {
      p_query: q, p_embedding: vector, p_limit: limit,
    });
    active();
    if (error || !data) return fallback("rpc_unavailable");
    if (!data.length) return fallback("index_empty");
    // The existing RPC already pins exact title/alias/chosung matches before RRF.
    // Prepending weak keyword matches here would consume limit and hide semantic hits.
    return { mode: "hybrid", items: data.map(reference), ...(decision ? { decision } : {}) };
  } catch { active(); return fallback("rpc_unavailable"); }
}
