-- 루프 026 — 최신 밈 후보 7건을 「검수 대기(pending)」로 투입하는 배치.
--
-- LOOP.md 준수 사항:
--   절대규칙 3: 이 파일은 드라이런·검토용이다. 실행은 운영자가 결정한다.
--   절대규칙 4: moderation_status를 지정하지 않아 기본값 'pending'으로 들어간다.
--               자동 공개되지 않으며, 관리자 검수(사실 확인→저작권 확인)를 거쳐야 공개된다.
--   절대규칙 5: 중복 후보 20건을 정규화 제목·alias 대조로 사전 확인해 제외했다
--               (나무 챌린지·냐냐냥·밤티·아자스·야르·샤갈·거제 야호·간바레 챌린지·
--                갑차기스러운데·골반통신·난리자베스·도티낳음·젓가락 워킹·장항준적 사고 등).
--   DQ-013 기준: 출처에 title·creator_name을 채워 「서지 확인 가능」 상태로 넣는다.
--   서술 근거가 부족한 후보 5건(김동현 밈·도마도마·매끈매끈·셋로그·힙합보단 사랑)은 보류.
--
-- usage_context는 4칸 모두 'yellow'(맥락 주의) — 미검수 초안이 'green' 기본값을 갖는
-- 기존 결함(루프 023 §5-1)을 재생산하지 않기 위한 보수적 기본값.
--
-- 적용(운영자): Supabase SQL Editor에서 실행.
-- 되돌리기: 아래 slug 7개로 delete (pending 상태라 공개 영향 없음).

begin;

