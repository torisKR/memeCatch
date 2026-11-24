// Writes server/tests/fixtures/db_query_plans.json: every query plan the
// browser posts to /api/db/query, as the real builder (lib/db/plan.ts) makes
// it and JSON.stringify sends it.
//
//   npx vitest run --config server/parity/db-query/vitest.config.mts
//
// Each case repeats one call chain of a component (file:line in `source`)
// with the values of seed.sql. Explore uses the exported buildMemesQuery
// itself; the Axum scripts' plans come from `queryPlan` in server/ui/core.js.
// "$SELF" stands for the caller's own user id; db-query.mjs fills it in.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { createPlanClient, type QueryPlan } from "@/lib/db/plan";
import { buildMemesQuery, PAGE_SIZE, type ExploreFilters } from "@/components/explore-grid";
import { SEARCH_SUGGESTION_COLUMNS } from "@/lib/search-suggestions";
import { AI_MEME_TOPIC_TAG } from "@/lib/labels";
import { SEED } from "./seed-ids.mjs";

type Case = { id: string; source: string; writes: boolean; plan: unknown };

const SELF = "$SELF";
const RECENT_SELECT =
  "*, meme_contents(thumbnail_url, is_representative, platform, url, content_id, availability, moderation_status, manual_video_verified), meme_market_profiles(market_code, role, review_state)";
const COMMENTS_SELECT = "id,parent_id,body,status,created_at,user_id,profiles!discussions_user_id_fkey(nickname)";

/** The plan a chain posts: what `then` hands the executor, through JSON. */
async function planOf(chain: (db: ReturnType<typeof createPlanClient>) => PromiseLike<unknown>): Promise<unknown> {
  let sent: QueryPlan | null = null;
  const db = createPlanClient(async (plan) => {
    sent = JSON.parse(JSON.stringify({ plan })).plan;
    return { data: [], error: null, count: null };
  });
  await chain(db);
  if (!sent) throw new Error("the chain sent nothing");
  return sent;
}

/** `queryPlan` of server/ui/core.js, the Axum pages' copy of the builder. */
function uiQueryPlan(): (op: string, name: string, options?: object) => unknown {
  const source = readFileSync(fileURLToPath(new URL("../../ui/core.js", import.meta.url)), "utf8");
  const body = source.match(/\nfunction queryPlan\([\s\S]*?\n}\n/);
  if (!body) throw new Error("queryPlan not found in server/ui/core.js");
  return new Function(`${body[0]}; return queryPlan;`)();
}

function exploreCases(): Array<[string, ExploreFilters, { from?: number; indexableIds?: string[] }?]> {
  const base: ExploreFilters = { categories: [], sort: "trending" };
  return [
    ["explore-trending", base],
    ["explore-recent-page-2", { ...base, sort: "recent" }, { from: PAGE_SIZE }],
    ["explore-controversial", { ...base, sort: "controversial" }],
    ["explore-popular-categories", { ...base, sort: "popular", categories: ["phrase", "dance"] }],
    ["explore-difficulty-lifecycle-media-year", { ...base, difficulty: "beginner", lifecycle: "active", media: "video", year: "2020s" }],
    ["explore-youtube", { ...base, platform: "youtube" }],
    ["explore-youtube-shorts", { ...base, platform: "youtube_shorts" }],
    ["explore-tiktok", { ...base, platform: "tiktok" }],
    ["explore-instagram-recent", { ...base, platform: "instagram", sort: "recent" }],
    ["explore-ai-topic", { ...base, topicTag: AI_MEME_TOPIC_TAG }],
    ["explore-ai-topic-youtube", { ...base, topicTag: AI_MEME_TOPIC_TAG, platform: "youtube" }],
    ["explore-search", { ...base, q: "밈" }],
    ["explore-search-ai", { ...base, q: "밈", topicTag: AI_MEME_TOPIC_TAG }],
    ["explore-search-filters", { ...base, q: "seed", platform: "tiktok", categories: ["song"], year: "2010s", sort: "recent" }],
    ["explore-indexable-empty", base, { indexableIds: [] }],
    ["explore-indexable-ids", base, { indexableIds: SEED.indexableIds }],
    ["explore-search-indexable-ids", { ...base, q: "seed" }, { indexableIds: SEED.indexableIds }],
  ];
}

