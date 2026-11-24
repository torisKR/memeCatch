// lib/actions/admin-catalog.ts: checkCatalogMemeDuplicates and
// registerCatalogMeme (/admin/memes/catalog/new), with the validation of
// lib/catalog-registration.ts (zod 4: its messages, paths and which checks
// still run after another failed).
const FILE = "lib/actions/admin-catalog.ts";
const KEY = "6f0e7b9a-2c1d-4e5f-8a9b-0c1d2e3f4a5b";
const TITLE = "'B7 카탈로그%'";
const URLS = "'https://www.youtube.com/watch?v=b7catalog01', 'https://b7-catalog.example.org/story'";

const setup = (extra = "") => `delete from admin_audit_log where detail->>'registration_key' = '${KEY}';
    delete from meme_claims where meme_id in (select id from memes where title like ${TITLE});
    delete from meme_media where meme_id in (select id from memes where title like ${TITLE});
    delete from meme_tags_map where meme_id in (select id from memes where title like ${TITLE});
    delete from memes where title like ${TITLE};
    delete from media_sources where canonical_url in (${URLS});
    delete from tags where name in ('b7태그', 'b7 second');${extra}`;
const rows = () => `select json_build_object(
    'memes', (select coalesce(json_agg(json_build_object('title', title, 'slug', slug, 'status', moderation_status, 'origin_kind', origin_kind,
        'summary', summary, 'description', description, 'origin', origin, 'aliases', aliases, 'years', array[source_work_year, meme_first_seen_year, korea_viral_year],
        'precision', year_precision, 'safety', safety_level, 'category', category, 'difficulty', difficulty, 'sentiment', sentiment, 'usage', usage_context,
        'key', catalog_registration_key,
        'tags', (select coalesce(json_agg(t.name order by t.name), '[]') from meme_tags_map mt join tags t on t.id = mt.tag_id where mt.meme_id = m.id),
        'media', (select coalesce(json_agg(json_build_object('url', s.canonical_url, 'platform', s.platform, 'external', s.external_id, 'title', s.title,
            'role', mm.source_role, 'basis', mm.rights_basis, 'state', mm.review_state, 'note', mm.reviewer_note) order by s.canonical_url), '[]')
          from meme_media mm join media_sources s on s.id = mm.source_id where mm.meme_id = m.id),
        'claims', (select count(*) from meme_claims c where c.meme_id = m.id)) order by title), '[]') from memes m where title like ${TITLE}),
    'audit', (select coalesce(json_agg(json_build_object('action', action, 'type', entity_type) order by id), '[]')
      from admin_audit_log where detail->>'registration_key' = '${KEY}'))`;

const source = (url, sourceRole, extra = {}) => ({ url, platform: "web", sourceRole, rightsBasis: "unknown", ...extra });
const BASE = {
  registrationKey: KEY,
  title: "  B7 카탈로그 밈  ",
  aliases: [" 별칭 ", "별칭", "둘째"],
  summary: " 회의가 길어질 때 쓰는 말 ",
  description: " 설명이에요 ",
  origin: " 유래예요 ",
  sourceWorkYear: 2019,
  memeFirstSeenYear: null,
  koreaViralYear: 2021,
  yearPrecision: "year",
  tags: ["B7태그", "b7태그", " B7 Second "],
  safetyLevel: "yellow",
  category: "image",
  difficulty: "normal",
  sentiment: "funny",
  usageContext: { work: "yellow", friends: "green", family: "yellow", sns: "red" },
  sources: [
    source("https://www.youtube.com/watch?v=b7catalog01&t=4", "earliest_known", { platform: "youtube", title: " 원 영상 ", reviewNote: " 확인 " }),
    source(" https://b7-catalog.example.org/story#top ", "secondary_reference", { rightsBasis: "link_only" }),
  ],
};

