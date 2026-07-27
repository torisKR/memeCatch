import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { preparePromotion } from "./prepare-contextual-social-promotions.mjs";

const scriptUrl = new URL("./prepare-contextual-social-promotions.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl));

const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /catalog_match_status: "exact"/);
assert.match(source, /contextual_derivative/);
assert.match(source, /never writes to Supabase|never writes to Supabase/i);
assert.match(source, /matchCatalogMeme/);

const memes = [
  {
    title: "포철고 챌린지",
    year: 2024,
    aliases: ["포철고잡기챌린지"],
    needles: ["포철고챌린지", "포철고잡기챌린지", "포철고"],
  },
  {
    title: "룩공절(1122)",
    year: 2011,
    aliases: ["룩공절", "1122"],
    needles: ["룩공절1122", "룩공절", "1122"],
  },
];

const good = preparePromotion(
  {
    source_url: "https://www.tiktok.com/@yul.__2/video/7361412126969302280",
    source_platform: "TikTok",
    content_id: "7361412126969302280",
    oembed_title: "포철고 잡기 챌린지#포철고챌린지#축구부",
    oembed_author_name: "오동통면",
    oembed_verified_at: "2026-07-16T00:00:00.000Z",
  },
  memes,
);
assert.equal(good?.meme_title, "포철고 챌린지");
assert.equal(good?.promotion_status, "approved");
assert.equal(good?.catalog_match_status, "exact");
assert.equal(good?.is_representative, false);

const falseNumeric = preparePromotion(
  {
    source_url: "https://www.tiktok.com/@x/video/1234567890123456789",
    oembed_title: "random cooking video 1122 style",
    oembed_author_name: "chef",
    oembed_verified_at: "2026-07-16T00:00:00.000Z",
  },
  memes,
);
assert.equal(falseNumeric, null);

const missingAuthor = preparePromotion(
  {
    source_url: "https://www.instagram.com/reel/DGYAH_wviX0/",
    oembed_title: "포철고 챌린지",
    oembed_author_name: "",
    oembed_verified_at: "2026-07-16T00:00:00.000Z",
  },
  memes,
);
assert.equal(missingAuthor, null);

console.log("prepare-contextual-social-promotions OK");
