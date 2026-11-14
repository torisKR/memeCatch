import { loadKoreanShareCard } from "@/lib/meme-share-content";
import { renderMemeShareCard, respondWithShareCard } from "@/lib/meme-share-card";

export const alt = "밈캐치 밈 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Live `/memes/bjk2021k-bun-jo-ka/opengraph-image-k2cx9c` matched
 * `/memes/not-a-real-meme/...` (sha256 968643504db6…). The handler read only
 * `memes.short_id`. Curated seed ids are not catalog rows, so the null row
 * painted the same "밈캐치 / 그 밈, 3초 안에 알려드려요" card. `x85wgk74` is a
 * real row, so 파이팅 was unique. There is no hex/length gate: `bjk2021k` and
 * `okk2020k` parse, then miss the table. Lookup now follows the page
 * (database row, else curated short id, else slug suffix such as `bun-jo-ka`).
 */
export async function renderLegacyKoreanMemeOpenGraph({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  try {
    return await respondWithShareCard("ko", await loadKoreanShareCard(key));
  } catch {
    return respondWithShareCard("ko", null, renderMemeShareCard, "short");
  }
}
