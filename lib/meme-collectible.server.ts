import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { memePathFrom } from "@/lib/labels";
import { getMemeCardArtDirection, getMemeCardEditorialCaption } from "@/lib/meme-collectible-catalog";
import type { Database } from "@/lib/database.types";
import {
  MEME_CARD_PAGE_SIZE, MEME_CARD_TARGET_COUNT, isMemeCardId, parseMemeCardPage,
  type MemeCollectibleCard, type MemeCardCatalogPage, type MemeCardCollectionPage,
  type MemeCardClaimResult, type MemeCardPageOptions,
} from "@/lib/meme-collectible";

type Client = SupabaseClient<Database>;
const CARD_SELECT = "id,card_no,meme_id,edition,art_seed,active,memes!inner(id,short_id,title,slug,category,origin_year,moderation_status,safety_level,published_at)" as const;
type CatalogRow = Pick<Database["public"]["Tables"]["meme_collectible_cards"]["Row"], "id" | "card_no" | "meme_id" | "edition" | "art_seed" | "active"> & {
  memes: Pick<Database["public"]["Tables"]["memes"]["Row"], "id" | "short_id" | "title" | "slug" | "category" | "origin_year" | "moderation_status" | "safety_level" | "published_at">;
};

export class MemeCardServiceError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
    this.name = "MemeCardServiceError";
  }
}

export async function getMemeCardAuthenticatedUser(client: Client): Promise<{ id: string }> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    const status = error.status;
    if (status && status >= 400 && status < 500 && status !== 429) throw new MemeCardServiceError(401, "signed_out");
    if (error.name === "AuthSessionMissingError") throw new MemeCardServiceError(401, "signed_out");
    unavailable();
  }
  if (!data.user || data.user.is_anonymous) throw new MemeCardServiceError(401, "signed_out");
  return { id: data.user.id };
}

function unavailable(): never { throw new MemeCardServiceError(503, "cards_unavailable"); }

function checkPrivateQueryAuth(error: { code: string } | null, status?: number): void {
  if (status === 401 || error?.code === "PGRST301" || error?.code === "PGRST303") {
    throw new MemeCardServiceError(401, "signed_out");
  }
}

function ensureCount(count: number | null): number {
  if (count === null || !Number.isInteger(count) || count < 0 || count > MEME_CARD_TARGET_COUNT) unavailable();
  return count;
}

function validateOptions(options: MemeCardPageOptions): void {
  if (parseMemeCardPage(String(options.page)) === null) throw new MemeCardServiceError(400, "invalid_input");
  if (options.query && options.query.length > 80) throw new MemeCardServiceError(400, "invalid_input");
  if (options.category && !["phrase", "dance", "song", "image", "comment", "challenge"].includes(options.category)) {
    throw new MemeCardServiceError(400, "invalid_input");
  }
}

/** Percent/underscore are literal characters in name searches, never user wildcards. */
function namePattern(query: string): string { return `%${query.replace(/[\\%_]/g, "\\$&")}%`; }

function eligibleQuery(client: Client) {
  return client.from("meme_collectible_cards").select(CARD_SELECT, { count: "exact" })
    .eq("active", true).eq("memes.moderation_status", "approved")
    .eq("memes.safety_level", "green").not("memes.published_at", "is", null);
}

function normalizeCard(row: CatalogRow): MemeCollectibleCard {
  const meme = row.memes;
  if (!isMemeCardId(row.id) || row.id !== `mc-${String(row.card_no).padStart(4, "0")}`
    || !row.active || !meme || row.meme_id !== meme.id || meme.moderation_status !== "approved"
    || meme.safety_level !== "green" || !meme.published_at || row.edition !== 1
    || !Number.isInteger(row.art_seed) || row.art_seed < 0 || row.art_seed > 2147483647) unavailable();
  const art = getMemeCardArtDirection(row.id);
  return {
    id: row.id, cardNo: row.card_no, edition: row.edition, artSeed: row.art_seed,
    memeId: meme.id, title: meme.title, slug: meme.slug, href: memePathFrom(meme.short_id, meme.slug),
    summary: getMemeCardEditorialCaption(row.id), category: meme.category, originYear: meme.origin_year,
    thumbnailUrl: null, artMotif: art.motif, artSymbols: art.symbols, artComposition: art.composition,
  };
}

