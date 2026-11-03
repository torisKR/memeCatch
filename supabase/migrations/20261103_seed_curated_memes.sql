-- ============================================================================
-- 밈캐치 (catchmeme.com) 핵심 대표 밈 고품질 시드 마이그레이션 SQL
-- Supabase SQL Editor에서 이 파일 전체를 복사하여 'Run' 버튼을 클릭하면 즉시 적용됩니다.
-- 중복 실행 시에도 안전하게 업데이트(ON CONFLICT DO UPDATE)됩니다.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 밈: 중요한 건 꺾이지 않는 마음 (중꺾마) (jkm2022k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '2b6f4a1a-4f5c-569b-a158-0eece2bbdf04',
    'jkm2022k',
    'jung-kkuk-ma',
    '중요한 건 꺾이지 않는 마음 (중꺾마)',
    'phrase',
    'house_original',
    '어떤 역경과 실패에도 끝까지 포기하지 않고 도전하는 굳은 의지를 격려할 때 쓰는 대표적인 긍정 밈.',
    '2022년 리그 오브 레전드 월드 챔피언십(롤드컵)에서 DRX 소속 데프트(Deft) 선수의 극적인 우승 서사와 함께 유행한 문구입니다. 스포츠, 취업 준비, 스타트업, 일상 등 모든 도전 과제에서 희망과 의지를 북돋는 데 사용됩니다.',
    '2022년 롤드컵 조별리그 1라운드 로그전 패배 후 쿠키뉴스 문대찬 기자가 작성한 인터뷰 기사 제목에서 최초 유래했습니다.',
    '어떤 역경과 실패에도 끝까지 포기하지 않고 도전하는 굳은 의지를 격려할 때 쓰는 대표적인 긍정 밈.',
    '초격식 문서나 대외 제안서에는 ''굳은 의지'' 등으로 순화하는 것이 권장됩니다.',
    'green',
    'active',
    'approved',
    2022,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "친구와의 대화 (취업 준비)", "dialogue": [{"speaker": "지훈", "line": "이번 하반기 공채 서류 또 다 떨어졌어… 진짜 막막하다."}, {"speaker": "민수", "line": "야, 아직 11월이야. 중요한 건 꺾이지 않는 마음인 거 알지? 포기만 안 하면 된다!"}]}, {"context": "회사 슬랙 (프로젝트 배포 난관)", "dialogue": [{"speaker": "팀원", "line": "빌드 오류가 계속 잡히지 않네요. 오늘 안에 해결할 수 있을지 걱정입니다."}, {"speaker": "팀장", "line": "원인 하나씩 디버깅해 봅시다. 중꺾마 정신으로 차근차근 풀면 금방 끝납니다."}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '2b6f4a1a-4f5c-569b-a158-0eece2bbdf04',
    'https://catchmeme.com/memes/jkm2022k-jung-kkuk-ma',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '2b6f4a1a-4f5c-569b-a158-0eece2bbdf04',
    'svg_card',
    'house_original',
    'jkm2022k',
    'https://catchmeme.com/memes/jkm2022k-jung-kkuk-ma',
    'https://catchmeme.com/memes/jkm2022k-jung-kkuk-ma/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 럭키비키 (원영적 사고) (lkv2024k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '251370d3-c53f-552c-bc6a-8c5324759c0e',
    'lkv2024k',
    'lucky-vicky',
    '럭키비키 (원영적 사고)',
    'phrase',
    'house_original',
    '어떤 불운이나 곤란한 상황이 닥쳐도 초긍정적으로 해석해 ''완전 나를 위한 행운이잖아!''라고 반전시키는 사고방식 밈.',
    '걸그룹 아이브(IVE)의 장원영의 긍정적인 말버릇과 마인드셋에서 유래했습니다. 빵집에서 내 앞 사람에서 갓 구운 빵이 다 팔려도 ''덕분에 조금만 기다리면 방금 나온 따끈따끈한 새 빵을 먹을 수 있잖아? 완전 럭키비키잖아!''라고 생각하는 초긍정 밈입니다.',
    '아이브 장원영의 팬 소통 버블 및 유튜브 스페인 여행 브이로그 대화에서 시작되어 2024년 전국적인 유행어로 확산되었습니다.',
    '어떤 불운이나 곤란한 상황이 닥쳐도 초긍정적으로 해석해 ''완전 나를 위한 행운이잖아!''라고 반전시키는 사고방식 밈.',
    '타인의 심각한 재난이나 손실 상황에서 무리하게 적용하면 반감을 살 수 있습니다.',
    'green',
    'active',
    'approved',
    2024,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "비 오는 날 지각 위기", "dialogue": [{"speaker": "동료A", "line": "비 와서 버스 놓쳤는데 어쩌죠?"}, {"speaker": "동료B", "line": "덕분에 다음 지하철 타고 차분하게 커피 사갈 시간 생겼네! 완전 럭키비키잖아 잔업 파이팅!"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '251370d3-c53f-552c-bc6a-8c5324759c0e',
    'https://catchmeme.com/memes/lkv2024k-lucky-vicky',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '251370d3-c53f-552c-bc6a-8c5324759c0e',
    'svg_card',
    'house_original',
    'lkv2024k',
    'https://catchmeme.com/memes/lkv2024k-lucky-vicky',
    'https://catchmeme.com/memes/lkv2024k-lucky-vicky/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 폼 미쳤다 (fmc2022k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '4629257a-5d48-50d4-a25b-cb764b311768',
    'fmc2022k',
    'form-crazy',
    '폼 미쳤다',
    'phrase',
    'house_original',
    '특정인의 뛰어난 역량, 센스 넘치는 퍼포먼스, 혹은 음식·작품의 대단한 퀄리티를 극찬할 때 쓰는 감탄 표현.',
    '스포츠 선수의 컨디션(''폼'')이 절정에 달했을 때 쓰이던 축구 커뮤니티 은어에서 출발해, 현재는 패션, 디자인, 업무 성과 등 다방면에서 대단함을 찬양하는 국민 칭찬 밈으로 확장되었습니다.',
    '인터넷 방송인 및 해외 축구 갤러리에서 활약하는 선수를 향해 외치던 칭찬 어구에서 비롯되었습니다.',
    '특정인의 뛰어난 역량, 센스 넘치는 퍼포먼스, 혹은 음식·작품의 대단한 퀄리티를 극찬할 때 쓰는 감탄 표현.',
    '임원 보고나 공식 평가서에는 ''탁월한 완성도'', ''압도적인 성과''로 대체하세요.',
    'green',
    'active',
    'approved',
    2022,
    NOW(),
    100,
    '{"friends": "green", "work": "yellow", "sns": "green"}'::jsonb,
    '[{"context": "동료 디자인 시안 극찬", "dialogue": [{"speaker": "기획자", "line": "와 이번 메인 배너 그래픽 폼 미쳤네요! 바로 배포 가시죠."}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '4629257a-5d48-50d4-a25b-cb764b311768',
    'https://catchmeme.com/memes/fmc2022k-form-crazy',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '4629257a-5d48-50d4-a25b-cb764b311768',
    'svg_card',
    'house_original',
    'fmc2022k',
    'https://catchmeme.com/memes/fmc2022k-form-crazy',
    'https://catchmeme.com/memes/fmc2022k-form-crazy/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 오히려 좋아 (oyj2021k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '5062885d-2d6f-577c-a7dd-2187b1cf3bd2',
    'oyj2021k',
    'ohiryeo-joha',
    '오히려 좋아',
    'phrase',
    'house_original',
    '예상치 못한 불운이나 계획의 어긋남을 긍정적인 반전 기회로 유쾌하게 받아들이는 마인드셋 밈.',
    '약속이 취소되거나 버스를 놓치는 등 낭패를 겪었을 때, 낙담하는 대신 ''오히려 다른 여유가 생겼으니 더 잘됐다''며 스트레스를 해소하고 분위기를 반전시키는 멘탈 관리 표현입니다.',
    '트위치 및 유튜브 스트리머들의 방송에서 돌발 상황을 유머러스하게 극복하며 자주 사용하면서 유행했습니다.',
    '예상치 못한 불운이나 계획의 어긋남을 긍정적인 반전 기회로 유쾌하게 받아들이는 마인드셋 밈.',
    '타인의 불행에 대고 말하면 무례할 수 있습니다.',
    'green',
    'active',
    'approved',
    2021,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "회의 일정 취소 후", "dialogue": [{"speaker": "나", "line": "오후 미팅 취소됐대요. 오히려 좋아! 밀린 코드 리뷰 끝냅시다."}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '5062885d-2d6f-577c-a7dd-2187b1cf3bd2',
    'https://catchmeme.com/memes/oyj2021k-ohiryeo-joha',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '5062885d-2d6f-577c-a7dd-2187b1cf3bd2',
    'svg_card',
    'house_original',
    'oyj2021k',
    'https://catchmeme.com/memes/oyj2021k-ohiryeo-joha',
    'https://catchmeme.com/memes/oyj2021k-ohiryeo-joha/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 너 뭐 돼? (nmd2022k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '4c4a0479-e60f-5418-896c-428020368c6a',
    'nmd2022k',
    'ne-mwo-dwae',
    '너 뭐 돼?',
    'phrase',
    'house_original',
    '분수에 넘치게 거들먹거리거나 잘난 척하는 상대를 향해 날리는 날카로운 조롱 및 반박 표현.',
    '상대방의 오만함이나 과도한 간섭을 단칼에 무안하게 만드는 강력한 비격식 반문입니다. 친밀도가 매우 높은 친구 간 장난이 아니면 즉각적인 갈등과 싸움을 유발합니다.',
    '유튜브 크리에이터 겸 댄서 가비(Gabee)가 웹 예능 등에서 특유의 제스처와 함께 사용하며 유행했습니다.',
    '분수에 넘치게 거들먹거리거나 잘난 척하는 상대를 향해 날리는 날카로운 조롱 및 반박 표현.',
    '직장이나 공적인 자리, 초면인 사람에게 절대 사용 금지. 심각한 인성 논란으로 비화됩니다.',
    'red',
    'active',
    'approved',
    2022,
    NOW(),
    100,
    '{"friends": "yellow", "work": "red", "sns": "red"}'::jsonb,
    '[{"context": "절친 간의 유쾌한 장난", "dialogue": [{"speaker": "친구", "line": "내가 오늘 특별히 커피 한 잔 사줄게."}, {"speaker": "나", "line": "웃겨 진짜, 너 뭐 돼? ㅋㅋㅋ 고맙다."}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '4c4a0479-e60f-5418-896c-428020368c6a',
    'https://catchmeme.com/memes/nmd2022k-ne-mwo-dwae',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '4c4a0479-e60f-5418-896c-428020368c6a',
    'svg_card',
    'house_original',
    'nmd2022k',
    'https://catchmeme.com/memes/nmd2022k-ne-mwo-dwae',
    'https://catchmeme.com/memes/nmd2022k-ne-mwo-dwae/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 누칼협 (누가 칼 들고 협박함?) (nkh2021k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '4fe0eeb9-9dcd-5bf8-bf32-14fae0c0777c',
    'nkh2021k',
    'nu-kal-hyeop',
    '누칼협 (누가 칼 들고 협박함?)',
    'phrase',
    'house_original',
    '본인이 스스로 선택해 놓고 결과가 나쁘다고 징징대는 사람을 향해 차갑게 일침을 가하는 유행어.',
    '주식·가상자산 투자 실패, 무리한 소비, 가혹한 직장 환경 불평 등에 대해 ''결국 네가 자발적으로 선택한 것 아니냐''며 개인의 책임을 가혹하게 강조할 때 쓰입니다. 냉소적이고 공감 능력이 결여된 어조를 띱니다.',
    '인터넷 커뮤니티 메이플스토리 갤러리 및 로스트아크 인벤 등 게임 유저 간의 논쟁에서 시작되었습니다.',
    '본인이 스스로 선택해 놓고 결과가 나쁘다고 징징대는 사람을 향해 차갑게 일침을 가하는 유행어.',
    '상대방의 아픔이나 호소에 차가운 적대감을 드러내므로 공적/비즈니스 관계에서 절대 금기입니다.',
    'red',
    'active',
    'approved',
    2021,
    NOW(),
    100,
    '{"friends": "yellow", "work": "red", "sns": "red"}'::jsonb,
    '[{"context": "무리한 과소비 후 후회하는 친구", "dialogue": [{"speaker": "친구", "line": "명품 가방 할부로 질렀는데 이번 달 카드값 어떡하지 ㅠㅠ"}, {"speaker": "나", "line": "누칼협? 네가 긁어놓고 누굴 탓해 ㅋㅋㅋ 다음 달엔 절약해라."}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '4fe0eeb9-9dcd-5bf8-bf32-14fae0c0777c',
    'https://catchmeme.com/memes/nkh2021k-nu-kal-hyeop',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '4fe0eeb9-9dcd-5bf8-bf32-14fae0c0777c',
    'svg_card',
    'house_original',
    'nkh2021k',
    'https://catchmeme.com/memes/nkh2021k-nu-kal-hyeop',
    'https://catchmeme.com/memes/nkh2021k-nu-kal-hyeop/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 맑은 눈의 광인 (맑눈광) (mng2022k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '9b5f9868-104a-5829-ac6c-6496cc40ce06',
    'mng2022k',
    'mal-noon-gwang',
    '맑은 눈의 광인 (맑눈광)',
    'phrase',
    'house_original',
    '겉으로는 순진하고 맑은 눈빛을 띠고 있으나, 속으로는 예측 불가능한 집착과 광기를 품은 인물을 지칭하는 밈.',
    'SNL 코리아 ''MZ오피스''의 김아영 캐릭터를 통해 대중화된 신조어입니다. 조용하고 예의 바르게 행동하면서도 에어팟을 끼고 일하거나 엉뚱한 고집을 꺾지 않는 특유의 현대적 사회 초년생 유형을 풍자할 때 자주 쓰입니다.',
    '웹툰 ''마음의 소리'' 등 인터넷 커뮤니티에서 순진무구한 눈망울 속에 소시오패스적 면모를 숨긴 캐릭터들을 묘사하던 데서 유래했습니다.',
    '겉으로는 순진하고 맑은 눈빛을 띠고 있으나, 속으로는 예측 불가능한 집착과 광기를 품은 인물을 지칭하는 밈.',
    '당사자 면전에서 대놓고 쓰면 ''이상한 사람''으로 낙인찍힌다고 느껴 불쾌해할 수 있습니다.',
    'yellow',
    'active',
    'approved',
    2022,
    NOW(),
    100,
    '{"friends": "green", "work": "yellow", "sns": "green"}'::jsonb,
    '[{"context": "친구들 간의 인물 묘사", "dialogue": [{"speaker": "친구A", "line": "영희 걔 평소엔 조용한데 노래방 가면 눈빛 돌변하더라?"}, {"speaker": "친구B", "line": "진짜 전형적인 맑은 눈의 광인이라니까 ㅋㅋㅋ"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '9b5f9868-104a-5829-ac6c-6496cc40ce06',
    'https://catchmeme.com/memes/mng2022k-mal-noon-gwang',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '9b5f9868-104a-5829-ac6c-6496cc40ce06',
    'svg_card',
    'house_original',
    'mng2022k',
    'https://catchmeme.com/memes/mng2022k-mal-noon-gwang',
    'https://catchmeme.com/memes/mng2022k-mal-noon-gwang/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 분좋카 (분위기 좋은 카페) (bjk2021k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    'bb31ec53-0227-5447-87bb-ecb0263aad7c',
    'bjk2021k',
    'bun-jo-ka',
    '분좋카 (분위기 좋은 카페)',
    'phrase',
    'house_original',
    '감각적인 인테리어, 채광, 음악이 어우러져 사진 찍기 좋고 머물기 좋은 카페를 줄여 부르는 말.',
    '인스타그램 릴스 및 블로그 맛집 리뷰에서 데이트 코스나 힐링 스팟을 추천할 때 대표적으로 쓰이는 편안한 축약어입니다.',
    '인스타그램 감성 카페 투어 트렌드와 함께 2021년경부터 널리 확산된 줄임말입니다.',
    '감각적인 인테리어, 채광, 음악이 어우러져 사진 찍기 좋고 머물기 좋은 카페를 줄여 부르는 말.',
    '완전 무해한 일상 관용어입니다.',
    'green',
    'active',
    'approved',
    2021,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "주말 데이트 약속 장소", "dialogue": [{"speaker": "민지", "line": "성수동 3번 출구 근처에 분좋카 하나 알아뒀어. 거기서 만나자!"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    'bb31ec53-0227-5447-87bb-ecb0263aad7c',
    'https://catchmeme.com/memes/bjk2021k-bun-jo-ka',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    'bb31ec53-0227-5447-87bb-ecb0263aad7c',
    'svg_card',
    'house_original',
    'bjk2021k',
    'https://catchmeme.com/memes/bjk2021k-bun-jo-ka',
    'https://catchmeme.com/memes/bjk2021k-bun-jo-ka/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 히딩크 '나는 아직 배가 고프다' (gnact78h)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '87ad4941-de60-5b06-b587-c1c959fb49ee',
    'gnact78h',
    'hidink-hungry',
    '히딩크 ''나는 아직 배가 고프다''',
    'phrase',
    'house_original',
    '큰 성과나 목표를 달성한 뒤에도 결코 자만하지 않고 더 큰 성취를 향해 나아가겠다는 프로페셔널한 명언 밈.',
    '2002 한일 월드컵 16강 진출 확정 직후, 거스 히딩크 감독이 기자회견에서 남긴 역사적인 발언(I''m still hungry)입니다. 현재도 시험 통과, 매출 목표 달성, 추가 도전 시 겸손과 열정을 동시에 보여주는 긍정적 표현으로 인용됩니다.',
    '2002년 6월 14일, 포르투갈전 승리로 사상 최초의 16강 진출을 확정한 후 히딩크 감독의 기자회견 인터뷰.',
    '큰 성과나 목표를 달성한 뒤에도 결코 자만하지 않고 더 큰 성취를 향해 나아가겠다는 프로페셔널한 명언 밈.',
    '격식 있는 비즈니스 스피치에서도 긍정적으로 통용됩니다.',
    'green',
    'archived',
    'approved',
    2002,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "분기 목표 초과 달성 후", "dialogue": [{"speaker": "팀장", "line": "3분기 목표 달성했지만 히딩크 감독 말처럼 우리는 아직 배가 고픕니다. 4분기도 달려봅시다!"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '87ad4941-de60-5b06-b587-c1c959fb49ee',
    'https://catchmeme.com/memes/gnact78h-hidink-hungry',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '87ad4941-de60-5b06-b587-c1c959fb49ee',
    'svg_card',
    'house_original',
    'gnact78h',
    'https://catchmeme.com/memes/gnact78h-hidink-hungry',
    'https://catchmeme.com/memes/gnact78h-hidink-hungry/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 억까 (억지 까기) (okk2020k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '439f5b90-5d55-5b84-b00d-5d0b19649644',
    'okk2020k',
    'eok-kka',
    '억까 (억지 까기)',
    'phrase',
    'house_original',
    '정당한 이유 없이 억지로 트집을 잡아 비난하거나, 불합리할 정도로 지독한 불운이 겹칠 때 쓰는 밈.',
    '인터넷 게임 중 아무리 컨트롤해도 피할 수 없는 황당한 버그나 악재가 발생했을 때 ''게임이 나를 억까한다''고 하거나, 연예인을 향한 악의적 루머에 ''이건 완전 억까다''라고 반박할 때 주로 쓰입니다.',
    '아프리카TV 및 트위치 게임 스트리밍 커뮤니티에서 탄생한 신조어입니다.',
    '정당한 이유 없이 억지로 트집을 잡아 비난하거나, 불합리할 정도로 지독한 불운이 겹칠 때 쓰는 밈.',
    '업무 피드백이나 코드 리뷰 지적에 ''억까하지 마세요''라고 대꾸하면 심각한 태도 불량으로 보입니다.',
    'yellow',
    'active',
    'approved',
    2020,
    NOW(),
    100,
    '{"friends": "green", "work": "yellow", "sns": "green"}'::jsonb,
    '[{"context": "우산 살 부러진 날", "dialogue": [{"speaker": "동기", "line": "아침부터 날씨랑 우산이 쌍으로 억까하네 진짜 ㅠㅠ"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '439f5b90-5d55-5b84-b00d-5d0b19649644',
    'https://catchmeme.com/memes/okk2020k-eok-kka',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '439f5b90-5d55-5b84-b00d-5d0b19649644',
    'svg_card',
    'house_original',
    'okk2020k',
    'https://catchmeme.com/memes/okk2020k-eok-kka',
    'https://catchmeme.com/memes/okk2020k-eok-kka/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 디토 감성 (Ditto) (dtv2022k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    'e0d64457-1657-5021-9a3d-2a8ef3c94fc6',
    'dtv2022k',
    'ditto-vibes',
    '디토 감성 (Ditto)',
    'song',
    'house_original',
    '2000년대 초반 캠코더 화질과 쓸쓸하면서도 아련한 학창 시절의 노스탤지어를 자극하는 감성 트렌드.',
    '뉴진스(NewJeans)의 싱글 ''Ditto'' 뮤직비디오에서 보여준 Y2K 특유의 빈티지 영상미, 교복, 겨울 분위기에서 유래한 심미적 유행어입니다.',
    '2022년 12월 발매된 뉴진스의 노래 ''Ditto'' 뮤직비디오(돌고래유괴단 제작) 공개 이후 대유행.',
    '2000년대 초반 캠코더 화질과 쓸쓸하면서도 아련한 학창 시절의 노스탤지어를 자극하는 감성 트렌드.',
    '비즈니스 이메일에서 ''제안에 디토합니다(동의합니다)''라고 쓰는 것은 지양하세요.',
    'green',
    'active',
    'approved',
    2022,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "인스타그램 사진 공유", "dialogue": [{"speaker": "친구", "line": "오늘 찍은 사진 빈티지 필터 먹였더니 완전 디토 감성 제대로다!"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    'e0d64457-1657-5021-9a3d-2a8ef3c94fc6',
    'https://catchmeme.com/memes/dtv2022k-ditto-vibes',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    'e0d64457-1657-5021-9a3d-2a8ef3c94fc6',
    'svg_card',
    'house_original',
    'dtv2022k',
    'https://catchmeme.com/memes/dtv2022k-ditto-vibes',
    'https://catchmeme.com/memes/dtv2022k-ditto-vibes/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 하입보이요 (뉴진스의 하입보이요) (hpb2022k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    'f30d3aff-38f2-5a61-99f6-9d3d010a7ea4',
    'hpb2022k',
    'hype-boy',
    '하입보이요 (뉴진스의 하입보이요)',
    'song',
    'house_original',
    '길거리에서 무슨 질문을 받든 이어폰을 빼며 엉뚱하게 노래 제목을 답하고 춤을 추는 숏폼 개그 밈.',
    '길거리에서 행인에게 ''지금 무슨 노래 듣고 계세요?''라고 묻는 인터뷰 콘텐츠를 패러디하여, ''홍대 가려면 어디로 가야 하나요?'' 같은 무관한 길 찾기 질문에도 뜬금없이 ''뉴진스의 하입보이요''라고 답하고 춤추며 지나가는 황당한 숏폼 유머입니다.',
    '틱톡 크리에이터들의 길거리 즉흥 인터뷰 패러디 영상에서 시작되어 폭발적 인기를 끌었습니다.',
    '길거리에서 무슨 질문을 받든 이어폰을 빼며 엉뚱하게 노래 제목을 답하고 춤을 추는 숏폼 개그 밈.',
    '진지한 업무 질의응답이나 긴급 상황에서 동문서답 개그를 치면 크게 혼날 수 있습니다.',
    'yellow',
    'cooling',
    'approved',
    2022,
    NOW(),
    100,
    '{"friends": "green", "work": "yellow", "sns": "green"}'::jsonb,
    '[{"context": "뜬금없는 동문서답 장난", "dialogue": [{"speaker": "선배", "line": "오늘 점심 뭐 먹을까?"}, {"speaker": "후배", "line": "뉴진스의 하입보이요 ㅋㅋㅋ 농담이고 부대찌개 가시죠!"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    'f30d3aff-38f2-5a61-99f6-9d3d010a7ea4',
    'https://catchmeme.com/memes/hpb2022k-hype-boy',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    'f30d3aff-38f2-5a61-99f6-9d3d010a7ea4',
    'svg_card',
    'house_original',
    'hpb2022k',
    'https://catchmeme.com/memes/hpb2022k-hype-boy',
    'https://catchmeme.com/memes/hpb2022k-hype-boy/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 꾸안꾸 (꾸민 듯 안 꾸민 듯) (qak2019k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '156c56d3-8bfa-53be-8655-ad10fca8e95b',
    'qak2019k',
    'kkool-kku-an-kku',
    '꾸안꾸 (꾸민 듯 안 꾸민 듯)',
    'phrase',
    'house_original',
    '과하게 힘주지 않고 자연스러우면서도 은근히 멋스러운 스타일이나 메이크업을 뜻하는 축약어.',
    '편안한 캐주얼 의류나 자연스러운 투명 메이크업이지만 실제로는 세련된 감각이 돋보이는 ''노력한 티를 내지 않는 멋''을 칭찬할 때 쓰는 표준 패션 관용어입니다.',
    '2019년 패션 매거진 및 뷰티 유튜버들의 콘텐츠를 통해 전국적으로 정착되었습니다.',
    '과하게 힘주지 않고 자연스러우면서도 은근히 멋스러운 스타일이나 메이크업을 뜻하는 축약어.',
    '대중적인 무해한 어휘입니다.',
    'green',
    'archived',
    'approved',
    2019,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "주말 모임 코디", "dialogue": [{"speaker": "나", "line": "후드티에 슬랙스 매치했더니 편하고 꾸안꾸 느낌 나네!"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '156c56d3-8bfa-53be-8655-ad10fca8e95b',
    'https://catchmeme.com/memes/qak2019k-kkool-kku-an-kku',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '156c56d3-8bfa-53be-8655-ad10fca8e95b',
    'svg_card',
    'house_original',
    'qak2019k',
    'https://catchmeme.com/memes/qak2019k-kkool-kku-an-kku',
    'https://catchmeme.com/memes/qak2019k-kkool-kku-an-kku/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 현타 (현실 자각 타임) (hta2014k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    '55bd92a2-a718-5335-a84f-6a63659f0140',
    'hta2014k',
    'hyeon-ta',
    '현타 (현실 자각 타임)',
    'phrase',
    'house_original',
    '어떤 행위나 허황된 몰입에 빠져 있다가 문득 냉정한 현실을 깨닫고 밀려오는 허탈감과 허무함을 뜻하는 말.',
    '새벽까지 밤새 게임을 하거나 충동구매를 한 뒤, ''내가 지금 뭘 하고 있는 거지?''라며 냉철한 이성이 돌아올 때 느끼는 복합적인 감정을 표현합니다.',
    '인터넷 신조어 ''현자타임''이 방송 및 일상어로 순화되면서 ''현실 자각 타임''으로 재해석되어 대중화되었습니다.',
    '어떤 행위나 허황된 몰입에 빠져 있다가 문득 냉정한 현실을 깨닫고 밀려오는 허탈감과 허무함을 뜻하는 말.',
    '일상의 가벼운 반성을 유쾌하게 공유할 때 널리 쓰입니다.',
    'green',
    'archived',
    'approved',
    2014,
    NOW(),
    100,
    '{"friends": "green", "work": "green", "sns": "green"}'::jsonb,
    '[{"context": "주말 소비 후기", "dialogue": [{"speaker": "동료", "line": "주말에 배달 음식만 10만 원 썼더니 월요일 통장 보고 현타 왔어요 ㅠㅠ"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    '55bd92a2-a718-5335-a84f-6a63659f0140',
    'https://catchmeme.com/memes/hta2014k-hyeon-ta',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    '55bd92a2-a718-5335-a84f-6a63659f0140',
    'svg_card',
    'house_original',
    'hta2014k',
    'https://catchmeme.com/memes/hta2014k-hyeon-ta',
    'https://catchmeme.com/memes/hta2014k-hyeon-ta/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 밈: 내 마음속에 저장 (svh2017k)
-- ----------------------------------------------------------------------------
INSERT INTO public.memes (
    id, short_id, slug, title, category, origin_kind, summary, description,
    origin, usage_note, caution, safety_level, lifecycle_status, moderation_status,
    origin_year, published_at, trend_score, usage_context, usage_examples,
    house_rights_attested_at, created_at, updated_at
) VALUES (
    'ff93c371-50ef-5b64-8480-a83ba8793d2c',
    'svh2017k',
    'save-in-heart',
    '내 마음속에 저장',
    'phrase',
    'house_original',
    '기억하고 싶은 소중한 순간이나 사랑스러운 대상을 손가락 네모 프레임 제스처와 함께 간직하겠다는 애교 밈.',
    '프로듀스 101 시즌 2의 참가자 박지훈이 선보인 시그니처 포즈와 유행어입니다. 2017년 상반기 최고의 유행어로 꼽혔으며, 현재는 귀여운 추억의 밈으로 분류됩니다.',
    '2017년 엠넷 ''프로듀스 101 시즌 2'' 방송 중 박지훈 연습생의 자기소개 및 캐치프레이즈.',
    '기억하고 싶은 소중한 순간이나 사랑스러운 대상을 손가락 네모 프레임 제스처와 함께 간직하겠다는 애교 밈.',
    '유행 시기가 한참 지나 지금 진지하게 유행어처럼 쓰면 다소 올드하게 느껴질 수 있습니다.',
    'gray',
    'archived',
    'approved',
    2017,
    NOW(),
    100,
    '{"friends": "green", "work": "yellow", "sns": "green"}'::jsonb,
    '[{"context": "기념사진 촬영 시", "dialogue": [{"speaker": "친구", "line": "오늘 졸업 파티 단체사진 완전 내 마음속에 저장이다!"}]}]'::jsonb,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (short_id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    origin = EXCLUDED.origin,
    caution = EXCLUDED.caution,
    safety_level = EXCLUDED.safety_level,
    lifecycle_status = EXCLUDED.lifecycle_status,
    moderation_status = 'approved',
    usage_context = EXCLUDED.usage_context,
    usage_examples = EXCLUDED.usage_examples,
    updated_at = NOW();

-- 밈 출처(Sources) 등록
INSERT INTO public.meme_sources (
    meme_id, source_url, source_role, rights_basis, platform, display_order, created_at
) VALUES (
    'ff93c371-50ef-5b64-8480-a83ba8793d2c',
    'https://catchmeme.com/memes/svh2017k-save-in-heart',
    'canonical',
    'house_original',
    'memeCatch',
    0,
    NOW()
) ON CONFLICT DO NOTHING;

-- 밈 대표 미디어 콘텐츠(Contents) 등록
INSERT INTO public.meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, is_representative, availability, created_at, updated_at
) VALUES (
    'ff93c371-50ef-5b64-8480-a83ba8793d2c',
    'svg_card',
    'house_original',
    'svh2017k',
    'https://catchmeme.com/memes/svh2017k-save-in-heart',
    'https://catchmeme.com/memes/svh2017k-save-in-heart/og-image',
    true,
    'live',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;


COMMIT;
