-- =============================================================================
-- 밈허브(@meme_hub_kr) 유튜브 기반 밈 콘텐츠 적재 마이그레이션
-- 총 12개 항목 | 자체 제작(house_original) 출처 권리 보증
-- =============================================================================
BEGIN;

-- [항목] 프링글스를 잡을 때의 나 (pringles-cat-reach)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'pringles-cat-reach' OR title = '프링글스를 잡을 때의 나' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '프링글스를 잡을 때의 나', 'pringles-cat-reach', ARRAY['프링글스 고양이', '통 바닥 과자 꺼내기', 'Pringles Reach']::text[], '긴 통 안에 남은 마지막 과자를 꺼내려 앞발을 무리하게 집어넣는 고양이의 모습에 빗댄 일상 공감 밈.', '프링글스나 텀블러처럼 좁고 깊은 원통형 용기 바닥에 닿기 위해 필사적으로 손을 뻗는 인간의 우스꽝스러운 순간을, 통 속에 솜방망이 젤리발을 욱여넣는 고양이 모션에 매칭한 숏폼 공감 밈입니다.', '유튜브 밈허브(@meme_hub_kr) 채널에서 반려묘의 호기심 행동을 일상 과자 섭취 딜레마와 결합해 제작·게시했습니다.',
      'house_original', 'pending', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/6Je_PTwvoAY', '프링글스를 잡을때의 나 #고양이 #프링글스', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', '6Je_PTwvoAY', 'https://www.youtube.com/shorts/6Je_PTwvoAY', '프링글스를 잡을때의 나 #고양이 #프링글스', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '프링글스를 잡을 때의 나', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '밈허브 오리지널 동물 공감 숏폼 시리즈로 최초 업로드.', 'high', true
    );
    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'first_use', '원통형 간식통에 앞발을 집어넣는 00:02 지점 클립이 핵심 근거.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('고양이')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('프링글스')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('동물밈')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('일상공감')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('숏폼')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('귀여움')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 도발하지 마 (김채원) (dont-provoke-chaewon)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'dont-provoke-chaewon' OR title = '도발하지 마 (김채원)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '도발하지 마 (김채원)', 'dont-provoke-chaewon', ARRAY['도발하지마', '김채원 도발', '쌈무 도발']::text[], '자신을 약올리거나 억울한 상황에 처했을 때 귀엽지만 단호하게 쏘아붙이는 르세라핌 김채원의 경고 리액션 밈.', '상대방의 깐족거림이나 장난에 대해 ''더 이상 건드리면 가만두지 않겠다''는 의사를 과장되게 표현할 때 사용하는 리액션 밈입니다. 위협적인 대사와 반대되는 사랑스러운 표정 대비가 웃음 포인트로 쓰입니다.', '르세라핌 김채원의 자체 예능 및 라이브 방송 리액션 구간을 밈허브(@meme_hub_kr)에서 쇼츠 템플릿으로 재가공해 바이럴되었습니다.',
      'house_original', 'pending', 'phrase'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2026, '{"work":"yellow","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/S5tHnyqeSa4', '도발하지마 #김채원 #르세라핌 #LESSERAFIM', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'S5tHnyqeSa4', 'https://www.youtube.com/shorts/S5tHnyqeSa4', '도발하지마 #김채원 #르세라핌 #LESSERAFIM', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '도발하지 마', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '김채원의 ''도발하지 마'' 음성과 제스처 클립을 밈허브가 숏폼 형태로 큐레이션.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('김채원')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('르세라핌')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('아이돌')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('도발하지마')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('리액션')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('경고짤')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 난 너를 사랑해 떼창 (붉은 노을) (i-love-you-singalong-bigbang)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'i-love-you-singalong-bigbang' OR title = '난 너를 사랑해 떼창 (붉은 노을)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '난 너를 사랑해 떼창 (붉은 노을)', 'i-love-you-singalong-bigbang', ARRAY['붉은노을 떼창', '빅뱅 떼창', '난 너를 사랑해']::text[], '빅뱅 콘서트에서 수만 명의 관객이 이문세 원곡 리메이크 ''붉은 노을''의 후렴구를 한목소리로 떼창하는 에너지 폭발 밈.', '축제나 콘서트 현장에서 세대를 막론하고 ''난 너를 사랑해 이 세상은 너뿐이야'' 구간을 전율과 함께 따라 부르는 단체 합창 밈입니다. 감동, 축제 분위기, 세대 대통합을 상징하는 배경 오디오로 널리 쓰입니다.', '빅뱅 20주년 콘서트 현장 실황 클립을 밈허브(@meme_hub_kr)에서 쇼츠 및 풀버전 영상으로 기록·배포했습니다.',
      'house_original', 'pending', 'song'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/l3O5u1HQybI', '빅뱅 - 붉은 노을 | 난 너를 사랑해 떼창', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'l3O5u1HQybI', 'https://www.youtube.com/shorts/l3O5u1HQybI', '빅뱅 - 붉은 노을 | 난 너를 사랑해 떼창', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/watch?v=hNVsKG5KbEk', '260821 빅뱅콘서트 천국 + 붉은노을 + 마지막인사 풀버전', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'hNVsKG5KbEk', 'https://www.youtube.com/watch?v=hNVsKG5KbEk', '260821 빅뱅콘서트 천국 + 붉은노을 + 마지막인사 풀버전', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '난 너를 사랑해 떼창', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '빅뱅 20주년 콘서트 붉은 노을 떼창 구간 숏폼 클립.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('빅뱅')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('붉은노을')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('떼창')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('콘서트')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('kpop')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('노래방')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 한국판 그웬 스테이시 (고윤정) (goyounjung-gwen-stacy)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'goyounjung-gwen-stacy' OR title = '한국판 그웬 스테이시 (고윤정)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '한국판 그웬 스테이시 (고윤정)', 'goyounjung-gwen-stacy', ARRAY['고윤정 그웬', '고윤정 스파이더맨', '실사화 그웬']::text[], '배우 고윤정의 스타일링과 무빙이 스파이더맨 유니버스의 그웬 스테이시 캐릭터와 높은 싱크로율을 보여 화제가 된 밈.', '금발 후드 또는 스포티한 의상과 비주얼이 마블 ''스파이더맨: 뉴 유니버스''의 그웬 스테이시 실사판을 연상케 하여 팬들과 대중 사이에서 가상 캐스팅 1순위로 바이럴된 숏폼 트렌드입니다.', '배우 고윤정의 화보 및 영상 컷을 그웬 스테이시 테마 비트와 교차 편집하여 밈허브(@meme_hub_kr)에서 제작했습니다.',
      'house_original', 'pending', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/TSh9ZomzFzc', '고윤정 스파이더맨 | 그웬 스테이시', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'TSh9ZomzFzc', 'https://www.youtube.com/shorts/TSh9ZomzFzc', '고윤정 스파이더맨 | 그웬 스테이시', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '한국판 그웬 스테이시', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '고윤정의 캐릭터 매칭 숏폼 편집본으로 밈허브에 게시.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('고윤정')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('스파이더맨')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('그웬스테이시')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('비주얼')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('마블')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('싱크로율')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 동공으로 선 긋기 (유병재 눈치 밈) (yoo-byungjae-awkward-reaction)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'yoo-byungjae-awkward-reaction' OR title = '동공으로 선 긋기 (유병재 눈치 밈)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '동공으로 선 긋기 (유병재 눈치 밈)', 'yoo-byungjae-awkward-reaction', ARRAY['유병재 눈치', '선 긋는 유병재', '침묵의 손절']::text[], '상대방이 논란의 여지가 있는 말을 꺼내자마자 눈빛 하나로 즉시 연루를 차단하는 침묵 리액션 밈.', '대화 상대가 위험한 발언이나 민감한 주제를 언급할 때, 말없이 카메라를 응시하거나 동공을 굴리며 ''나는 이 대화와 무관하다''는 메시지를 온몸으로 풍기는 표정 밈입니다. 곤란한 상황에서 휘말리지 않으려는 생존 기술로 인용됩니다.', '예능 방송 토크 도중 민감한 화제가 나오자 유병재가 짓는 방어적 표정 클립을 밈허브(@meme_hub_kr)에서 하이라이트 편집했습니다.',
      'house_original', 'pending', 'comment'::public.meme_category, 'yellow'::public.safety_level,
      'normal'::public.meme_difficulty, 'ironic'::public.meme_sentiment, 2026, '{"work":"yellow","friends":"green","family":"yellow","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/CbE0osXo5-U', '친일파 논란 눈치챈 유병재', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'CbE0osXo5-U', 'https://www.youtube.com/shorts/CbE0osXo5-U', '친일파 논란 눈치챈 유병재', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '동공으로 선 긋기', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '예능 대화 속 눈치 리액션을 하이라이트로 구성한 숏폼 클립.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('유병재')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('눈치')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('리액션')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('표정밈')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('손절')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('예능')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 카즈하 Smart 골반 챌린지 (kazuha-smart-fancam)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'kazuha-smart-fancam' OR title = '카즈하 Smart 골반 챌린지' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '카즈하 Smart 골반 챌린지', 'kazuha-smart-fancam', ARRAY['카즈하 스마트', '카즈하 직캠', 'Smart 챌린지']::text[], '르세라핌 카즈하의 완벽한 11자 복근과 유려한 안무 라인이 돋보이는 Smart 무대 직캠 댄스 밈.', '르세라핌의 ''Smart'' 후렴구 안무 중 카즈하 특유의 발레리나 출신 피지컬과 부드러운 웨이브가 극찬을 받으며 댄스 챌린지와 피트니스 워너비 영상으로 회자되는 쇼츠 밈입니다.', '2026년 르세라핌 무대 직캠 클립을 밈허브(@meme_hub_kr)에서 세로형 하이라이트로 큐레이션했습니다.',
      'house_original', 'pending', 'dance'::public.meme_category, 'green'::public.safety_level,
      'normal'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/4U76972CQKk', '260819 르세라핌 카즈하 Smart 직캠 영상', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', '4U76972CQKk', 'https://www.youtube.com/shorts/4U76972CQKk', '260819 르세라핌 카즈하 Smart 직캠 영상', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '카즈하 Smart 골반 챌린지', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '르세라핌 카즈하의 Smart 라이브 직캠 숏폼 영상.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('카즈하')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('르세라핌')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('smart')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('직캠')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('댄스챌린지')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('아이돌')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 냥냥 펀치와 냐옹 (Kitten Meow) (kitten-meow-punch)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'kitten-meow-punch' OR title = '냥냥 펀치와 냐옹 (Kitten Meow)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '냥냥 펀치와 냐옹 (Kitten Meow)', 'kitten-meow-punch', ARRAY['아기 고양이 냐옹', 'Kitten meow', '고양이 심쿵사']::text[], '작은 체구의 아기 고양이가 가냘프게 야옹거리며 솜방망이를 내미는 힐링 밈.', '세상에 나온 지 얼마 되지 않은 새끼 고양이가 카메라를 향해 가냘픈 목소리로 울며 시청자의 심장을 저격하는 전형적인 동물 힐링 숏폼 밈입니다. 댓글 창의 무조건적 사랑과 힐링 반응을 유도합니다.', '글로벌 틱톡 및 숏폼에서 인기를 얻은 아기 고양이 클립을 밈허브(@meme_hub_kr)에서 사운드 강화와 함께 배포했습니다.',
      'house_original', 'pending', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/osWfNbC0Sy8', 'Kitten meow.#catsoftiktok #cat #cute', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'osWfNbC0Sy8', 'https://www.youtube.com/shorts/osWfNbC0Sy8', 'Kitten meow.#catsoftiktok #cat #cute', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '냥냥 펀치와 냐옹', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '아기 고양이 힐링 숏폼 클립.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('고양이')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('아기고양이')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('힐링')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('귀여움')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('동물영상')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 미연 비주얼 공격 (TAD FAB 직캠) (miyeon-visual-attack)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'miyeon-visual-attack' OR title = '미연 비주얼 공격 (TAD FAB 직캠)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '미연 비주얼 공격 (TAD FAB 직캠)', 'miyeon-visual-attack', ARRAY['미연 팝업 직캠', '미연 비주얼', '공주님 미연']::text[], '(여자)아이들 미연의 브랜드 팝업 행사장에서 선보인 인형 같은 비주얼 리액션 밈.', '플래시 세례 속에서도 흐트러짐 없는 완벽한 미모와 사랑스러운 팬서비스 포즈로 ''공주님 그 자체''라는 감탄을 자아내며 SNS 피드를 도배한 비주얼 감상형 밈입니다.', '2026년 8월 TAD FAB 팝업 행사 오프라인 직캠을 밈허브(@meme_hub_kr)에서 세로 고화질로 제작했습니다.',
      'house_original', 'pending', 'image'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/WzN90YMrPIc', '260816 아이들 미연 TAD FAB 팝업 행사 직캠', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'WzN90YMrPIc', 'https://www.youtube.com/shorts/WzN90YMrPIc', '260816 아이들 미연 TAD FAB 팝업 행사 직캠', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '미연 비주얼 공격', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '아이들 미연 팝업 행사 현장 직캠 숏폼 영상.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('미연')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('여자아이들')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('비주얼')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('직캠')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('아이돌')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('팝업스토어')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 미나미진경 폼 미쳤다 (BAD 챌린지) (minami-jinkyung-bad-challenge)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'minami-jinkyung-bad-challenge' OR title = '미나미진경 폼 미쳤다 (BAD 챌린지)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '미나미진경 폼 미쳤다 (BAD 챌린지)', 'minami-jinkyung-bad-challenge', ARRAY['미나미진경', 'BAD 챌린지', '리센느 미나미']::text[], '신인 걸그룹 리센느 미나미와 동료 멤버들의 환상적인 페어 댄스 합이 돋보이는 챌린지 밈.', '중독성 강한 비트에 맞춰 완벽한 칼군무와 케미스트리를 뽐내는 아이돌 댄스 챌린지로, 팬덤 사이에서 응원 구호 ''미나미진경은 가즈아''와 함께 바이럴된 숏폼입니다.', '아이돌 댄스 챌린지 클립을 밈허브(@meme_hub_kr)에서 발굴하여 큐레이션했습니다.',
      'house_original', 'pending', 'dance'::public.meme_category, 'green'::public.safety_level,
      'normal'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/Z8SJB2DVk-k', '미나미진경은 가즈아!! #kpop#idol#BAD', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'Z8SJB2DVk-k', 'https://www.youtube.com/shorts/Z8SJB2DVk-k', '미나미진경은 가즈아!! #kpop#idol#BAD', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '미나미진경 폼 미쳤다', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '리센느 미나미의 BAD 챌린지 숏폼 클립.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('리센느')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('미나미')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('bad챌린지')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('댄스')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('걸그룹')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('아이돌')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 우리 다 같이 부자 되자 (돈복 부적) (everyone-get-rich-amulet)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'everyone-get-rich-amulet' OR title = '우리 다 같이 부자 되자 (돈복 부적)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '우리 다 같이 부자 되자 (돈복 부적)', 'everyone-get-rich-amulet', ARRAY['돈복 부적', '부자되자 밈', '돈버는법']::text[], '영상을 시청하는 모든 사람에게 재물운과 대박을 기원하며 댓글로 소원을 비는 부적형 숏폼 밈.', '황금 이미지나 행운의 심볼과 함께 ''이 영상을 본 당신은 이번 주에 예상치 못한 돈이 들어옵니다'' 식의 긍정 에너지를 전파하며 시청자들이 댓글로 ''성지순례''를 남기게 만드는 참여형 밈입니다.', 'SNS 상의 행운 부적 트렌드를 밈허브(@meme_hub_kr)에서 짧고 강렬한 모션 그래픽 숏폼으로 제작했습니다.',
      'house_original', 'pending', 'phrase'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/VdKWuRr-Z8Q', '우리 다같이 부자되자!!~ #부자 #돈버는법 #돈복', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'VdKWuRr-Z8Q', 'https://www.youtube.com/shorts/VdKWuRr-Z8Q', '우리 다같이 부자되자!!~ #부자 #돈버는법 #돈복', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '우리 다 같이 부자 되자', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '재물운 기원 및 행운 부적 숏폼 클립.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('부자')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('돈복')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('행운')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('소원')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('성지순례')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('부적')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 아이유 철벽 경호원 (박민 경호원) (iu-bodyguard-park-min)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'iu-bodyguard-park-min' OR title = '아이유 철벽 경호원 (박민 경호원)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '아이유 철벽 경호원 (박민 경호원)', 'iu-bodyguard-park-min', ARRAY['아이유 경호원', '박민 경호원', '아이유 삼촌 경호원']::text[], '10년 넘게 아이유를 든든하게 지켜주며 가족 같은 케미를 자랑하는 박민 경호원의 연봉과 신뢰 밈.', '단순한 경호원을 넘어 아이유의 길잡이이자 무대 위 서포터로 활약하며 대중에게도 친숙해진 박민 경호원의 프로페셔널한 면모와 처우를 조명한 정보성 인물 밈입니다.', '아이유 콘서트 및 출국장 케미 클립을 밈허브(@meme_hub_kr)에서 인물 탐구 쇼츠로 정리해 업로드했습니다.',
      'house_original', 'pending', 'comment'::public.meme_category, 'green'::public.safety_level,
      'beginner'::public.meme_difficulty, 'funny'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/6silltTb7o8', '아이유 경호원 - 박민 경호원의 연봉과 처우', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', '6silltTb7o8', 'https://www.youtube.com/shorts/6silltTb7o8', '아이유 경호원 - 박민 경호원의 연봉과 처우', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '아이유 철벽 경호원', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '아이유와 박민 경호원의 직무 및 일화 정리 쇼츠.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('아이유')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('박민경호원')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('경호원')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('케미')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('연예계')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('인물탐구')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

