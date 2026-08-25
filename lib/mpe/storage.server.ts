import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const MPE_STORAGE_BUCKET = "mpe-temporary";

function validateStorageKey(key: string): string {
  const parts = key.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("invalid_storage_key");
  return key;
}

export async function putTemporaryMedia(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const { error } = await createAdminClient().storage
    .from(MPE_STORAGE_BUCKET)
    .upload(validateStorageKey(key), body, { contentType, upsert: false });
  if (error) throw new Error("storage_put_failed");
}

export async function getTemporaryMedia(key: string): Promise<ArrayBuffer> {
  const { data, error } = await createAdminClient().storage
    .from(MPE_STORAGE_BUCKET)
    .download(validateStorageKey(key));
  if (error || !data) throw new Error("storage_get_failed");
  return data.arrayBuffer();
}

export async function deleteTemporaryMedia(key: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(MPE_STORAGE_BUCKET).remove([validateStorageKey(key)]);
  if (error) throw new Error("storage_delete_failed");
}

export async function recordTemporaryCleanupFailure(key: string, userId: string): Promise<void> {
  validateStorageKey(key);
  const { error } = await createAdminClient().from("admin_audit_log").insert({
    actor_id: userId,
    action: "mpe_upload_orphan_cleanup_failed",
    entity_type: "storage_object",
    entity_id: key,
    detail: { bucket: MPE_STORAGE_BUCKET },
  });
  if (error) throw new Error("cleanup_failure_record_failed");
}
