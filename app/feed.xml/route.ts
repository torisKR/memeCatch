import { memeFeedResponse } from "@/lib/meme-rss";

/** Request-time feed. A database-less build must not cache a failed export. */
export const dynamic = "force-dynamic";

/** Newly published, indexable memes. */
export function GET() {
  return memeFeedResponse("new");
}
