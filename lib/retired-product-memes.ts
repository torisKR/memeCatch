import { getTrendingMemes, type MemeListItem } from "@/lib/queries";

/** Four popular/trending memes. Empty when the catalog cannot be read. */
export async function loadRetiredProductMemes(): Promise<MemeListItem[]> {
  const memes = await getTrendingMemes(4);
  return memes.slice(0, 4);
}
