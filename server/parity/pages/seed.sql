-- Rows for the page parity gate (pages.mjs). For a THROWAWAY database only
-- (scripts/test-db.sh), as a superuser:
--
--   docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q < server/parity/pages/seed.sql
--
-- Restart Next afterwards with an empty Data Cache (`.next/cache` of the
-- standalone build): it keeps the catalog and the discovery index for up to a day.
--
-- pgrich01  approved, passes the index gate and the ad bar: indexed, WebPage JSON-LD
-- pgthin02  limited and thin: noindex, "still being written" note
-- pgkor003  Korean slug with a space, no usage note, dialogue examples, no year
-- pgevt004  an event record, archived, one context source
begin;

delete from memes where short_id in ('pgrich01', 'pgthin02', 'pgkor003', 'pgevt004');

-- targets.txt names the migrations' AI memes (the ones with media) by short
-- id. The migrations let the database generate those ids, so they differ on
-- every database: pin them to the ones the target list uses.
update memes set short_id = 'wk36uaq4' where slug = 'ai-slop';
update memes set short_id = '9xqb3dkw' where slug = 'ballerina-cappuccina';
update memes set short_id = 'bttcbe9h' where slug = 'shrimp-jesus';
update memes set short_id = 'nhfmjk4c' where slug = 'italian-brainrot';
update memes set short_id = 'nqphdtmz' where slug = 'tralalero-tralala';
delete from tags where name like 'parity-page-%';

insert into tags (id, name) values
  ('00000000-0000-4000-8000-0000000000a1', 'parity-page-직장'),
  ('00000000-0000-4000-8000-0000000000a2', 'parity-page-단톡'),
  ('00000000-0000-4000-8000-0000000000a3', 'parity-page-2022');

