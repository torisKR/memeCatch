-- Rows for the B2 list pages of the page gate and the behaviour gate, on top
-- of seed.sql. For a THROWAWAY database only, as a superuser:
--
--   docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q < server/parity/pages/b2-seed.sql
--
-- Restart Next afterwards with an empty Data Cache.
--
-- 24 indexable memes (pgb2..), spread so that every list of lib/collections.ts
-- has three or more of them but one: `classic` gets two, below the three a
-- list needs, so it shows its intro and no cards. Their cards cover every art
-- of the meme card:
--   pgb2art1  owned card art (an image content) that does not load: the poster takes its place
--   pgb2ytv2  a YouTube video: its still
--   pgb2tik3  one TikTok post: the TikTok player behind a button
--   pgb2rel4  one Instagram reel: the Instagram player
--   pgb2pst5  an Instagram post nobody verified as a video: no player, the poster
--   pgb2ver6  a verified Instagram post with its stored cover: still and player
--   pgb2two7  two TikTok posts, none representative: no player
--   pgb2ded8  a dead YouTube video: the poster
begin;

delete from memes where short_id like 'pgb2%';

create temporary table b2 (
  n int, short_id text, title text, summary text, category meme_category, origin_year int,
  difficulty meme_difficulty, trend_score double precision, safety safety_level
) on commit drop;

insert into b2 values
  (1, 'pgb2art1', '그림 카드 밈', '카드 그림이 있는데 불러오지 못하는 밈', 'phrase', 2023, 'beginner', 90, 'green'),
  (2, 'pgb2ytv2', '유튜브 영상 밈', '대표 영상이 유튜브인 밈', 'challenge', 2021, 'normal', 85, 'yellow'),
  (3, 'pgb2tik3', '틱톡 챌린지 밈', '대표 영상이 틱톡 게시물 하나인 밈', 'challenge', 2024, 'beginner', 80, 'green'),
  (4, 'pgb2rel4', '인스타 릴스 밈', '대표 영상이 인스타그램 릴스인 밈', 'challenge', 2022, 'normal', 75, 'gray'),
  (5, 'pgb2pst5', '인스타 게시물 밈', '영상인지 확인되지 않은 인스타그램 게시물', 'image', 2016, 'normal', 70, 'red'),
  (6, 'pgb2ver6', '확인된 게시물 밈', '검수자가 영상으로 확인한 인스타그램 게시물', 'image', 2017, 'beginner', 65, 'yellow'),
  (7, 'pgb2two7', '틱톡 두 개 밈', '대표가 없는 틱톡 게시물 두 개', 'image', 2018, 'normal', 60, 'green'),
  (8, 'pgb2ded8', '끊긴 영상 밈', '대표 영상이 사라진 밈', 'song', 2019, 'normal', 55, 'gray'),
  (9, 'pgb2sng9', '광고 노래 밈', '광고 노래에서 나온 밈', 'song', 2005, 'normal', 50, 'green'),
  (10, 'pgb2s10a', '역주행 노래 밈', '역주행한 노래의 한 소절', 'song', 2007, 'deep', 45, 'yellow'),
  (11, 'pgb2s11b', '스트리머 말버릇 밈', '스트리머 방송에서 퍼진 말버릇', 'phrase', 2015, 'normal', 40, 'yellow'),
  (12, 'pgb2s12c', '치지직 클립 밈', '인터넷 방송 클립에서 나온 밈', 'comment', 2023, 'normal', 35, 'green'),
  (13, 'pgb2s13d', 'BJ 리액션 밈', 'BJ의 리액션 장면', 'comment', 2012, 'normal', 30, 'red'),
  (14, 'pgb2g14e', '게임 중계 어록', 'e스포츠 중계에서 나온 말', 'phrase', 2014, 'normal', 28, 'green'),
  (15, 'pgb2g15f', '롤 채팅 밈', '롤 채팅창에서 퍼진 말', 'phrase', 2013, 'beginner', 26, 'yellow'),
  (16, 'pgb2g16g', '배틀그라운드 밈', '배틀그라운드에서 나온 장면', 'image', 2018, 'normal', 24, 'gray'),
  (17, 'pgb2c17h', '90년대 개그 유행어', '개그 프로그램에서 나온 유행어', 'phrase', 1994, 'normal', 22, 'green'),
  (18, 'pgb2c18j', 'CF 카피 밈', '광고 카피가 유행어가 된 경우', 'phrase', 1998, 'normal', 20, 'yellow'),
  (19, 'pgb2d19k', '싸이월드 감성 밈', '싸이월드 시절의 감성', 'image', 2004, 'normal', 18, 'gray'),
  (20, 'pgb2d20m', '디시 짤방 밈', '디시인사이드 짤방', 'image', 2006, 'normal', 16, 'green'),
  (21, 'pgb2d21n', '플래시 애니 밈', '플래시 애니메이션 시절의 밈', 'dance', 2003, 'normal', 14, 'yellow'),
  (22, 'pgb2t22p', '급식체 밈', '급식체 말투', 'phrase', 2016, 'beginner', 12, 'red'),
  (23, 'pgb2t23q', '예능 자막 밈', '예능 자막이 밈이 된 경우', 'comment', 2011, 'normal', 10, 'green'),
  (24, 'pgb2n24r', '숏폼 댄스 밈', '숏폼 플랫폼의 춤', 'dance', 2025, 'normal', 8, 'yellow');