with new_memes as (
  insert into memes (title, slug, aliases, summary, description, origin, category, media_type, origin_year, year_precision, lifecycle_status, safety_level, usage_context)
  values
  ('파라파라 챌린지','파라파라-챌린지',array['파라파라'],
   '난감한 상황에서 "모르겠고, 난 파라파라나 춰야겠다"며 현실을 회피하듯 무반주 파라파라 춤을 추는 챌린지',
   '걸그룹 리센느 멤버 미나미가 거제 여행 영상에서 무반주로 파라파라 춤을 춘 장면이 시초다. 당당하지만 힘이 빠진 태도가 핵심 정서로, 자막을 바꿔 상황을 변주하는 숏폼 챌린지로 번졌다.',
   '리센느 미나미의 거제 여행 유튜브 영상(2026년 6월)에서 시작됐다.',
   'challenge','video',2026,'year','rising','yellow','{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb),
  ('그린그린 레드레드','그린그린-레드레드',array['그린그린','레드레드'],
   '좋은 것은 "그린그린", 별로인 것은 "레드레드"로 색깔에 빗대 긍정·부정을 표현하는 밈',
   '보이그룹 코르티스의 곡 RED RED에서 파생됐다. 비포&애프터 형식으로 호불호를 색으로 구분해 말하는 포맷이 SNS와 마케팅 계정에서 널리 쓰인다.',
   '코르티스 곡 RED RED(2026년 5월경 확산)에서 파생됐다.',
   'phrase','video',2026,'year','rising','yellow','{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb),
  ('과자 사꾸','과자-사꾸',array['과자 사진 꾸미기'],
   '과자 포장지의 글자를 오려 조합해 메시지를 만들고 인증하는 SNS 놀이',
   '과자 포장지에 인쇄된 글자들을 모아 원하는 문장을 완성한 뒤 사진으로 인증하는 DIY 트렌드다. 수집·전시 감성의 참여형 밈으로 인스타그램을 중심으로 퍼졌다.',
   'SNS 사용자들 사이에서 자연 발생했다(2026년 5월경 확산).',
   'image','image',2026,'year','rising','yellow','{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb),
  ('갸륵체','갸륵체',array['챗GPT 어화둥둥체','어화둥둥체'],
   'AI 챗봇 특유의 과하게 상냥하고 극진한 말투를 흉내 내는 문체 밈',
   'X(트위터)에서 "GPT 말투 너무 열받는다"는 글이 1만 회 이상 리포스트되며 확산됐다. AI가 사용자를 과하게 어르고 달래는 듯한 문체를 「갸륵체」·「어화둥둥체」로 부르며 패러디하는 밈이 됐다.',
   'X(트위터)의 챗GPT 말투 지적 게시물(2026년)에서 시작됐다.',
   'phrase','text',2026,'year','rising','yellow','{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb),
  ('무마가가이','무마가가이',array['Moo Ma Ga Gai','돼지 개 까마귀 닭'],
   '태국 동요의 동물 이름 부분을 따라 부르는 손동작 게임이 숏폼 챌린지로 번진 밈',
   '태국 동요를 바탕으로 한 「돼지(무)·개(마)·까마귀(가)·닭(가이)」 게임이 2025년 말부터 세계적으로 확산돼 한국 숏폼에서도 챌린지로 유행했다.',
   '태국 동요 기반 게임(2025년 말 해외 확산, 2026년 국내 유행).',
   'challenge','video',2026,'year','rising','yellow','{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb),
  ('윤정아 챌린지','윤정아-챌린지',array['서윤정 챌린지','쇼팽피아노학원'],
   '개그우먼 정이랑의 캐릭터 「서윤정」을 흉내 내는 릴스 챌린지',
   '개그우먼 정이랑의 유튜브 채널 쇼팽피아노학원의 캐릭터 「서윤정」 말투와 행동을 따라 하는 챌린지다. 초등학생 참여 릴스가 화제가 되며 확산됐다.',
   '정이랑의 유튜브 채널 쇼팽피아노학원 캐릭터에서 시작됐다(2026년).',
   'challenge','video',2026,'year','rising','yellow','{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb),
  ('장시간 비행 밈','장시간-비행-밈',array['비행기 옆자리 골라라','장시간 비행'],
   '비행기 좌석 배치도에 인물·캐릭터를 놓고 "장시간 비행, 옆자리를 골라라"라고 묻는 선택 밈',
   '비행기 좌석 배치 이미지에 여러 인물·캐릭터를 배치하고 옆자리에 앉을 대상을 고르게 하는 참여형 밈이다. 2026년 1월 말부터 인스타그램과 커뮤니티로 확산됐다.',
   '해외 SNS의 좌석 선택 밈 형식이 2026년 1월 말 국내로 번졌다.',
   'image','image',2026,'year','rising','yellow','{"work":"yellow","friends":"yellow","family":"yellow","sns":"yellow"}'::jsonb)
  returning id, title
),
src as (
  insert into meme_sources (meme_id, platform, source_url, title, creator_name, copyright_status)
  select id, 'web',
    case when title in ('윤정아 챌린지','무마가가이','갸륵체')
      then 'https://filmora.wondershare.kr/useful-information/latest-meme-trends.html'
      else 'https://letter.wepick.kr/post/23942' end,
    case when title in ('윤정아 챌린지','무마가가이','갸륵체')
      then '틱톡·인스타그램에서 인기 폭발! 요즘 유행하는 밈 베스트'
      else '2026 트렌디한 밈 아카이브.ZIP' end,
    case when title in ('윤정아 챌린지','무마가가이','갸륵체') then 'Wondershare Filmora' else '위픽레터' end,
    'unknown'
  from new_memes
  returning meme_id
)
insert into admin_audit_log (action, entity_type, detail)
select 'ai_candidate_import','memes',
  jsonb_build_object(
    'batch','loop-026 최신 밈 후보 7건',
    'status','pending — LOOP.md 절대규칙 4에 따라 검수 대기로만 투입',
    'source','2026 밈 정리 기사 2건(위픽레터·Filmora) 기반 초안. 중복 20건 사전 대조 제외',
    'inserted',(select jsonb_agg(title) from new_memes));

commit;

-- 검증(적용 후):
--   select title, moderation_status from memes where slug in
--     ('파라파라-챌린지','그린그린-레드레드','과자-사꾸','갸륵체','무마가가이','윤정아-챌린지','장시간-비행-밈');
--   → 7행 전부 'pending' · anon 키로는 조회되지 않아야 함(RLS).