insert into memes (
  id, short_id, slug, title, summary, description, origin, usage_note, caution,
  usage_examples, category, origin_year, year_precision, safety_level,
  lifecycle_status, moderation_status, doc_class, published_at, updated_at, created_at
) values (
  '00000000-0000-4000-8000-000000000001', 'pgrich01', 'parity-rich', '패리티 리치',
  '검증용으로 만든 충실한 문서로, 뜻과 유래와 예문과 출처를 모두 갖춘 밈이에요',
  '패리티 리치는 두 서버가 같은 문서를 같은 모습으로 내보내는지 확인하려고 만든 검증용 밈입니다. 실제 밈 문서처럼 뜻을 길게 풀어 쓰고, 어떤 상황에서 누가 누구에게 쓰는 말인지, 듣는 사람이 어떻게 받아들이는지까지 설명합니다. 예를 들어 회의가 길어질 때 가볍게 분위기를 풀려고 쓰거나, 친구 사이에서 서로의 실수를 웃어넘길 때 씁니다. 다만 처음 만난 사람이나 공식적인 자리에서는 뜻이 전달되지 않을 수 있어서 주의가 필요합니다. 이 문서는 색인 기준인 이백오십 자의 고유한 본문을 넉넉히 넘기도록 일부러 길게 적었습니다. 문장이 여러 개인 까닭은 줄바꿈과 공백이 그대로 보존되는지도 함께 확인하기 위해서입니다.

둘째 문단입니다. 줄바꿈이 있는 본문도 같은 글자로 나와야 합니다. "따옴표"와 <꺾쇠> 그리고 & 기호도 그대로 보여야 합니다.',
  '2022년 가을 한 개발자 커뮤니티의 게시글에서 처음 쓰였고, 이후 여러 단체 대화방으로 퍼지면서 지금의 뜻으로 굳어졌습니다.',
  '가까운 동료나 친구 사이에서 가볍게 웃고 넘어갈 일이 생겼을 때 씁니다. 글보다 말로 할 때 더 자연스럽습니다.',
  '처음 만난 사람이나 고객 앞에서는 쓰지 않는 편이 좋습니다. 뜻을 모르는 사람에게는 비꼬는 말로 들릴 수 있습니다.',
  '[{"situation": "회의가 길어질 때", "text": "이쯤 되면 패리티 리치 아닌가요?"},
    {"situation": "친구의 실수", "text": "괜찮아, 그건 그냥 패리티 리치야."}]'::jsonb,
  'phrase', 2022, 'unknown', 'green', 'active', 'approved', 'meme',
  '2026-01-05T03:04:05.678Z', '2026-02-10T11:12:13.456Z', '2026-01-01T00:00:00Z'
), (
  '00000000-0000-4000-8000-000000000002', 'pgthin02', 'parity-thin', '패리티 씬',
  '아직 내용이 얇은 검증용 문서예요',
  '뜻만 짧게 적혀 있는 문서입니다. 색인 기준에 못 미칩니다.',
  '', null, null, null,
  'image', 2024, 'year', 'yellow', 'cooling', 'limited', 'meme',
  '2026-03-01T00:00:00Z', '2026-03-02T00:00:00.5Z', '2026-03-01T00:00:00Z'
), (
  '00000000-0000-4000-8000-000000000003', 'pgkor003', '중꺾마 정신', '중꺾마 정신 (검증용)',
  '중요한 건 꺾이지 않는 마음이라는 말을 줄인 표현을 검증용으로 옮긴 문서예요.',
  '중꺾마 정신은 중요한 것은 꺾이지 않는 마음이라는 문장을 줄여 부르는 말을 검증용으로 옮겨 적은 문서입니다. 어려운 상황에서도 포기하지 않겠다는 다짐을 가볍고 유쾌하게 드러낼 때 씁니다. 시험을 앞둔 학생이 서로를 응원하거나, 마감이 코앞인 팀이 스스로를 다독일 때 자주 등장합니다. 응원의 뜻이 분명해서 대부분의 자리에서 무리 없이 통하지만, 이미 크게 실패한 사람에게 쓰면 위로가 아니라 훈계처럼 들릴 수 있습니다. 이 문서는 한글 주소가 퍼센트 인코딩으로 한 번만 정규화되는지 확인하려고 주소에 한글과 공백을 넣었고, 본문도 색인 기준을 넘기도록 넉넉하게 적었습니다.',
  '2022년 겨울 한 이(e)스포츠 선수의 인터뷰 기사 제목에서 나온 말로, 같은 해 축구 대표팀의 응원 문구로 쓰이며 널리 퍼졌습니다.',
  null, null,
  '[{"situation": "마감 전날", "text": "중꺾마!", "dialogue": [
      {"speaker": "팀장", "line": "오늘 안에 끝낼 수 있을까요?"},
      {"speaker": "나", "line": "중꺾마 정신으로 갑니다."}]},
    {"situation": "시험 응원", "text": "중꺾마, 끝까지 가 보자."},
    {"situation": "빈 상황", "text": " "}]'::jsonb,
  'song', null, 'unknown', 'red', 'rising', 'approved', 'meme',
  '2026-04-01T09:00:00Z', '2026-04-02T09:00:00Z', '2026-04-01T00:00:00Z'
), (
  '00000000-0000-4000-8000-000000000004', 'pgevt004', 'parity-event', '패리티 사건 기록',
  '밈이 아니라 인터넷 문화 사건을 적은 검증용 문서예요.',
  '패리티 사건 기록은 하나의 유행어가 아니라 인터넷에서 벌어진 일을 정리한 문서가 어떻게 보이는지 확인하려고 만든 검증용 기록입니다. 사건 문서는 밈 문서와 같은 틀을 쓰지만, 정답 카드에 사건 기록이라는 표시가 붙고 쓰임새보다 경과와 맥락을 설명하는 데 무게를 둡니다. 언제 무슨 일이 있었고, 그 일이 어떤 표현이나 놀이로 이어졌는지를 시간 순서대로 적습니다. 이 문서 역시 색인 기준을 넘도록 본문을 길게 적었으며, 참고 출처는 맥락을 설명하는 위키 문서 하나만 연결해 두었습니다. 그래서 대표 콘텐츠 자리에는 원본 대신 출처에서 맥락을 확인하라는 안내가 나와야 합니다.',
  '2019년 봄 한 온라인 커뮤니티에서 벌어진 일을 계기로 알려졌고, 이후 여러 차례 다시 언급되었습니다.',
  '사건을 설명하거나 당시 분위기를 떠올릴 때 언급합니다. 농담의 소재로 삼기보다는 맥락을 전할 때 씁니다.',
  null,
  '[]'::jsonb,
  'comment', 2019, 'exact', 'gray', 'archived', 'approved', 'event',
  '2026-05-01T00:00:00Z', '2026-05-03T00:00:00Z', '2026-05-01T00:00:00Z'
);

insert into meme_sources (meme_id, platform, source_url, title, hidden_from_public, captured_at) values
  ('00000000-0000-4000-8000-000000000001', '기사', 'https://news.example.org/articles/parity-rich', '패리티 리치가 퍼진 과정', false, '2026-01-02T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'wiki', 'https://namu.wiki/w/패리티', '패리티 문서', null, '2026-01-03T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', '내부', 'https://hidden.example.org/secret', '숨긴 출처', true, '2026-01-04T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000003', '기사', 'https://sports.example.org/interview/1', '인터뷰 기사', false, '2026-04-01T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000003', '방송', 'https://tv.example.org/clip/2', '응원 영상 소개', false, '2026-04-01T01:00:00Z'),
  ('00000000-0000-4000-8000-000000000004', 'wiki', 'https://ko.wikipedia.org/wiki/패리티', '위키백과 문서', false, '2026-05-01T00:00:00Z');

insert into meme_tags_map (meme_id, tag_id) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000a2'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000a3');

commit;