async function cases(): Promise<Case[]> {
  const out: Case[] = [];
  const add = async (id: string, source: string, writes: boolean, chain: Parameters<typeof planOf>[0]) => {
    out.push({ id, source, writes, plan: await planOf(chain) });
  };
  const M = SEED.memes;

  await add("search-suggestions", "app/(default)/search/search-input.tsx:139", false, (db) =>
    db.rpc("search_memes", { p_query: "seed", p_limit: 6 }).select(SEARCH_SUGGESTION_COLUMNS).abortSignal(new AbortController().signal));
  await add("auth-menu-nickname", "components/auth-menu.tsx:67", false, (db) =>
    db.from("profiles").select("nickname").eq("id", SELF).single());
  await add("comments-page-1", "components/comments.tsx:49", false, (db) =>
    db.from("discussions").select(COMMENTS_SELECT).eq("meme_id", M.approved).order("created_at", { ascending: true }).order("id", { ascending: true }).range(0, 499));
  await add("comments-page-2", "components/comments.tsx:49", false, (db) =>
    db.from("discussions").select(COMMENTS_SELECT).eq("meme_id", M.approved).order("created_at", { ascending: true }).order("id", { ascending: true }).range(500, 999));
  await add("post-like-state", "components/community-like-button.tsx:43", false, (db) =>
    db.from("community_post_likes").select("post_id").eq("post_id", SEED.post).eq("user_id", SELF).maybeSingle());
  await add("post-like-toggle", "components/community-like-button.tsx:66", true, (db) =>
    db.rpc("toggle_post_like", { p_post_id: SEED.post }));
  await add("post-form-search", "components/community-post-form.tsx:183", false, (db) =>
    db.rpc("search_memes", { p_query: "seed", p_limit: 5 }));
  await add("quiz-status", "components/daily-meme-quiz.tsx:49", false, (db) =>
    db.rpc("get_daily_meme_quiz_status").single());
  await add("quiz-complete", "components/daily-meme-quiz.tsx:57", true, (db) =>
    db.rpc("complete_daily_meme_quiz", { p_meme_short_id: SEED.quizShortId, p_correct: true }).single());
  await add("vote-stats", "components/generation-votes.tsx:52", false, (db) =>
    db.from("generation_vote_stats").select("*").eq("meme_id", M.approved));
  await add("my-profile", "components/generation-votes.tsx:66", false, (db) =>
    db.rpc("get_my_profile").single());
  await add("my-vote", "components/generation-votes.tsx:68", false, (db) =>
    db.from("generation_votes").select("vote, age_group").eq("meme_id", M.approved).eq("user_id", SELF).maybeSingle());
  await add("recent-memes", "components/my-recent.tsx:38, components/resume-strip.tsx:30", false, (db) =>
    db.from("memes").select(RECENT_SELECT).in("id", [M.approved, M.pending, M.limited, M.second].slice(0, 6)).in("moderation_status", ["approved", "limited"]));
  await add("reaction-toggle", "components/reaction-bar.tsx:94", true, (db) =>
    db.rpc("toggle_reaction", { p_meme_id: M.approved, p_reaction: "funny" }));
  await add("reaction-toggle-bad-enum", "components/reaction-bar.tsx:94 (a reaction the enum lacks)", true, (db) =>
    // The enum has no "laugh": the browser could still send it.
    db.rpc("toggle_reaction", { p_meme_id: M.approved, p_reaction: "laugh" as never }));
  await add("save-intent", "components/save-button.tsx:166", true, (db) =>
    db.rpc("save_meme", { p_meme_id: M.second }));
  await add("saved-state", "components/save-button.tsx:173", false, (db) =>
    db.from("saved_memes").select("meme_id").eq("meme_id", M.approved).maybeSingle());
  await add("save-toggle", "components/save-button.tsx:204", true, (db) =>
    db.rpc("toggle_save", { p_meme_id: M.approved }));
  await add("save-toggle-pending-meme", "components/save-button.tsx:204 (a meme not public)", true, (db) =>
    db.rpc("toggle_save", { p_meme_id: M.pending }));
  await add("submit-duplicates", "components/submit-form.tsx:158", false, (db) =>
    db.rpc("search_memes", { p_query: "seed", p_limit: 3 }));
  await add("video-verification", "app/api/db/query/route.ts:88 (no caller left; the route's own branch)", true, (db) =>
    db.rpc("record_instagram_post_video_verification", {
      p_operation_id: SEED.videoOperation, p_content_id: SEED.videoContent, p_decision: "verify", p_evidence_note: "parity run evidence",
    }));

  for (const [id, filters, options] of exploreCases()) {
    const from = options?.from ?? 0;
    await add(id, "components/explore-grid.tsx:126 (buildMemesQuery), :185 (range)", false, (db) =>
      buildMemesQuery(db, filters, { indexableIds: options?.indexableIds }).range(from, from + PAGE_SIZE - 1));
  }

  const queryPlan = uiQueryPlan();
  const ui = (id: string, source: string, writes: boolean, plan: unknown) =>
    out.push({ id, source, writes, plan: JSON.parse(JSON.stringify({ plan })).plan });
  ui("ui-account-nickname", "server/ui/account.js:32", false, queryPlan("select", "profiles", {
    fields: [{ kind: "column", name: "nickname" }], filters: [{ column: "id", op: "eq", value: SELF }], single: true, maybeSingle: false,
  }));
  ui("ui-save-intent", "server/ui/save.js:111", true, queryPlan("rpc", "save_meme", { args: { p_meme_id: M.second } }));
  ui("ui-saved-state", "server/ui/save.js:116", false, queryPlan("select", "saved_memes", {
    fields: [{ kind: "column", name: "meme_id" }], filters: [{ column: "meme_id", op: "eq", value: M.approved }], single: false, maybeSingle: true,
  }));
  ui("ui-save-toggle", "server/ui/save.js:132", true, queryPlan("rpc", "toggle_save", { args: { p_meme_id: M.approved } }));
  return out;
}

test("capture the plans the browser posts", async () => {
  const all = await cases();
  const target = fileURLToPath(new URL("../../tests/fixtures/db_query_plans.json", import.meta.url));
  writeFileSync(target, `${JSON.stringify(all, null, 1)}\n`);
  console.log(`${all.length} plans -> ${target}`);
});
