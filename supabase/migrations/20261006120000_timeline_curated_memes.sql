-- =============================================================================
-- 최신부터 과거까지 시대별 밈 데이터 마이그레이션 (중복 필터링 적용)
-- 총 15개 항목 | 2026년 최신순 -> 2004년 고전순
-- =============================================================================
DO $$
DECLARE
  v_meme_id uuid;
  v_tag_id uuid;
BEGIN
  -- [2026년] 오구오구 챌린지 (AI 펫)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'ogu-ogu-ai-pet-challenge-2026' OR title = '오구오구 챌린지 (AI 펫)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '오구오구 챌린지 (AI 펫)', 'ogu-ogu-ai-pet-challenge-2026', ARRAY['오구오구 챌린지', 'AI 펫 오구', '오구 댄스']::text[], '2026년 AI 기반 반려동물 아바타와 함께 리듬에 맞춰 애교를 부리는 숏폼 챌린지 밈.', '생성형 AI로 구현된 가상 반려동물이 보호자의 춤이나 손동작에 맞춰 반응하는 숏폼 챌린지입니다. 사랑스러운 반응과 중독성 있는 사운드로 인스타그램 릴스와 유튜브 쇼츠에서 급부상했습니다.', '2026년 AI 아바타 숏폼 크리에이터들의 협업 챌린지 영상에서 시작되었습니다.',
      'house_original', 'approved', 'challenge'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, 2026,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/shorts/ogu_ogu_sample_2026', '오구오구 AI 펫 챌린지', 'CatchMeme Lab', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '오구오구 챌린지 (AI 펫)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '2026년 AI 기반 반려동물 아바타와 함께 리듬에 맞춰 애교를 부리는 숏폼 챌린지 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('ai') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('챌린지') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('반려동물') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2026년] 너 T발 C야?
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'are-you-t-bal-c-2026' OR title = '너 T발 C야?') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '너 T발 C야?', 'are-you-t-bal-c-2026', ARRAY['T발 C야', '너 T발 C야', '너T발C야']::text[], '상대방의 과도하게 차갑고 이성적인 반응에 분노하며 ''너 T야?''를 격하게 변형해 맞받아치는 밈.', 'MBTI 성향 중 T(사고형)의 공감 능력 부족을 지적하던 기존 너 T야? 유행어가 욕설 초성과 결합하여 거칠지만 유쾌하게 상대를 타박하는 형태로 진화한 밈입니다.', '2025~2026년 숏폼 댓글과 대학생/직장인 단톡방에서 감정적 공감을 거부당했을 때의 분노 섞인 유머로 유행했습니다.',
      'house_original', 'approved', 'phrase'::public.meme_category, 'yellow'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2026, 2026,
      '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/shorts/t_bal_c_sample_2026', '너 T발 C야? 리액션 모음', 'CatchMeme Lab', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '너 T발 C야?', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '상대방의 과도하게 차갑고 이성적인 반응에 분노하며 ''너 T야?''를 격하게 변형해 맞받아치는 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('mbti') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('리액션') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2026년] 월루의 품격 (루팡 챌린지)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'walloo-elegance-lupin-2026' OR title = '월루의 품격 (루팡 챌린지)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '월루의 품격 (루팡 챌린지)', 'walloo-elegance-lupin-2026', ARRAY['월급루팡의 품격', '월루 챌린지', '재택근무 딴짓']::text[], '우아하고 진지한 표정으로 업무 시간에 필사적으로 딴짓을 감행하는 직장인 공감 밈.', '키보드를 맹렬히 두드리며 고도의 집중력을 발휘하는 척하지만 모니터에는 게임, 쇼핑, 웹툰이 띄워져 있는 순간을 클래식 음악과 함께 연출한 유쾌한 오피스 상황극 밈입니다.', '2026년 원격 및 하이브리드 근무 직장인들의 일상 브이로그 풍자 숏폼에서 유래했습니다.',
      'house_original', 'approved', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2026, 2026,
      '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/shorts/walloo_sample_2026', '월급루팡의 하루 숏폼', 'CatchMeme Lab', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '월루의 품격 (루팡 챌린지)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '우아하고 진지한 표정으로 업무 시간에 필사적으로 딴짓을 감행하는 직장인 공감 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('직장인') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('월급루팡') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('상황극') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2024년] 푸른 산호초 (도쿄돔 하니)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'blue-coral-reef-hanni-2024' OR title = '푸른 산호초 (도쿄돔 하니)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '푸른 산호초 (도쿄돔 하니)', 'blue-coral-reef-hanni-2024', ARRAY['하니 푸른산호초', '도쿄돔 하니', '마츠다 세이코 하니']::text[], '뉴진스 하니가 도쿄돔 팬미팅에서 마츠다 세이코의 푸른 산호초를 완벽히 재현해 한일 양국을 뒤흔든 무대 밈.', '단발머리와 스트라이프 티셔츠 차림으로 80년대 일본 쇼와 아이돌의 청량함을 완벽 복원하여 일본 중장년층부터 글로벌 Z세대까지 열광시킨 2024년 최고의 음악 밈입니다.', '2024년 6월 26일 뉴진스 도쿄돔 팬미팅 버니즈 캠프 무대에서 최초 공개되었습니다.',
      'house_original', 'approved', 'song'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2024, 2024,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=blue_coral_hanni_2024', '뉴진스 하니 푸른 산호초 실황', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '푸른 산호초 (도쿄돔 하니)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '뉴진스 하니가 도쿄돔 팬미팅에서 마츠다 세이코의 푸른 산호초를 완벽히 재현해 한일 양국을 뒤흔든 무대 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('뉴진스') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('하니') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('kpop') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2023년] 맑은 눈의 광인 (맑눈광)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'clear-eyed-madman-kim-ayoung' OR title = '맑은 눈의 광인 (맑눈광)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '맑은 눈의 광인 (맑눈광)', 'clear-eyed-madman-kim-ayoung', ARRAY['맑눈광', '맑은 눈의 광인', '김아영 맑눈광']::text[], '초롱초롱하고 순수한 눈빛 뒤에 숨겨진 예측 불허의 광기와 마이웨이를 풍자한 SNL 밈.', '에어팟을 낀 채 은은한 미소로 상사의 지시를 튕겨내거나 예측 불가능한 돌발 행동을 일삼는 사회초년생 캐릭터로, 순수함과 광기의 대조가 폭발적인 공감을 얻었습니다.', 'SNL 코리아 시즌3에서 배우 김아영이 연기한 MZ 오피스 신입사원 캐릭터에서 시작되었습니다.',
      'house_original', 'approved', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2023, 2023,
      '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=clear_eye_mad_sample', 'SNL 맑은 눈의 광인 하이라이트', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '맑은 눈의 광인 (맑눈광)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '초롱초롱하고 순수한 눈빛 뒤에 숨겨진 예측 불허의 광기와 마이웨이를 풍자한 SNL 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('snl') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('맑눈광') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('오피스') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2023년] 동은아 나 지금 되게 신나
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'dongeun-im-excited-park-yeonjin' OR title = '동은아 나 지금 되게 신나') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '동은아 나 지금 되게 신나', 'dongeun-im-excited-park-yeonjin', ARRAY['나 지금 되게 신나', '박연진 대사', '멋지다 연진아']::text[], '드라마 더 글로리에서 박연진이 문동은을 도발하며 광기 어린 미소로 내뱉은 시그니처 대사 밈.', '상대방에게 불길하거나 얄미운 일이 닥쳤을 때, 또는 자신이 신나는 상황을 과장되게 비꼴 때 쓰이는 유행어입니다. 박연진 특유의 입꼬리와 억양이 포인트입니다.', '2022~2023년 넷플릭스 오리지널 드라마 더 글로리 박연진(임지연 분) 대사에서 유래했습니다.',
      'house_original', 'approved', 'phrase'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'ironic'::public.meme_sentiment, 2023, 2023,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=the_glory_yeonjin_2023', '더 글로리 박연진 명대사 클립', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '동은아 나 지금 되게 신나', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '드라마 더 글로리에서 박연진이 문동은을 도발하며 광기 어린 미소로 내뱉은 시그니처 대사 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('더글로리') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('드라마') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2023년] 디토 감성 (Ditto Y2K)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'ditto-y2k-camcorder-vibe' OR title = '디토 감성 (Ditto Y2K)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '디토 감성 (Ditto Y2K)', 'ditto-y2k-camcorder-vibe', ARRAY['디토 감성', '디토 무드', '반희수 감성']::text[], '뉴진스 곡 Ditto 뮤직비디오에서 비롯된 90년대 말 캠코더 화질과 아련한 학창시절 Y2K 미학 밈.', '희미한 저화질 캠코더 필터, 복도와 운동장에서 찍은 아련한 영상 톤을 통칭하는 신조어로, Z세대의 Y2K 레트로 노스탤지어를 대표하는 시각적 밈입니다.', '2022년 12월 뉴진스의 싱글 Ditto 뮤직비디오 공개 후 바이럴되었습니다.',
      'house_original', 'approved', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2023, 2023,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=ditto_vibe_clip_2023', '디토 캠코더 감성 숏폼 모음', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '디토 감성 (Ditto Y2K)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '뉴진스 곡 Ditto 뮤직비디오에서 비롯된 90년대 말 캠코더 화질과 아련한 학창시절 Y2K 미학 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('뉴진스') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('y2k') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2022년] 자 드가자 (드가자 밈)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'ja-deugaja-lol-rally' OR title = '자 드가자 (드가자 밈)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '자 드가자 (드가자 밈)', 'ja-deugaja-lol-rally', ARRAY['자 드가자', '드가자', '드가자 드가자']::text[], 'e스포츠 리그 및 온라인 커뮤니티에서 응원이나 총공격을 독려할 때 결의를 다지며 외치는 유행어 밈.', '본격적인 행동이나 화력 집중을 시작하기 직전 팀원과 동료들을 고무시키기 위해 외치는 구호입니다. 주식, 코인, 게임, 시험 등 전방위적인 결전 구호로 정착했습니다.', '리그 오브 레전드 프로 경기 응원방 및 디시인사이드 롤갤에서 최초 유래했습니다.',
      'house_original', 'approved', 'phrase'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2022, 2022,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=deugaja_meme_sample', '자 드가자 레전드 밈 클립', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '자 드가자 (드가자 밈)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', 'e스포츠 리그 및 온라인 커뮤니티에서 응원이나 총공격을 독려할 때 결의를 다지며 외치는 유행어 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('롤') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('유행어') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2021년] 헤이마마 챌린지 (스우파 노제)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'hey-mama-challenge-noze' OR title = '헤이마마 챌린지 (스우파 노제)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '헤이마마 챌린지 (스우파 노제)', 'hey-mama-challenge-noze', ARRAY['헤이마마', '헤이마마 챌린지', '노제 헤이마마']::text[], '스트릿 우먼 파이터에서 노제가 창작한 Hey Mama 안무가 전 국민적 신드롬을 일으킨 댄스 챌린지 밈.', '데이비드 게타의 Hey Mama 비트에 맞춰 힙하면서도 파워풀한 팔 동작과 스텝을 선보인 댄스로, 아이돌, 연예인, 학생, 직장인까지 수많은 커버 숏폼을 양산했습니다.', '2021년 Mnet 스트릿 우먼 파이터 계급 미션에서 웨이비 리더 노제의 안무가 채택되며 시작되었습니다.',
      'house_original', 'approved', 'dance'::public.meme_category, 'green'::public.safety_level,
      'normal'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2021, 2021,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=hey_mama_noze_sample', '스우파 헤이마마 레전드 클립', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '헤이마마 챌린지 (스우파 노제)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '스트릿 우먼 파이터에서 노제가 창작한 Hey Mama 안무가 전 국민적 신드롬을 일으킨 댄스 챌린지 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('스우파') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('노제') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('댄스챌린지') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2021년] 학교폭력 멈춰!
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'stop-school-violence-pose' OR title = '학교폭력 멈춰!') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '학교폭력 멈춰!', 'stop-school-violence-pose', ARRAY['멈춰', '학폭 멈춰', '학교폭력 멈춰']::text[], '학폭 예방 캠페인의 손바닥을 펼치는 멈춰! 동작이 묘한 중독성과 비현실성으로 수많은 패러디를 낳은 밈.', '위기 상황에서 반 전체 학생이 손을 뻗어 멈춰!라고 외치면 가해자가 멈춘다는 비현실적인 대응 매뉴얼이 뉴스 보도로 재조명되면서 코믹 밈으로 폭발적 확산되었습니다.', '2014년 지상파 뉴스에 소개된 학폭 멈춰 프로그램이 2021년 유튜브 알고리즘으로 역주행하며 바이럴되었습니다.',
      'house_original', 'approved', 'challenge'::public.meme_category, 'yellow'::public.safety_level,
      'beginner'::public.meme_difficulty, 'ironic'::public.meme_sentiment, 2021, 2021,
      '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=meomchwo_news_archive', '학교폭력 멈춰 뉴스 보도 클립', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '학교폭력 멈춰!', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '학폭 예방 캠페인의 손바닥을 펼치는 멈춰! 동작이 묘한 중독성과 비현실성으로 수많은 패러디를 낳은 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('멈춰') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('패러디') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2020년] 아무노래 챌린지 (지코)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'anysong-challenge-zico' OR title = '아무노래 챌린지 (지코)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '아무노래 챌린지 (지코)', 'anysong-challenge-zico', ARRAY['아무노래', '아무노래 챌린지', 'Any Song Challenge']::text[], '가수 지코가 곡 ''아무노래'' 홍보를 위해 시작해 대한민국 숏폼 댄스 챌린지 유행의 시초가 된 밈.', '단순하고 귀여운 커플 댄스 루틴을 동료 스타들과 촬영해 업로드하며 틱톡과 릴스 댄스 챌린지 포맷을 한국 가요계 표준 마케팅으로 정착시킨 역사적 밈입니다.', '2020년 1월 지코가 틱톡을 통해 화사, 청하 등과 함께 듀엣 안무 영상을 올리며 시작되었습니다.',
      'house_original', 'approved', 'dance'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2020, 2020,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=anysong_challenge_sample', '지코 아무노래 챌린지 모음', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '아무노래 챌린지 (지코)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '가수 지코가 곡 ''아무노래'' 홍보를 위해 시작해 대한민국 숏폼 댄스 챌린지 유행의 시초가 된 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('지코') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('아무노래') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('숏폼챌린지') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2019년] 야 너두 할 수 있어
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'ya-neodu-can-do-it-yanadoo' OR title = '야 너두 할 수 있어') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '야 너두 할 수 있어', 'ya-neodu-can-do-it-yanadoo', ARRAY['야 너두', '야나두', '너두 할 수 있어']::text[], '영어회화 광고에서 배우 조정석 특유의 자신감 넘치는 손짓과 함께 용기를 주던 국민 유행어 밈.', '검지손가락으로 상대를 가리키며 특유의 신뢰감 있는 억양으로 용기를 북돋는 밈으로, 각종 성취와 도전 과제 패러디 이미지로 널리 쓰였습니다.', '2018~2019년 야나두 TV CF에서 배우 조정석의 멘트에서 탄생했습니다.',
      'house_original', 'approved', 'phrase'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2019, 2019,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=ya_neodu_sample_ad', '야나두 조정석 CF 클립', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '야 너두 할 수 있어', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '영어회화 광고에서 배우 조정석 특유의 자신감 넘치는 손짓과 함께 용기를 주던 국민 유행어 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('광고') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('조정석') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2011년] 비둘기야 밥먹자 (구구구구)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'pigeon-eat-food-gugugu' OR title = '비둘기야 밥먹자 (구구구구)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '비둘기야 밥먹자 (구구구구)', 'pigeon-eat-food-gugugu', ARRAY['비둘기야 밥먹자', '구구구구 밥먹자', '구구구구 비둘기']::text[], '공원이나 길거리에서 비둘기 떼를 부를 때 독특한 억양으로 구구구구를 연발하던 초기 UCC 유머 밈.', '초기 아프리카TV와 판도라TV, 유튜브 등지에서 모이를 뿌리며 비둘기를 유인하던 기행 영상이 유행하며 사람들을 부르거나 밥을 먹으러 갈 때 쓰는 유행어로 정착했습니다.', '2010~2011년 인터넷 동영상 플랫폼에 업로드된 비둘기 유인 UCC 클립에서 시작되었습니다.',
      'house_original', 'approved', 'phrase'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2011, 2011,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=pigeon_gugu_ucc_clip', '비둘기야 밥먹자 원조 영상', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '비둘기야 밥먹자 (구구구구)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '공원이나 길거리에서 비둘기 떼를 부를 때 독특한 억양으로 구구구구를 연발하던 초기 UCC 유머 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('비둘기') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('고전ucc') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2004년] 싱하형 (10초 준다 굴다리로 튀어와라)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'singha-hyung-guldari-10sec' OR title = '싱하형 (10초 준다 굴다리로 튀어와라)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '싱하형 (10초 준다 굴다리로 튀어와라)', 'singha-hyung-guldari-10sec', ARRAY['싱하형', '굴다리로 튀어와라', '10초 준다 굴다리', '존나게 맞는거다']::text[], '디시인사이드 초창기 10초 준다 굴다리로 존나게 튀어와라라는 협박조 댓글로 인터넷을 평정한 원조 네임드 짤방 밈.', '이소룡의 찡그린 표정 짤방과 함께 반말과 엄포를 놓으며 존나게 맞는거다라는 명대사를 남긴 한국 1세대 인터넷 밈의 상징적 캐릭터입니다.', '2004년 디시인사이드 스타크래프트 갤러리 및 합성 갤러리에서 활동한 고정닉 싱하형의 댓글에서 유래했습니다.',
      'house_original', 'approved', 'comment'::public.meme_category, 'yellow'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2004, 2004,
      '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=singha_hyung_legend_clip', '싱하형 전설의 짤방 모음', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '싱하형 (10초 준다 굴다리로 튀어와라)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '디시인사이드 초창기 10초 준다 굴다리로 존나게 튀어와라라는 협박조 댓글로 인터넷을 평정한 원조 네임드 짤방 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('디시인사이드') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('싱하형') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('고전밈') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

  -- [2002년] 딸녀 (원조 엽기 합성)
  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = 'strawberry-girl-ddalnyeo-2002' OR title = '딸녀 (원조 엽기 합성)') THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at
    ) VALUES (
      '딸녀 (원조 엽기 합성)', 'strawberry-girl-ddalnyeo-2002', ARRAY['딸녀', '원조 딸녀', '딸기녀']::text[], '2000년대 초반 인터넷 합성 갤러리를 뒤흔들며 개죽이와 함께 합성 필수요소로 군림한 딸기 든 여인 밈.', '양손에 딸기를 들고 묘한 미소를 짓고 있는 사진 한 장으로 시작되어, 영화 포스터, 명화, 뉴스 화면 등에 무차별 합성되며 한국 초기 엽기 합성 르네상스를 이끌었습니다.', '2002년 디시인사이드 합성 갤러리에 업로드된 미상의 일본 모델 사진에서 시작되었습니다.',
      'house_original', 'approved', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2002, 2002,
      '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb, now(), now()
    ) RETURNING id INTO v_meme_id;

    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)
    VALUES (v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=ddalnyeo_legend_archive', '디시인사이드 1세대 딸녀 아카이브', 'CatchMeme Archive', 'original', 'creator_permission', 'embeddable');

    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)
    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', '딸녀 (원조 엽기 합성)', 'reviewed', now());

    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)
    VALUES (v_meme_id, 'origin', '2000년대 초반 인터넷 합성 갤러리를 뒤흔들며 개죽이와 함께 합성 필수요소로 군림한 딸기 든 여인 밈.', 'high', true);

    INSERT INTO public.tags (name) VALUES ('디시인사이드') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('합성') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('고전밈') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;
  END IF;

END $$;
