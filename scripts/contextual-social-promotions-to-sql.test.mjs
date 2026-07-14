import { strict as assert } from "node:assert";

const moduleUrl = new URL("./contextual-social-promotions-to-sql.mjs", import.meta.url);
const promotions = await import(moduleUrl).catch(() => null);
assert.ok(promotions?.validateContextualPromotion, "contextual promotion validator must be exported");
assert.ok(promotions?.contextualSocialPromotionsSql, "contextual promotion SQL generator must be exported");

const tiktok = {
  meme_title: "Bad Guy (Billie Eilish song)",
  source_platform: "TikTok",
  source_url: "https://www.tiktok.com/@napkinsmusic/video/6693759972347481346",
  content_id: "6693759972347481346",
  title: "Bad Guy door cover",
  creator_name: "Lv.02 Napkins",
  oembed_verified_at: "2026-07-14T05:33:44.642Z",
  catalog_match_status: "exact",
  source_role: "contextual_derivative",
  rights_basis: "platform_public_embed",
  is_representative: false,
  promotion_status: "approved",
};

const instagram = {
  ...tiktok,
  meme_title: "검정고무신 애니메이션",
  source_platform: "Instagram",
  source_url: "https://www.instagram.com/reel/DGYAH_wviX0/",
  content_id: "DGYAH_wviX0",
  title: "밈 원본 찾기 165",
  creator_name: "memeoriginal_kr",
};

assert.equal(promotions.validateContextualPromotion(tiktok).source_platform, "TikTok");
assert.equal(promotions.validateContextualPromotion(instagram).source_platform, "Instagram");

for (const invalid of [
  { ...tiktok, is_representative: true },
  { ...tiktok, catalog_match_status: "unmapped" },
  { ...tiktok, source_role: "original" },
  { ...tiktok, rights_basis: "unknown" },
  { ...tiktok, oembed_verified_at: null },
  { ...tiktok, content_id: "1234567890123456789" },
  { ...tiktok, source_platform: "Instagram" },
]) {
  assert.throws(() => promotions.validateContextualPromotion(invalid), /invalid contextual social promotion/i);
}

const sql = promotions.contextualSocialPromotionsSql([tiktok, instagram]);
assert.match(sql, /limited promotion target count expected 2/i);
assert.match(sql, /is_representative, availability, moderation_status/);
assert.match(sql, /false, 'live', 'approved'/);
assert.match(sql, /'embeddable'/);
assert.match(sql, /moderation_status in \('approved', 'limited'\)/);
assert.match(sql, /not exists[\s\S]+meme_contents/);
assert.match(sql, /not exists[\s\S]+meme_sources/);

console.log("contextual social promotion SQL safeguards OK");
