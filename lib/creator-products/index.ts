export const CREATOR_PRODUCT_CATEGORIES = [
  "apparel", "accessories", "prints", "digital", "other",
] as const;
export type CreatorProductCategory = (typeof CREATOR_PRODUCT_CATEGORIES)[number];
export const CREATOR_RELATIONSHIPS = ["creator", "affiliate", "gifted", "other"] as const;
export type CreatorRelationship = (typeof CREATOR_RELATIONSHIPS)[number];

export type CreatorProductInput = {
  title: string;
  description: string;
  externalUrl: string;
  imagePath: string;
  price: string;
  category: string;
  relationshipDisclosure: string;
  rightsAccepted: boolean;
};

export type CreatorProduct = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  external_url: string;
  image_path: string;
  price: number | null;
  category: CreatorProductCategory;
  relationship_disclosure: CreatorRelationship;
  moderation_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};
export type PublicCreatorProduct = Pick<CreatorProduct,
  "id" | "title" | "description" | "external_url" | "image_path" | "price" | "category" | "relationship_disclosure"
>;

export type ValidationResult =
  | { ok: true; data: Omit<CreatorProductInput, "price" | "rightsAccepted"> & { price: number | null } }
  | { ok: false; error: string };

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) {
    // Literal IPv6: block loopback, unspecified, unique-local, link-local and mapped IPv4.
    const normalized = host.split("%", 1)[0];
    return normalized === "::" || normalized === "::1" || /^(fc|fd|fe[89ab])/i.test(normalized) || normalized.startsWith("::ffff:");
  }
  if (/^\d+(?:\.\d+){3}$/.test(host)) {
    const octets = host.split(".").map(Number);
    const [a, b] = octets;
    return octets.some((part) => part > 255) || a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if ([".test", ".invalid", ".example", ".home.arpa"].some((suffix) => host.endsWith(suffix))) return true;
  const labels = host.replace(/\.$/, "").split(".");
  return labels.length < 2 || labels.some((label) =>
    label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  );
}

export function validatePublicProductUrl(value: string): boolean {
  if (value !== value.trim() || /[\u0000-\u0020\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (!url.port || url.port === "443") && !isPrivateOrLocalHost(url.hostname);
  } catch {
    return false;
  }
}

export function validateCreatorProductInput(
  input: CreatorProductInput,
  ownerId?: string,
): ValidationResult {
  if (!input || typeof input !== "object" ||
      typeof input.title !== "string" || typeof input.description !== "string" ||
      typeof input.externalUrl !== "string" || typeof input.imagePath !== "string" ||
      typeof input.price !== "string" || typeof input.category !== "string" ||
      typeof input.relationshipDisclosure !== "string" || typeof input.rightsAccepted !== "boolean") {
    return { ok: false, error: "상품 정보를 모두 확인해 주세요." };
  }
  const title = input.title.trim();
  const description = input.description.trim();
  const externalUrl = input.externalUrl.trim();
  if (title.length < 2 || title.length > 120) return { ok: false, error: "상품 이름은 2~120자로 입력해 주세요." };
  if (description.length < 5 || description.length > 2000) return { ok: false, error: "설명은 5~2,000자로 입력해 주세요." };
  if (input.imagePath.length > 400 || !/^creator-products\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|gif)$/.test(input.imagePath)) {
    return { ok: false, error: "상품 이미지를 다시 올려 주세요." };
  }
  if (ownerId && !input.imagePath.startsWith(`creator-products/${ownerId}/`)) return { ok: false, error: "상품 이미지를 다시 올려 주세요." };
  if (externalUrl.length > 2048 || !validatePublicProductUrl(externalUrl)) return { ok: false, error: "공개 HTTPS 상품 주소를 확인해 주세요." };
  const priceText = input.price.trim();
  const price = priceText === "" ? null : Number(priceText);
  if (price !== null && (!Number.isSafeInteger(price) || price < 1 || price > 100_000_000)) return { ok: false, error: "가격은 1원~1억원 사이의 정수로 입력해 주세요." };
  if (!(CREATOR_PRODUCT_CATEGORIES as readonly string[]).includes(input.category)) return { ok: false, error: "상품 종류를 선택해 주세요." };
  if (!(CREATOR_RELATIONSHIPS as readonly string[]).includes(input.relationshipDisclosure)) return { ok: false, error: "홍보 관계를 선택해 주세요." };
  if (input.rightsAccepted !== true) return { ok: false, error: "상품 및 이미지 사용 권한을 확인해 주세요." };
  return {
    ok: true,
    data: {
      title, description, externalUrl: new URL(externalUrl).toString(), imagePath: input.imagePath, price,
      category: input.category, relationshipDisclosure: input.relationshipDisclosure,
    },
  };
}

export function isPublicCreatorProduct(row: Pick<CreatorProduct, "moderation_status">): boolean {
  return row.moderation_status === "approved";
}
