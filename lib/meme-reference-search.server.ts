import "server-only";
import { createStaticClient } from "@/lib/supabase/server";
import { searchMemes } from "@/lib/queries";
import { embedMemeQuery, semanticSearchEnabled } from "@/lib/meme-vector-lookup.server";
import { fuseMemeRanks, type MemeReference, type MemeReferenceResult } from "@/lib/meme-vectors";

export async function searchMemeReferences(query: string, limit = 12): Promise<MemeReferenceResult> {
  const q = query.trim();
  if (q.length < 2 || q.length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("invalid_reference_query");
  const keywordPromise = searchMemes(q, limit);
  const vector = semanticSearchEnabled() ? await embedMemeQuery(q) : null;
  const keyword = (await keywordPromise).map(({ id, short_id, slug, title, summary }) => ({ id, short_id, slug, title, summary }));
  if (!vector) return { mode: "keyword", reason: semanticSearchEnabled() ? "model_unavailable" : "disabled", items: keyword };
  try {
    const client = createStaticClient();
    const { data: matches, error } = await client.rpc("match_meme_embeddings", { p_embedding: vector, p_limit: limit });
    if (error || !matches) return { mode: "keyword", reason: "rpc_unavailable", items: keyword };
    if (!matches.length) return { mode: "keyword", reason: "index_empty", items: keyword };
    const { data, error: rowError } = await client.from("memes").select("id,short_id,slug,title,summary")
      .in("id", matches.map((row) => row.meme_id)).in("moderation_status", ["approved", "limited"]);
    if (rowError || !data) return { mode: "keyword", reason: "rpc_unavailable", items: keyword };
    const byId = new Map<string, MemeReference>(data.map((row) => [row.id, row]));
    const semantic = matches.flatMap(({ meme_id }) => byId.has(meme_id) ? [byId.get(meme_id)!] : []);
    return semantic.length ? { mode: "hybrid", items: fuseMemeRanks(keyword, semantic, limit) }
      : { mode: "keyword", reason: "index_empty", items: keyword };
  } catch { return { mode: "keyword", reason: "rpc_unavailable", items: keyword }; }
}
