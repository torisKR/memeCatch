import { memeFeedResponse } from "@/lib/meme-rss";

/** Request-time feed. A database-less build must not cache a failed export. */
export const dynamic = "force-dynamic";

/** Indexable memes whose body changed most recently. */
export function GET() {
  return memeFeedResponse("updated");
}
