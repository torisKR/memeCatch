-- Rows for batch B3, the sections of the Korean meme document, on top of
-- seed.sql. For a THROWAWAY database only, as a superuser:
--
--   docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q < server/parity/pages/b3-seed.sql
--
-- pgsrc005  limited, three sources without a title (one hidden), reviewed
--           dates, mixed usage contexts, controversial, two credited
--           contributors and one who is not, one reviewed market profile
--           and no variant: the "bare links" trust note and the passport
--           without variants
-- pgpas006  the market passport: two reviewed markets, one pending, a
--           reviewed variant to an indexable meme, one to a thin meme and a
--           pending one; a primary source with an author only
-- pgall008  every usage context green (the "not checked yet" verdict), no
--           caution, no tag, alone in its category with no year: no similar
--           memes and no neighbours
begin;

-- The translations name a contributor as reviewer: they go before the users.
delete from meme_translations where meme_id in (
  '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000002'
);
delete from memes where short_id in ('pgsrc005', 'pgpas006', 'pgall008');
-- Four of the rows below are in the /memes directory. Four catalog rows of
-- directory-catalog.mjs make room, so B2's last page stays page 36.
delete from memes where short_id in ('zzs4jbn2', 'zzff9cbt', 'zyvy93ab', 'zyk9j8jb') and slug like 'dir-%';
delete from auth.users where id in (
  '00000000-0000-4000-8000-0000000000c1',
  '00000000-0000-4000-8000-0000000000c2',
  '00000000-0000-4000-8000-0000000000c3'
);

-- handle_new_user() makes each profile with the nickname of the metadata.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000c1', 'b3-contributor-1@example.com', '{"nickname": "보탠사람하나"}'),
  ('00000000-0000-4000-8000-0000000000c2', 'b3-contributor-2@example.com', '{"nickname": "보탠사람둘"}'),
  ('00000000-0000-4000-8000-0000000000c3', 'b3-contributor-3@example.com', '{"nickname": "숨은사람"}');

insert into memes (
  id, short_id, slug, title, summary, description, origin, usage_note, caution,
  usage_examples, category, origin_year, year_precision, safety_level,
  lifecycle_status, moderation_status, doc_class, sentiment, usage_context,
  content_reviewed_at, safety_reviewed_at, trend_score,
  published_at, updated_at, created_at
) values (
  '00000000-0000-4000-8000-000000000005', 'pgsrc005', 'parity-sources', '패리티 출처 확인',
  '출처는 모았지만 서지 정보가 아직 없는 검증용 문서예요.',
  '패리티 출처 확인은 근거 링크는 여러 개 모였지만 어떤 자료인지 제목이나 작성자를 아직 적지 못한 문서가 어떻게 보이는지 확인하려고 만든 검증용 밈입니다. 신뢰 안내는 링크 수를 세되 원본이나 보도를 확인했다고 말하지 않아야 하고, 출처 확인 중인 문서라는 표시도 함께 붙어야 합니다. 상황별 판정은 직장과 친구와 가족과 공개 SNS에서 서로 다르게 적어 두었고, 평가가 갈리는 상태로 표시했습니다. 이 문서도 색인 기준을 넘도록 본문을 길게 적었습니다.',
  '2021년 여름 여러 커뮤니티에 비슷한 글이 한꺼번에 올라오면서 처음 눈에 띄었습니다.',
  '친한 친구 사이에서 가볍게 쓰는 말입니다.',
  '가족 대화나 공개 게시물에서는 오해를 살 수 있어 쓰지 않는 편이 좋습니다.',
  '[{"situation": "친구 단톡방", "text": "이건 패리티 출처 확인이지."}]'::jsonb,
  'phrase', 2021, 'year', 'red', 'cooling', 'limited', 'meme', 'controversial',
  '{"work": "yellow", "friends": "green", "family": "red", "sns": "gray"}'::jsonb,
  '2026-06-01T03:00:00Z', '2026-06-02T15:30:00Z', 0.5,
  '2026-06-01T00:00:00Z', '2026-06-03T00:00:00Z', '2026-06-01T00:00:00Z'
), (
  '00000000-0000-4000-8000-000000000006', 'pgpas006', 'parity-passport', '패리티 패스포트',
  '여러 나라에서 쓰이는 모습이 검수된 검증용 문서예요.',
  '패리티 패스포트는 한 밈이 어느 시장에서 어떻게 쓰이는지 검수된 정보가 있을 때 문서가 어떻게 보이는지 확인하려고 만든 검증용 밈입니다. 원본 시장과 현재 사용 시장을 나눠 적고, 시장마다 현지 이름과 언어, 사용 메모와 주의사항을 붙입니다. 같은 계보로 검수된 다른 문서가 있으면 현지 변형으로 연결하되, 아직 검수되지 않은 연결이나 색인 기준에 못 미치는 문서로 가는 연결은 보이지 않아야 합니다. 이 문서 역시 색인 기준을 넘도록 넉넉하게 적었습니다.',
  '2020년 봄 해외 커뮤니티에서 시작해 국내로 건너왔습니다.',
  null, null,
  '[{"situation": "해외 친구와", "text": "패리티 패스포트 같은 상황이네."}]'::jsonb,
  'image', 2020, 'exact', 'green', 'active', 'approved', 'meme', 'funny', '{}'::jsonb,
  null, null, 0.4,
  '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z', '2026-07-01T00:00:00Z'
), (
  '00000000-0000-4000-8000-000000000008', 'pgall008', 'parity-all-green', '패리티 올그린',
  '모든 상황에서 써도 된다고만 적힌 검증용 문서예요.',
  '패리티 올그린은 직장과 친구와 가족과 공개 SNS의 판정이 모두 써도 됨으로만 적혀 있어서, 상황별로 나눠 확인한 흔적이 없는 문서가 어떻게 보이는지 확인하려고 만든 검증용 밈입니다. 이런 문서는 상황별 표를 보여 주지 않고 아직 확인 전이라고 말해야 합니다. 분류에는 다른 문서가 없고 연도도 비워 두었으며 태그도 붙이지 않아서, 비슷한 밈이나 이어서 읽을 밈이 하나도 나오지 않아야 합니다. 본문은 색인 기준을 넘도록 길게 적었습니다.',
  '유래는 아직 확인 중입니다. 확인되는 대로 시기와 장소를 적겠습니다.',
  '어디서든 무난하게 쓰는 말이라고 적혀 있지만 아직 확인 전입니다.', null,
  '[{"situation": "어디서나", "text": "패리티 올그린!"}]'::jsonb,
  'challenge', null, 'unknown', 'green', 'rising', 'approved', 'meme', 'wholesome',
  '{"work": "green", "friends": "green", "family": "green", "sns": "green"}'::jsonb,
  null, null, 0.3,
  '2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z', '2026-08-01T00:00:00Z'
);

