import type { MemeIntentDecision } from "@/lib/meme-intent";

export const MEME_VECTOR_PROFILE = "multilingual-e5-small-v1";
export const MEME_VECTOR_DIMENSIONS = 384;
export type MemeReference = { id: string; short_id: string; slug: string; title: string; summary: string };
export type MemeReferenceResult = {
  mode: "hybrid" | "keyword";
  reason?: "disabled" | "model_unavailable" | "index_empty" | "rpc_unavailable";
  items: MemeReference[];
  decision?: MemeIntentDecision;
};

export function isMemeVector(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== MEME_VECTOR_DIMENSIONS
    || !value.every((item) => typeof item === "number" && Number.isFinite(item))) return false;
  const norm = Math.hypot(...value);
  return norm >= 0.99 && norm <= 1.01;
}

/** Reciprocal rank fusion combines rankings without equating their different scores. */
export function fuseMemeRanks<T extends { id: string }>(keyword: T[], semantic: T[], limit: number): T[] {
  const rows = new Map<string, { item: T; score: number; position: number }>();
  for (const ranking of [keyword, semantic]) {
    const seen = new Set<string>();
    ranking.forEach((item, index) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      const current = rows.get(item.id) ?? { item, score: 0, position: rows.size };
      current.score += 1 / (60 + index + 1);
      rows.set(item.id, current);
    });
  }
  return [...rows.values()].sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit).map(({ item }) => item);
}