-- [항목] 고딩 쇠맛 댄스부 (에스파 아마겟돈) (highschool-armageddon-cover)
DO $$
DECLARE
  v_meme_id uuid;
  v_src_id uuid;
  v_tag_id uuid;
BEGIN
  SELECT id INTO v_meme_id FROM public.memes WHERE slug = 'highschool-armageddon-cover' OR title = '고딩 쇠맛 댄스부 (에스파 아마겟돈)' LIMIT 1;
  IF v_meme_id IS NULL THEN
    INSERT INTO public.memes (
      title, slug, aliases, summary, description, origin, origin_kind,
      moderation_status, category, safety_level, difficulty, sentiment,
      origin_year, usage_context
    ) VALUES (
      '고딩 쇠맛 댄스부 (에스파 아마겟돈)', 'highschool-armageddon-cover', ARRAY['고딩 아마겟돈', '댄스부 아마겟돈', '쇠맛 커버댄스']::text[], '고등학교 축제 및 버스킹에서 고등학생들이 에스파의 ''아마겟돈'' 특유의 쇠맛 그루브를 완벽 소화한 커버댄스 밈.', '난이도 높은 에스파의 아마겟돈(Armageddon) 안무를 프로 못지않은 완벽한 합과 카리스마로 선보여 찬사를 받은 청소년 댄스부 숏폼입니다. 미래의 K-POP 주역들을 향한 응원 열기로 바이럴되었습니다.', '고등학교 축제 댄스부 직캠을 밈허브(@meme_hub_kr)에서 하이라이트 편집하여 게시했습니다.',
      'house_original', 'pending', 'dance'::public.meme_category, 'green'::public.safety_level,
      'normal'::public.meme_difficulty, 'wholesome'::public.meme_sentiment, 2026, '{"work":"green","friends":"green","family":"green","sns":"green"}'::jsonb
    ) RETURNING id INTO v_meme_id;

    -- 출처 연계
    INSERT INTO public.meme_sources (
      meme_id, platform, source_url, title, creator_name,
      source_role, rights_basis, copyright_status
    ) VALUES (
      v_meme_id, 'youtube', 'https://www.youtube.com/shorts/aIjUWIpu754', '고딩의 놀라운 커버댄스 - #fyp #아마겟돈 #댄스부', '밈허브 (@meme_hub_kr)', 'original', 'creator_permission', 'embeddable'
    );

    INSERT INTO public.media_sources (
      platform, external_id, canonical_url, title, channel_name,
      public_status, embeddable, last_checked_at
    ) VALUES (
      'youtube', 'aIjUWIpu754', 'https://www.youtube.com/shorts/aIjUWIpu754', '고딩의 놀라운 커버댄스 - #fyp #아마겟돈 #댄스부', '밈허브 (@meme_hub_kr)', 'active', true, now()
    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url
    RETURNING id INTO v_src_id;

    INSERT INTO public.meme_media (
      meme_id, source_id, source_role, rights_basis, review_state
    ) VALUES (
      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'
    );

    -- 시장 프로필 연계
    INSERT INTO public.meme_market_profiles (
      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at
    ) VALUES (
      v_meme_id, 'KR', 'ko-KR', 'origin', '고딩 쇠맛 댄스부', 'reviewed', now()
    );

    INSERT INTO public.meme_claims (
      meme_id, claim_type, claim_text, confidence, verified
    ) VALUES (
      v_meme_id, 'origin', '고교 댄스부의 에스파 아마겟돈 커버 무대 숏폼 영상.', 'high', true
    );

    INSERT INTO public.tags (name) VALUES ('에스파')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('아마겟돈')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('커버댄스')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('고등학교')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('댄스부')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.tags (name) VALUES ('축제')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)
    ON CONFLICT DO NOTHING;

    -- 권리 보증 및 정식 승인
    UPDATE public.memes
       SET moderation_status = 'approved',
           house_rights_attested_at = now(),
           published_at = coalesce(published_at, now()),
           updated_at = now()
     WHERE id = v_meme_id;

  END IF;
END $$;

COMMIT;
