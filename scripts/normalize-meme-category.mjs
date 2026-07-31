const CANONICAL = new Set(["phrase", "dance", "song", "image", "comment", "challenge"]);
const DISPLAY_ALIAS = {
  meme_term: "phrase",
  challenge_dance: "challenge",
  song: "song",
  drama_scene: "comment",
  meme_video: "image",
};
const CANONICAL_TO_DISPLAY = {
  phrase: "meme_term",
  dance: "challenge_dance",
  song: "song",
  image: "meme_video",
  comment: "drama_scene",
  challenge: "challenge_dance",
};

function normalizeToken(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_");
}

function isCanonicalCategory(value) {
  return CANONICAL.has(value);
}

function toLegacyCategory(value) {
  const token = normalizeToken(value);
  if (!token) return "";
  if (isCanonicalCategory(token)) return token;
  if (Object.prototype.hasOwnProperty.call(DISPLAY_ALIAS, token)) return DISPLAY_ALIAS[token];
  if (token.includes("meme_video") || token === "video" || token.includes("video")) return "image";
  if (token.includes("drama")) return "comment";
  if (token.includes("song") || token.includes("music")) return "song";
  if (token.includes("challenge")) return "challenge";
  if (token.includes("dance")) return "dance";
  return "";
}

export function normalizeMemeCategory(input = {}, mediaType = "") {
  const row = input && typeof input === "object" && !Array.isArray(input) ? input : { category: input };
  const media = normalizeToken(mediaType || row.media_type || row.mediaType);

  const candidates = [
    row.category,
    row.category_hint,
    row.categoryHint,
    row.display_category,
    row.displayCategory,
    row.display_group,
    row.displayGroup,
  ];

  for (const value of candidates) {
    const category = toLegacyCategory(value);
    if (category && isCanonicalCategory(category)) return category;
  }

  if (media === "video") return "challenge";
  if (media === "text") return "comment";
  return "image";
}

export function resolveDisplayCategory(input = {}, mediaType = "") {
  const canonical = normalizeMemeCategory(input, mediaType);
  return CANONICAL_TO_DISPLAY[canonical] ?? "meme_term";
}

export function describeCategorySummary(records) {
  const summary = Object.fromEntries([...CANONICAL].map((key) => [key, 0]));
  for (const row of records) {
    const category = normalizeMemeCategory(row);
    summary[category] = (summary[category] ?? 0) + 1;
  }
  return summary;
}

export function describeDisplayCategorySummary(records) {
  const summary = { meme_term: 0, challenge_dance: 0, song: 0, meme_video: 0, drama_scene: 0 };
  for (const row of records) {
    const token = resolveDisplayCategory(row);
    summary[token] = (summary[token] ?? 0) + 1;
  }
  return summary;
}