/** This client only executes finite, fixed 24-row anonymous catalog pages. */
function cachedPublicClient(): Client {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, {
        ...init, cache: "force-cache", next: { revalidate: 60, tags: ["meme-collectible-catalog", PUBLIC_CATALOG_CACHE_TAG] },
      }) },
    },
  );
}

export async function getMemeCardCatalogPage(options: MemeCardPageOptions): Promise<MemeCardCatalogPage> {
  validateOptions(options);
  let query = eligibleQuery(options.query || options.category ? createStaticClient() : cachedPublicClient());
  if (options.query) query = query.ilike("memes.title", namePattern(options.query));
  if (options.category) query = query.eq("memes.category", options.category as Database["public"]["Enums"]["meme_category"]);
  const offset = (options.page - 1) * MEME_CARD_PAGE_SIZE;
  const { data, error, count } = await query.order("card_no").range(offset, offset + MEME_CARD_PAGE_SIZE - 1);
  if (error || !data) unavailable();
  let total = ensureCount(count);
  let cards = data.map(normalizeCard);
  if (!options.query && !options.category) {
    const freshClient = createStaticClient();
    // Cached content never authorizes publication. Read the current eligible page
    // with only identities and reconcile both its count and any shifted page IDs.
    const { data: current, error: currentError, count: currentCount } = await freshClient
      .from("meme_collectible_cards").select("id,meme_id,memes!inner(id)", { count: "exact" })
      .eq("active", true).eq("memes.moderation_status", "approved")
      .eq("memes.safety_level", "green").not("memes.published_at", "is", null)
      .order("card_no").range(offset, offset + MEME_CARD_PAGE_SIZE - 1);
    if (currentError || !current) unavailable();
    total = ensureCount(currentCount);
    const byId = new Map(cards.map((card) => [card.id, card]));
    const missing = current.filter((row) => byId.get(row.id)?.memeId !== row.meme_id).map((row) => row.id);
    if (missing.length) {
      const { data: shiftedCards, error: shiftedError } = await eligibleQuery(freshClient).in("id", missing).limit(MEME_CARD_PAGE_SIZE);
      if (shiftedError || !shiftedCards) unavailable();
      for (const card of shiftedCards) byId.set(card.id, normalizeCard(card));
    }
    cards = current.flatMap((row) => {
      const card = byId.get(row.id);
      return card && card.memeId === row.meme_id ? [card] : [];
    });
  }
  return { cards, total, page: options.page, pageSize: MEME_CARD_PAGE_SIZE, hasMore: offset + MEME_CARD_PAGE_SIZE < total };
}

export async function getMemeCollectibleCard(cardId: string): Promise<MemeCollectibleCard | null> {
  if (!isMemeCardId(cardId)) return null;
  const { data, error } = await eligibleQuery(createStaticClient()).eq("id", cardId).maybeSingle();
  if (error) unavailable();
  return data ? normalizeCard(data) : null;
}

