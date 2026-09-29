import "server-only";
import { createClient, createStaticClient } from "@/lib/supabase/server";
import {
  validateCreatorProductInput,
  type CreatorProduct,
  type CreatorProductInput,
  type PublicCreatorProduct,
} from "./index";

type DbError = { message: string } | null;
type CreatorDb = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DbError }>;
  from(name: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        order(column: string, options: { ascending: boolean }): Promise<{ data: CreatorProduct[] | null; error: DbError }>;
      };
    };
  };
};
const asCreatorDb = (client: unknown) => client as CreatorDb;

export type CreatorActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function signedIn() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return user ? { client: asCreatorDb(client), user } : null;
}

export async function submitCreatorProduct(input: CreatorProductInput): Promise<CreatorActionResult<{ id: string }>> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "로그인이 필요해요." };
  const parsed = validateCreatorProductInput(input, session.user.id);
  if (!parsed.ok) return parsed;
  const { data, error } = await session.client.rpc("creator_product_submit", {
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_external_url: parsed.data.externalUrl,
    p_image_path: parsed.data.imagePath,
    p_price: parsed.data.price,
    p_category: parsed.data.category,
    p_relationship_disclosure: parsed.data.relationshipDisclosure,
    p_rights_accepted: true,
  });
  if (error?.message.includes("api_rate_limited")) {
    return { ok: false, error: "오늘 등록 가능한 상품 수를 초과했어요. 내일 다시 시도해 주세요." };
  }
  if (error || typeof data !== "string") return { ok: false, error: "상품 등록에 실패했어요. 잠시 후 다시 시도해 주세요." };
  return { ok: true, data: { id: data } };
}

export async function updateCreatorProduct(id: string, input: CreatorProductInput): Promise<CreatorActionResult> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "로그인이 필요해요." };
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "상품을 찾을 수 없어요." };
  }
  const parsed = validateCreatorProductInput(input, session.user.id);
  if (!parsed.ok) return parsed;
  const { error } = await session.client.rpc("creator_product_update", {
    p_id: id,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_external_url: parsed.data.externalUrl,
    p_image_path: parsed.data.imagePath,
    p_price: parsed.data.price,
    p_category: parsed.data.category,
    p_relationship_disclosure: parsed.data.relationshipDisclosure,
    p_rights_accepted: true,
  });
  if (error) return { ok: false, error: "상품을 수정하지 못했어요. 본인 상품인지 확인해 주세요." };
  return { ok: true };
}

export async function moderateCreatorProduct(
  id: string,
  decision: "approved" | "rejected",
  reason: string,
): Promise<CreatorActionResult> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "로그인이 필요해요." };
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
      (decision !== "approved" && decision !== "rejected") || typeof reason !== "string") {
    return { ok: false, error: "검토 요청을 확인해 주세요." };
  }
  const { data: isOperator, error: authError } = await (session.client as unknown as {
    rpc(name: "is_operator"): Promise<{ data: boolean | null; error: DbError }>;
  }).rpc("is_operator");
  if (authError || isOperator !== true) return { ok: false, error: "운영자 권한이 없어요." };
  const cleanReason = reason.trim();
  if (decision === "rejected" && (cleanReason.length < 3 || cleanReason.length > 500)) return { ok: false, error: "반려 사유를 3~500자로 입력해 주세요." };
  const { error } = await session.client.rpc("creator_product_moderate", {
    p_id: id,
    p_decision: decision,
    p_rejection_reason: decision === "rejected" ? cleanReason : null,
  });
  if (error) return { ok: false, error: "검토 상태를 저장하지 못했어요. 대기 중인 상품인지 확인해 주세요." };
  return { ok: true };
}

export async function getPublicCreatorProducts(): Promise<{ products: PublicCreatorProduct[]; error: boolean }> {
  try {
    const query = asCreatorDb(createStaticClient()).from("creator_products");
    const { data, error } = await query.select("id,title,description,external_url,image_path,price,category,relationship_disclosure")
      .eq("moderation_status", "approved").order("created_at", { ascending: false });
    return { products: error ? [] : (data ?? []), error: Boolean(error) };
  } catch {
    return { products: [], error: true };
  }
}

export async function getMyCreatorProducts(): Promise<CreatorActionResult<CreatorProduct[]>> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "로그인이 필요해요." };
  const { data, error } = await session.client.from("creator_products")
    .select("id,owner_id,title,description,external_url,image_path,price,category,relationship_disclosure,moderation_status,rejection_reason,created_at,updated_at")
    .eq("owner_id", session.user.id).order("created_at", { ascending: false });
  if (error) return { ok: false, error: "등록한 상품을 불러오지 못했어요." };
  return { ok: true, data: data ?? [] };
}

export async function getCreatorProductReviewQueue(): Promise<CreatorActionResult<CreatorProduct[]>> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "로그인이 필요해요." };
  const operator = await (session.client as unknown as { rpc(name: "is_operator"): Promise<{ data: boolean | null; error: DbError }> }).rpc("is_operator");
  if (operator.error || operator.data !== true) return { ok: false, error: "운영자 권한이 없어요." };
  const query = session.client.from("creator_products");
  const { data, error } = await query.select("id,owner_id,title,description,external_url,image_path,price,category,relationship_disclosure,moderation_status,rejection_reason,created_at,updated_at")
    .eq("moderation_status", "pending").order("created_at", { ascending: true });
  if (error) return { ok: false, error: "검토 대기 상품을 불러오지 못했어요." };
  return { ok: true, data: data ?? [] };
}
