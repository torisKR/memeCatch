import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ImageListing = { id: string; owner_id?: string; image_path: string; moderation_status: "pending" | "approved" | "rejected" };
type ImageDb = {
  from(name: "creator_products"): {
    select(columns: string): {
      eq(column: "id", value: string): {
        maybeSingle(): Promise<{ data: ImageListing | null; error: { message: string } | null }>;
      };
    };
  };
  rpc(name: "is_operator"): Promise<{ data: boolean | null; error: { message: string } | null }>;
};

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  const db = client as unknown as ImageDb;
  const columns = user ? "id,owner_id,image_path,moderation_status" : "id,image_path,moderation_status";
  const { data: listing, error } = await db.from("creator_products").select(columns).eq("id", id).maybeSingle();
  if (error || !listing) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  if (listing.moderation_status !== "approved" && listing.owner_id !== user?.id) {
    if (!user) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
    const { data: operator } = await db.rpc("is_operator");
    if (operator !== true) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const objectPath = listing.image_path.replace(/^creator-products\//, "");
  const extension = objectPath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = IMAGE_CONTENT_TYPES[extension];
  if (!contentType) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });

  const { data, error: storageError } = await createAdminClient().storage.from("creator-products").download(objectPath);
  if (storageError || !data) return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  return new Response(data, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
