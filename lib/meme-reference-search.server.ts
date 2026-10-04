import "server-only";
import { createStaticClient } from "@/lib/supabase/server";
import { searchMemes } from "@/lib/queries";
import { embedMemeQuery, semanticSearchEnabled } from "@/lib/meme-vector-lookup.server";
import { type MemeReference, type MemeReferenceResult } from "@/lib/meme-vectors";

function reference({ id, short_id, slug, title, summary }: MemeReference): MemeReference {
  return { id, short_id, slug, title, summary };
}

export async function searchMemeReferences(query: string, limit = 12): Promise<MemeReferenceResult> {
  const q = query.trim();
  if (q.length < 2 || q.length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("invalid_reference_query");
  const fallback = async (reason: MemeReferenceResult["reason"]): Promise<MemeReferenceResult> => ({
    mode: "keyword", reason, items: (await searchMemes(q, limit)).map(reference),
  });
  if (!semanticSearchEnabled()) return fallback("disabled");
  const vector = await embedMemeQuery(q);
  if (!vector) return fallback("model_unavailable");
  try {
    // One RPC ranks bounded lexical/semantic candidates and returns only public metadata.
    const { data, error } = await createStaticClient().rpc("search_meme_references", {
      p_query: q, p_embedding: vector, p_limit: limit,
    });
    if (error || !data) return fallback("rpc_unavailable");
    if (!data.length) return fallback("index_empty");
    return { mode: "hybrid", items: data.map(reference) };
  } catch { return fallback("rpc_unavailable"); }
}