insert into meme_sources (meme_id, platform, source_url, title, creator_name, hidden_from_public, captured_at) values
  ('00000000-0000-4000-8000-000000000005', '', 'https://board.example.net/thread/1', null, null, false, '2026-06-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', 'web', 'https://board.example.net/thread/2', ' ', null, false, '2026-06-02T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', '내부', 'https://board.example.net/thread/3', '숨긴 글', null, true, '2026-06-02T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000006', '', 'https://overseas.example.com/post/9', null, '해외 작성자', false, '2026-07-01T00:00:00Z');

insert into meme_tags_map (meme_id, tag_id) values
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000a3');

-- Approved contributions with credit, one without, one still waiting.
insert into meme_contributions (meme_id, contributor_id, kind, source_url, example_situation, example_text, credit_public, status, reviewed_at) values
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000c1', 'source', 'https://board.example.net/thread/1', null, null, true, 'approved', '2026-06-04T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000c1', 'example', null, '단톡방', '패리티 출처 확인!', true, 'approved', '2026-06-04T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000c2', 'example', null, '회의', '출처 확인 중이에요.', true, 'approved', '2026-06-05T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000c3', 'example', null, '숨김', '이름은 빼 주세요.', false, 'approved', '2026-06-03T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000c2', 'example', null, '대기', '아직 검수 전', true, 'pending', null);

insert into meme_market_profiles (meme_id, market_code, language_tag, role, local_title, local_aliases, usage_note, caution, review_state, reviewed_at, reviewed_by) values
  ('00000000-0000-4000-8000-000000000005', 'KR', 'ko', 'origin', '패리티 출처 확인', '{}', null, null, 'reviewed', '2026-06-01T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', 'US', 'en', 'origin', 'Parity Passport', '{}', 'Started on English-language forums.', null, 'reviewed', '2026-07-01T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', 'KR', 'ko', 'active', '패리티 패스포트', '{"패패"}', '국내에서는 짧게 줄여 부릅니다.', '공식 자리에서는 쓰지 않습니다.', 'reviewed', '2026-07-01T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', 'JP', 'ja', 'adopted', 'パリティ', '{}', null, null, 'pending', null, null);

insert into meme_variant_links (source_meme_id, target_meme_id, relation_kind, review_state, reviewed_at, reviewed_by) values
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'local_variant', 'reviewed', '2026-07-01T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000002', 'derived_from', 'reviewed', '2026-07-01T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', 'local_equivalent', 'pending', null, null);