export function cases() {
  const register = (label, input, extra = "") => ({
    name: `registerCatalogMeme, ${label}`,
    file: FILE,
    action: "registerCatalogMeme",
    endpoint: "catalog-register",
    page: "/admin/memes/catalog/new",
    input,
    setup: () => setup(extra),
    rows,
    maskIds: true,
    mask: (text) => text.replace(/"shortId":"[0-9a-z]+"/g, '"shortId":"<short>"'),
  });
  const check = (label, input) => ({
    name: `checkCatalogMemeDuplicates, ${label}`,
    file: FILE,
    action: "checkCatalogMemeDuplicates",
    endpoint: "catalog-duplicates",
    page: "/admin/memes/catalog/new",
    input,
    setup: () => setup(),
    rows,
    maskIds: true,
    mask: (text) => text.replace(/"shortId":"[0-9a-z]+"/g, '"shortId":"<short>"'),
  });
  const taken = `\n    insert into memes (title, summary, description, origin, slug, moderation_status) values ('B7 카탈로그 밈', 's', 'd', 'o', 'b7-catalog-taken', 'pending');`;
  const one = (patch) => ({ ...BASE, ...patch });
  const src = (...list) => one({ sources: list });
  return [
    register("registered pending with its sources and tags", BASE),
    register("a title already in the catalog", BASE, taken),
    register("years out of range and not whole", one({ sourceWorkYear: 1979.5, koreaViralYear: "2020", memeFirstSeenYear: 2101 })),
    register("missing and wrong fields", one({ title: undefined, summary: 3, registrationKey: "x", yearPrecision: 1, tags: [], aliases: ["  "] })),
    register("too long", one({ title: "가".repeat(161), aliases: Array(21).fill("a") })),
    register("a summary that only repeats the title, with an empty title", one({ summary: "B7 카탈로그 밈!", title: "" })),
    register("a summary that only repeats the title", one({ summary: "B7-카탈로그 밈?" })),
    register("sources without the roles it needs", src(source("http://x.com", "usage_example"), source("https://b7-catalog.example.org/story", "usage_example"))),
    register("the same URL twice and a platform that does not match", src(source("https://b7-catalog.example.org/story", "earliest_known", { platform: "youtube" }), source("https://b7-catalog.example.org/story#x", "secondary_reference"))),
    register("one source", src(source("https://b7-catalog.example.org/story", "earliest_known"))),
    register("sources of the wrong shape", src(source("https://b7-catalog.example.org/story", "boss"), { url: 3 })),
    register("a usage context of unknown levels", one({ usageContext: { work: "blue" } })),
    register("not an object", "x"),
    register("a malformed key with a repeated summary", one({ registrationKey: "x", summary: "B7 카탈로그 밈" })),
    register("an empty URL", src(source("", "earliest_known"), source("https://b7-catalog.example.org/story", "secondary_reference"))),
    register("source extras too long", src(source("https://b7-catalog.example.org/story", "earliest_known", { title: "x".repeat(301), externalId: 5 }), source("https://www.youtube.com/watch?v=b7catalog01", "secondary_reference", { platform: "youtube" }))),
    register("no aliases and a tag that is not text", one({ aliases: undefined, tags: ["a", 3] })),
    register("a null usage context", one({ usageContext: null })),
    register("sources as text", one({ sources: "x" })),
    register("a YouTube short given as YouTube", src(source("https://www.youtube.com/shorts/b7catalog01", "original", { platform: "youtube" }), source("https://b7-catalog.example.org/story", "official_reupload"))),
    check("no matches", { title: " B7 카탈로그 없는 밈 ", sourceUrls: ["https://b7-catalog.example.org/story"] }),
    check("a title that matches", { title: "패리티 리치", sourceUrls: ["https://b7-catalog.example.org/story"] }),
    check("invalid", { title: "", sourceUrls: ["nope", 3] }),
    check("no URLs", { title: "t", sourceUrls: [] }),
    check("nine URLs", { title: "t", sourceUrls: Array(9).fill("https://b7-catalog.example.org/story") }),
    check("nulls", { title: null, sourceUrls: null }),
    check("not an object", "x"),
  ].map((testCase) => ({ ...testCase, input: JSON.parse(JSON.stringify(testCase.input)) }));
}