/** Caller passes a verified getUser() identity; row ownership is enforced again by RLS. */
export async function getMemeCardCollectionPage(client: Client, userId: string, options: MemeCardPageOptions): Promise<MemeCardCollectionPage> {
  validateOptions(options);
  const offset = (options.page - 1) * MEME_CARD_PAGE_SIZE;
  const { data, error, count, status } = options.query || options.category
    ? await readFilteredOwnershipPage(client, userId, options, offset)
    : await client.from("user_meme_cards").select("card_id,created_at", { count: "exact" })
      .eq("user_id", userId).order("created_at", { ascending: false }).order("card_id")
      .range(offset, offset + MEME_CARD_PAGE_SIZE - 1);
  checkPrivateQueryAuth(error, status);
  if (error || !data) unavailable();
  const total = ensureCount(count);
  const ownership = data;
  const cardsById = new Map<string, MemeCollectibleCard>();
  if (ownership.length) {
    const { data: cards, error: hydrationError } = await eligibleQuery(createStaticClient()).in("id", ownership.map((row) => row.card_id)).limit(MEME_CARD_PAGE_SIZE);
    if (hydrationError || !cards) unavailable();
    for (const card of cards) cardsById.set(card.id, normalizeCard(card));
  }
  return {
    cards: ownership.map((row) => {
      const card = cardsById.get(row.card_id);
      return card ? { ...card, available: true as const, claimedAt: row.created_at }
        : { id: row.card_id, available: false as const, claimedAt: row.created_at };
    }),
    total, page: options.page, pageSize: MEME_CARD_PAGE_SIZE, hasMore: offset + MEME_CARD_PAGE_SIZE < total,
  };
}

function readFilteredOwnershipPage(client: Client, userId: string, options: MemeCardPageOptions, offset: number) {
  let query = client.from("user_meme_cards")
    .select("card_id,created_at,meme_collectible_cards!inner(id,active,memes!inner(title,category,moderation_status,safety_level,published_at))", { count: "exact" })
    .eq("user_id", userId).eq("meme_collectible_cards.active", true)
    .eq("meme_collectible_cards.memes.moderation_status", "approved")
    .eq("meme_collectible_cards.memes.safety_level", "green")
    .not("meme_collectible_cards.memes.published_at", "is", null);
  if (options.query) query = query.ilike("meme_collectible_cards.memes.title", namePattern(options.query));
  if (options.category) query = query.eq("meme_collectible_cards.memes.category", options.category as Database["public"]["Enums"]["meme_category"]);
  return query.order("created_at", { ascending: false }).order("card_id").range(offset, offset + MEME_CARD_PAGE_SIZE - 1);
}

export async function getOwnedMemeCardIds(client: Client, userId: string, cardIds: string[]): Promise<string[]> {
  if (!cardIds.length || cardIds.length > MEME_CARD_PAGE_SIZE || !cardIds.every(isMemeCardId)) throw new MemeCardServiceError(400, "invalid_input");
  const { data, error, status } = await client.from("user_meme_cards").select("card_id").eq("user_id", userId).in("card_id", cardIds).limit(MEME_CARD_PAGE_SIZE);
  checkPrivateQueryAuth(error, status);
  if (error || !data) unavailable();
  return data.map((row) => row.card_id);
}

export async function claimMemeCollectibleCard(client: Client, userId: string, cardId: string): Promise<MemeCardClaimResult> {
  if (!isMemeCardId(cardId)) throw new MemeCardServiceError(400, "invalid_input");
  // Fresh anonymous eligibility excludes caller-owned drafts and operator-only content.
  if (!await getMemeCollectibleCard(cardId)) throw new MemeCardServiceError(404, "card_unavailable");
  const { error, status } = await client.from("user_meme_cards").upsert(
    { user_id: userId, card_id: cardId }, { onConflict: "user_id,card_id", ignoreDuplicates: true },
  );
  checkPrivateQueryAuth(error, status);
  if (error) {
    if (error.code === "42501" || error.code === "23503") throw new MemeCardServiceError(409, "card_unavailable");
    unavailable();
  }
  const { data: owned, error: readError, status: readStatus } = await client.from("user_meme_cards").select("card_id,created_at")
    .eq("user_id", userId).eq("card_id", cardId).maybeSingle();
  checkPrivateQueryAuth(readError, readStatus);
  if (readError || !owned) unavailable();
  return { cardId: owned.card_id, owned: true, claimedAt: owned.created_at };
}
