// lib/actions/admin-sources.ts: reviewMemeSource over the candidates of
// ../pages/b7-seed.sql (an embeddable YouTube video, a TikTok link that cannot
// be embedded, a removed video).
import { sqlText } from "../harness.mjs";

const FILE = "lib/actions/admin-sources.ts";
const PAIRS = [
  ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8b71-000000000301"],
  ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8b71-000000000302"],
  ["00000000-0000-4000-8000-000000000004", "00000000-0000-4000-8b71-000000000303"],
];
const URLS = ["https://www.youtube.com/watch?v=b7embed0001", "https://www.tiktok.com/@b7/video/1", "https://www.youtube.com/watch?v=b7gone00001"];

export function cases() {
  const memes = PAIRS.map(([meme]) => sqlText(meme)).join(", ");
  const urls = URLS.map(sqlText).join(", ");
  const entities = PAIRS.map(([meme, source]) => sqlText(`${meme}:${source}`)).join(", ");
  const setup = () => `update meme_media set review_state = 'pending', reviewer_note = null, reviewed_at = null, source_role = 'usage_example', rights_basis = 'unknown'
      where source_id::text like '00000000-0000-4000-8b71-0000000003%';
    delete from meme_sources where meme_id in (${memes}) and source_url in (${urls});
    delete from meme_contents where meme_id in (${memes}) and content_id in ('b7embed0001', 'b7gone00001');
    delete from admin_audit_log where entity_id in (${entities});`;
  const rows = () => `select json_build_object(
      'ledger', (select json_agg(json_build_object('state', review_state, 'role', source_role, 'basis', rights_basis, 'note', reviewer_note, 'at', reviewed_at is not null) order by source_id)
        from meme_media where source_id::text like '00000000-0000-4000-8b71-0000000003%'),
      'sources', (select coalesce(json_agg(json_build_object('platform', platform, 'url', source_url, 'title', title, 'creator', creator_name, 'copyright', copyright_status,
          'role', source_role, 'basis', rights_basis) order by source_url), '[]') from meme_sources where meme_id in (${memes}) and source_url in (${urls})),
      'contents', (select coalesce(json_agg(json_build_object('platform', platform, 'content', content_id, 'url', url, 'thumbnail', thumbnail_url, 'caption', caption,
          'representative', is_representative, 'availability', availability, 'status', moderation_status) order by content_id), '[]')
        from meme_contents where meme_id in (${memes}) and content_id in ('b7embed0001', 'b7gone00001')),
      'audit', (select coalesce(json_agg(json_build_object('action', action, 'entity', entity_id, 'detail', detail) order by id), '[]') from admin_audit_log where entity_id in (${entities})))`;
  const review = (name, pair, input) => ({
    name,
    file: FILE,
    action: "reviewMemeSource",
    endpoint: "source-review",
    page: "/admin/sources",
    input: { memeId: pair[0], sourceId: pair[1], ...input },
    setup,
    rows,
  });
  const [embed, link, gone] = PAIRS;
  return [
    review("reviewMemeSource, approved with an official embed", embed, { decision: "approve", sourceRole: "earliest_known", rightsBasis: "official_embed", note: " 공식 " }),
    review("reviewMemeSource, approved link-only", embed, { decision: "approve", sourceRole: "usage_example", rightsBasis: "link_only" }),
    review("reviewMemeSource, link-only as the original", embed, { decision: "approve", sourceRole: "original", rightsBasis: "link_only" }),
    review("reviewMemeSource, rights unknown", embed, { decision: "approve", sourceRole: "usage_example", rightsBasis: "unknown" }),
    review("reviewMemeSource, no role", embed, { decision: "approve", rightsBasis: "official_embed" }),
    review("reviewMemeSource, a role that does not exist", embed, { decision: "approve", sourceRole: "owner", rightsBasis: "official_embed" }),
    review("reviewMemeSource, an embed that is not allowed", link, { decision: "approve", sourceRole: "usage_example", rightsBasis: "official_embed" }),
    review("reviewMemeSource, the not-embeddable one link-only", link, { decision: "approve", sourceRole: "secondary_reference", rightsBasis: "link_only" }),
    review("reviewMemeSource, a removed source", gone, { decision: "approve", sourceRole: "usage_example", rightsBasis: "official_embed" }),
    review("reviewMemeSource, rejected with a note", gone, { decision: "reject", note: "  삭제됨  " }),
    review("reviewMemeSource, rejected without a note", gone, { decision: "reject", note: "   " }),
    review("reviewMemeSource, no such candidate", [embed[0], gone[1]], { decision: "reject", note: "x" }),
    review("reviewMemeSource, not a uuid", ["x", "y"], { decision: "reject", note: "x" }),
  ];
}
