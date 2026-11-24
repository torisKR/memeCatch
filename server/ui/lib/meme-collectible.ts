export const MEME_CARD_TARGET_COUNT = 1000;
export const MEME_CARD_PAGE_SIZE = 24;
export const MEME_CARD_MAX_PAGE = Math.ceil(MEME_CARD_TARGET_COUNT / MEME_CARD_PAGE_SIZE);

export type MemeCardArtMotif =
  | "pen-pineapple" | "dance" | "gaming" | "reaction" | "office" | "food"
  | "animal" | "sport" | "music" | "chat" | "choice" | "technology"
  | "celebration" | "fashion" | "travel" | "study";

export type MemeCardPageOptions = { page: number; query?: string; category?: string };
export type MemeCardArtComposition = "orbit" | "rise" | "split" | "burst" | "rhythm" | "stack" | "frame" | "exchange";

export type MemeCollectibleCard = {
  id: string;
  cardNo: number;
  edition: number;
  artSeed: number;
  memeId: string;
  title: string;
  slug: string;
  href: string;
  summary: string;
  category: string;
  originYear: number | null;
  thumbnailUrl: string | null;
  artMotif: MemeCardArtMotif;
  artSymbols: string[];
  artComposition: MemeCardArtComposition;
};

export type MemeCardCatalogPage = {
  cards: MemeCollectibleCard[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/** Discovery stays sealed until the viewer explicitly reveals a card. */
export type MemeCardSeal = { id: string };

export type MemeCardDiscoveryPage = Omit<MemeCardCatalogPage, "cards"> & {
  cards: MemeCardSeal[];
};

/** Hidden content retains ownership without revealing its former title or text. */
export type OwnedMemeCollectibleCard =
  | (MemeCollectibleCard & { available: true; claimedAt: string })
  | { id: string; available: false; claimedAt: string };

export type MemeCardCollectionPage = Omit<MemeCardCatalogPage, "cards"> & {
  cards: OwnedMemeCollectibleCard[];
};

export type MemeCardClaimResult = { cardId: string; owned: true; claimedAt: string };
export type MemeCardOwnershipResult = { ownedCardIds: string[] };

export function isMemeCardId(value: unknown): value is string {
  return typeof value === "string"
    && /^mc-(?:000[1-9]|00[1-9]\d|0[1-9]\d{2}|1000)$/.test(value);
}

export function parseMemeCardPage(value: string | null): number | null {
  if (value === null) return 1;
  if (!/^[1-9]\d?$/.test(value)) return null;
  const page = Number(value);
  return page <= MEME_CARD_MAX_PAGE ? page : null;
}

export function parseMemeCardIds(value: string): string[] | null {
  const ids = value.split(",");
  if (ids.length < 1 || ids.length > MEME_CARD_PAGE_SIZE || !ids.every(isMemeCardId)) return null;
  return [...new Set(ids)];
}

const categories = new Set(["phrase", "dance", "song", "image", "comment", "challenge"]);

export function parseMemeCardPageOptions(params: URLSearchParams): MemeCardPageOptions | null {
  const page = parseMemeCardPage(params.get("page"));
  const query = params.get("query")?.trim() || undefined;
  const category = params.get("category") || undefined;
  if (page === null || (query && query.length > 80) || (category && !categories.has(category))) return null;
  if ([...params.keys()].some((key) => !["page", "query", "category"].includes(key))) return null;
  if (["page", "query", "category"].some((key) => params.getAll(key).length > 1)) return null;
  return { page, query, category };
}