insert into memes (
  id, short_id, slug, title, summary, description, origin, usage_note, usage_examples,
  category, origin_year, year_precision, safety_level, lifecycle_status, moderation_status,
  doc_class, difficulty, trend_score, published_at, updated_at, created_at
)
select
  ('00000000-0000-4000-8000-0000000002' || lpad(n::text, 2, '0'))::uuid,
  short_id, 'b2-' || short_id, title, summary,
  title || '은(는) 목록 페이지를 두 서버에서 비교하려고 만든 검증용 밈입니다. 실제 문서처럼 뜻을 길게 풀어 쓰고, 어떤 상황에서 누가 누구에게 쓰는 말인지, 듣는 사람이 어떻게 받아들이는지까지 설명합니다. 회의가 길어질 때 분위기를 풀거나 친구 사이에서 실수를 웃어넘길 때 씁니다. 처음 만난 사람이나 공식적인 자리에서는 뜻이 전달되지 않을 수 있어서 주의가 필요합니다. 이 문서는 색인 기준을 넉넉히 넘기도록 일부러 길게 적었습니다. 카드의 그림과 영상 미리보기, 모음과 탐색과 시간순 목록이 같은 행을 읽어 같은 순서로 보여 주는지 확인하는 데 씁니다. 문장이 여러 개인 까닭은 본문이 사백 자를 넘겨야 높은 점수를 받기 때문입니다.',
  origin_year || '년 무렵 한 커뮤니티에서 처음 쓰였고, 이후 여러 단체 대화방과 숏폼 영상으로 퍼지면서 지금의 뜻으로 굳어졌습니다.',
  '가까운 사이에서 가볍게 웃고 넘어갈 일이 생겼을 때 씁니다. 글보다 말로 할 때 더 자연스럽습니다.',
  '[{"situation": "회의가 길어질 때", "text": "이쯤 되면 그 밈이죠."}]'::jsonb,
  category, origin_year, 'year', safety, 'active', 'approved', 'meme',
  difficulty, trend_score,
  -- The first four are this week's for /weekly (minutes before the seed ran,
  -- unless it ran in the first hour of a Korean Monday); the rest fixed.
  case when n <= 4 then now() - n * interval '10 minutes'
       else ('2026-11-' || lpad((25 - n)::text, 2, '0') || 'T09:00:00Z')::timestamptz end,
  '2026-11-24T00:00:00Z', '2026-11-01T00:00:00Z'
from b2;

insert into meme_contents (meme_id, type, platform, url, content_id, thumbnail_url, is_representative, availability, moderation_status, manual_video_verified) values
  ('00000000-0000-4000-8000-000000000201', 'image', null, null, null, 'https://catchmeme.com/api/media/meme-card-art/pgb2art1.webp', true, 'live', 'approved', false),
  ('00000000-0000-4000-8000-000000000202', 'video', 'youtube', 'https://www.youtube.com/watch?v=b2Video0001', 'b2Video0001', null, true, 'live', 'approved', false),
  ('00000000-0000-4000-8000-000000000203', 'video', 'tiktok', 'https://www.tiktok.com/@memecatch/video/7300000000000000001', '7300000000000000001', null, true, 'live', 'approved', false),
  ('00000000-0000-4000-8000-000000000204', 'video', 'instagram', 'https://www.instagram.com/reel/B2reelCode1/', 'B2reelCode1', null, true, 'live', 'approved', false),
  ('00000000-0000-4000-8000-000000000205', 'video', 'instagram', 'https://www.instagram.com/p/B2postCode5/', 'B2postCode5', null, true, 'live', 'approved', false),
  ('00000000-0000-4000-8000-000000000206', 'video', 'instagram', 'https://www.instagram.com/p/B2postCode6/', 'B2postCode6', 'https://catchmeme.com/api/media/meme-thumbs/verified/instagram/B2postCode6.jpg', true, 'live', 'approved', true),
  ('00000000-0000-4000-8000-000000000207', 'video', 'tiktok', 'https://www.tiktok.com/@memecatch/video/7300000000000000007', '7300000000000000007', null, false, 'live', 'approved', false),
  ('00000000-0000-4000-8000-000000000207', 'video', 'tiktok', 'https://www.tiktok.com/@memecatch/video/7300000000000000008', '7300000000000000008', null, false, 'live', 'approved', false),
  ('00000000-0000-4000-8000-000000000208', 'video', 'youtube', 'https://www.youtube.com/watch?v=b2Video0008', 'b2Video0008', null, true, 'dead', 'approved', false);

-- `meme_contents_manual_video_projection_guard` keeps the flag a projection
-- of the review ledger and clears it on insert; set it past the trigger.
set local session_replication_role = replica;
update meme_contents set manual_video_verified = true
 where meme_id = '00000000-0000-4000-8000-000000000206';
set local session_replication_role = origin;

commit;
