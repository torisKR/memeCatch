import assert from "node:assert/strict";
import { describeDisplayCategorySummary, normalizeMemeCategory, resolveDisplayCategory } from "./normalize-meme-category.mjs";

assert.equal(normalizeMemeCategory({ category: "song" }), "song");
assert.equal(normalizeMemeCategory({ category_hint: "challenge" }), "challenge");
assert.equal(normalizeMemeCategory({ category_hint: "meme_term" }), "phrase");
assert.equal(normalizeMemeCategory({ category_hint: "challenge_dance" }), "challenge");
assert.equal(normalizeMemeCategory({ category_hint: "challenge_dance", media_type: "video" }), "challenge");
assert.equal(normalizeMemeCategory({ category_hint: "meme_video" }), "image");
assert.equal(normalizeMemeCategory({ category_hint: "drama_scene" }), "comment");
assert.equal(normalizeMemeCategory({ media_type: "video" }), "challenge");
assert.equal(normalizeMemeCategory({ media_type: "image" }), "image");
assert.equal(resolveDisplayCategory({ category: "comment" }), "drama_scene");
assert.equal(resolveDisplayCategory({ category: "dance" }), "challenge_dance");
assert.equal(resolveDisplayCategory({ category: "image" }), "meme_video");
assert.deepEqual(
  describeDisplayCategorySummary([
    { category: "phrase" },
    { category: "comment" },
    { category: "image" },
    { category: "song" },
    { category: "dance" },
    { category: "challenge" },
    { category: "meme_video" },
  ]),
  {
    meme_term: 1,
    challenge_dance: 2,
    song: 1,
    meme_video: 2,
    drama_scene: 1,
  }
);

console.log("normalize-meme-category safeguards OK");