-- Two house originals (origin_kind = house_original), published as the
-- operator's attested publish leaves them; the guard trigger allows only
-- that path, so it is skipped for this throwaway seed. pgown009 has its
-- making story; pgown010 none, so the origin section shows only its label.
delete from memes where short_id in ('pgown009', 'pgown010');
set local session_replication_role = replica;
insert into memes (
  id, short_id, slug, title, summary, description, origin, usage_note, caution,
  usage_examples, category, origin_year, year_precision, safety_level,
  lifecycle_status, moderation_status, doc_class, origin_kind, sentiment, trend_score,
  published_at, updated_at, created_at
) values (
  '00000000-0000-4000-8000-000000000009', 'pgown009', 'parity-original', '패리티 오리지널',
  '밈캐치가 직접 만든 검증용 표현이에요.',
  '패리티 오리지널은 밈캐치가 직접 만든 표현이 문서에서 어떻게 보이는지 확인하려고 만든 검증용 밈입니다. 인터넷 어딘가에서 시작된 밈이 아니므로 유래 대신 제작 배경을 적고, 대표 콘텐츠 자리에는 외부 영상 대신 밈캐치가 그린 카드가 나옵니다. 신뢰 안내도 근거 링크 수를 세지 않고 밈캐치가 만들고 권리를 가진 표현이라고 말합니다. 이 문서 역시 색인 기준을 넘도록 본문을 길게 적었습니다.',
  '2026년 가을 밈캐치 편집팀이 단톡방에서 쓰기 좋은 표현을 고민하다가 만들었습니다.',
  '새로운 시도를 할 때 가볍게 씁니다.', null,
  '[{"situation": "새 프로젝트", "text": "이건 패리티 오리지널이야."}]'::jsonb,
  'phrase', 2026, 'exact', 'green', 'rising', 'approved', 'meme', 'house_original', 'funny', 0.2,
  '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', '2026-09-01T00:00:00Z'
), (
  '00000000-0000-4000-8000-000000000010', 'pgown010', 'parity-original-plain', '패리티 <오리지널> & "둘"',
  '꺾쇠와 따옴표가 든 제목의 자체 제작 검증용 표현이에요.',
  '패리티 오리지널 둘은 제목에 꺾쇠와 따옴표와 앰퍼샌드가 들어간 자체 제작 표현을 확인하려고 만든 검증용 밈입니다. 카드 그림은 제목과 요약을 SVG 안에 이스케이프해서 넣으므로, 두 서버가 같은 그림 주소를 만드는지가 여기서 드러납니다. 제작 배경은 비워 두어서 유래 자리에는 자체 제작이라는 표시만 남아야 합니다. 이 문서도 색인 기준을 넘도록 넉넉하게 적었습니다.',
  '',
  '가볍게 씁니다.', null,
  '[{"situation": "테스트", "text": "둘이야."}]'::jsonb,
  'image', null, 'unknown', 'yellow', 'active', 'approved', 'meme', 'house_original', 'funny', 0.1,
  '2026-09-03T00:00:00Z', '2026-09-04T00:00:00Z', '2026-09-03T00:00:00Z'
);
insert into meme_tags_map (meme_id, tag_id) values
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000a1');
insert into meme_sources (meme_id, platform, source_url, title, hidden_from_public, captured_at) values
  ('00000000-0000-4000-8000-000000000009', '밈캐치', 'https://notes.example.net/parity-original', '제작 노트', false, '2026-09-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000010', '밈캐치', 'https://notes.example.net/parity-original-2', '제작 노트 둘', false, '2026-09-03T00:00:00Z');
set local session_replication_role = origin;

-- Reviewed translations. pgpas006: English and Japanese current, Chinese
-- written from an older revision, traditional Chinese with no origin, all
-- reviewed; Korean links the first two. pgthin02: an English translation
-- of a noindex document, which links none.
insert into meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, status, source_updated_at, provider, model, reviewed_at, reviewed_by) values
  ('00000000-0000-4000-8000-000000000006', 'ja', 'parity-passport-ja', 'パリティパスポート', '検証用のミームです。', '各国での使われ方を検証する文書です。', '海外の掲示板で始まりました。', 'reviewed', '2026-07-02T00:00:00Z', 'parity', 'parity', '2026-07-03T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', 'en', 'parity-passport', 'Parity Passport', 'A meme made for checking.', 'A document that checks how a meme travels.', 'It started on overseas forums.', 'reviewed', '2026-07-02T00:00:00Z', 'parity', 'parity', '2026-07-03T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', 'zh', 'parity-passport-zh', '验证护照', '验证用的梗。', '检查梗如何传播的文档。', '始于海外论坛。', 'reviewed', '2026-06-01T00:00:00Z', 'parity', 'parity', '2026-07-03T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000006', 'zh-tw', 'parity-passport-tw', '驗證護照', '驗證用的梗。', '檢查梗如何傳播的文件。', '', 'reviewed', '2026-07-02T00:00:00Z', 'parity', 'parity', '2026-07-03T00:00:00Z', '00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-000000000002', 'en', 'parity-thin', 'Parity Thin', 'A thin document.', 'Only a short meaning.', 'Unknown.', 'reviewed', '2026-03-02T00:00:00.5Z', 'parity', 'parity', '2026-03-03T00:00:00Z', '00000000-0000-4000-8000-0000000000c1');

commit;
