// lib/actions/admin.ts, the meme editors: createHouseOriginal (/admin/memes/new).
const FILE = "lib/actions/admin.ts";
const LIKE = "'B7 자체%'";

const houseSetup = () => `delete from admin_audit_log where action = 'meme.create_house_original' and detail->>'title' like ${LIKE};
    delete from meme_market_profiles where meme_id in (select id from memes where title like ${LIKE});
    delete from meme_sources where meme_id in (select id from memes where title like ${LIKE});
    delete from memes where title like ${LIKE};`;
const houseRows = () => `select json_build_object(
    'memes', (select coalesce(json_agg(json_build_object('title', title, 'slug', regexp_replace(slug, '-[0-9a-z]{6,}$', '-<time>'), 'status', moderation_status,
        'origin_kind', origin_kind, 'summary', summary, 'description', description, 'origin', origin, 'safety', safety_level, 'category', category,
        'difficulty', difficulty, 'year', origin_year, 'usage', usage_context,
        'sources', (select coalesce(json_agg(json_build_object('platform', platform, 'url', regexp_replace(regexp_replace(source_url, '/memes/[^-]+-', '/memes/<short>-'), '-[0-9a-z]{6,}$', '-<time>'),
            'title', s.title, 'creator', creator_name, 'copyright', copyright_status, 'role', source_role, 'basis', rights_basis)), '[]') from meme_sources s where s.meme_id = m.id),
        'profiles', (select coalesce(json_agg(json_build_object('market', market_code, 'tag', language_tag, 'role', role, 'local', local_title, 'state', review_state,
            'reviewed', reviewed_at is not null, 'by', reviewed_by is not null)), '[]') from meme_market_profiles p where p.meme_id = m.id))
      order by m.slug), '[]') from memes m where title like ${LIKE}),
    'audit', (select coalesce(json_agg(json_build_object('action', action, 'type', entity_type, 'detail', detail) order by id), '[]')
      from admin_audit_log where action = 'meme.create_house_original' and detail->>'title' like ${LIKE}))`;

const HOUSE = {
  title: "  B7 자체 제작 밈  ",
  summary: " 직접 만든 밈 ",
  description: " 밈캐치가 만든 설명 ",
  origin: " 회의 문구에서 만들었어요 ",
  safetyLevel: "green",
  category: "phrase",
  difficulty: "beginner",
  originYear: 2026,
  usageContext: { work: "yellow", friends: "green", family: "yellow", sns: "red" },
  country: "JP",
  localTitle: "  B7 自作  ",
};

export function cases() {
  const house = (label, changes = {}, extra = "") => ({
    name: `createHouseOriginal, ${label}`,
    file: FILE,
    action: "createHouseOriginal",
    endpoint: "house-original",
    page: "/admin/memes/new",
    // JSON round trip: a change to `undefined` leaves the key out.
    input: JSON.parse(JSON.stringify({ ...HOUSE, ...changes })),
    setup: () => `${houseSetup()}${extra}`,
    rows: houseRows,
    maskIds: true,
  });
  const taken = `insert into memes (title, summary, description, origin, slug, origin_kind, moderation_status)
      values ('B7 자체 선점', 's', 'd', 'o', 'b7-자체-제작-밈', 'catalog', 'pending');`;
  return [
    house("created pending with its source and profile"),
    house("no local title takes the title", { localTitle: undefined, country: "KR" }),
    house("a blank local title takes the title", { localTitle: "   " }),
    house("a taken slug gets the time", {}, taken),
    house("no year and no usage context", { originYear: null, usageContext: null }),
    house("a year as text", { originYear: "2025" }),
    house("no title", { title: "  " }),
    house("no summary", { summary: "" }),
    house("a country that is not listed", { country: "XX" }),
    house("a lower-case country", { country: "kr" }),
    house("operator notes in the origin", { origin: "pending으로 저장했고 게시는 하지 않았다" }),
    house("operator notes in the description", { description: "사실 확인과 권리 확인 전" }),
    house("a safety level that does not exist", { safetyLevel: "blue" }),
    house("a category that does not exist", { category: "song2" }),
    house("a title with no letters", { title: "B7 자체 !!!" }),
    house("a usage context that is text", { usageContext: "work" }),
  ];
}
