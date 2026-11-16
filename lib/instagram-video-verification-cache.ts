import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/db/cache-tags";

export function expireInstagramVideoVerificationCache() {
  revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
