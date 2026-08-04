-- EN meme_translations batch -- loop-050 slice 0, generated 2026-08-04.
-- Source: Claude (this conversation) -- hand-translated from Korean source fields
-- fetched fresh via production anon REST (public.memes), 20 meme_ids assigned to
-- this slice (see docs/renewal loop-050 worklist.json short_ids below).
--
-- Format: plain SQL only (no base64/jsonb_to_record), matching loop-049's pipeline.
-- Each insert is idempotent ('on conflict (meme_id, locale) do nothing'). status is
-- inserted as 'machine' with reviewed_at/reviewed_by null; a follow-up UPDATE block
-- (bottom of file) promotes this session's own rows to status='reviewed' with a
-- freshness guard (memes.updated_at = t.source_updated_at) so a row is never
-- promoted if the Korean source drifted between fetch and apply.
--
-- caution: all 20 source rows have caution=null, so all 20 inserts use null.
-- aliases: each includes the Korean original title (per instructions) plus any
-- Korean aliases already on the source row, translated/kept as applicable.
-- usage_examples: translated where the source had any; '[]'::jsonb otherwise.
--
-- 20 statements total.

-- g76rc5fs  meme_id=f3bcf369-937c-465d-bc94-957069a2eddc  에픽하이 Love Love Love 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f3bcf369-937c-465d-bc94-957069a2eddc',
  'en',
  'epik-high-love-love-love-challenge',
  'Epik High''s Love Love Love Challenge',
  'Epik High''s Love Love Love Challenge means a 2007 Epik High song that resurged on the charts 19 years later through a spontaneous short-form dance challenge.',
  'A simple heart-drawing dance set to the chorus of Epik High''s 2007 song "Love Love Love" spread organically on TikTok, Reels, and Shorts, sending the track back up the music charts in early 2026. The trend drew attention because the song wasn''t written with any challenge in mind, landing as a brand-new discovery for Gen Z while stirring nostalgia for longtime fans.',
  'A 2007 Epik High song that resurged via a short-form challenge in 2026.',
  'Used when an old favorite song gets a second life through a new challenge.',
  null,
  array['에픽하이 Love Love Love 챌린지'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- ra86attn  meme_id=52c381c5-800b-44db-b04b-971653620ce5  봉숭아학당 그까이꺼 대충
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '52c381c5-800b-44db-b04b-971653620ce5',
  'en',
  'bongsunga-school-whatever-just-roughly',
  'Bongsunga School''s "Whatever, Just Roughly"',
  'This meme means Jang Dong-min''s 2004 catchphrase as a security-guard character on Gag Concert: "whatever, just roughly."',
  'Starting in late 2004, comedian Jang Dong-min played a security-guard character on Gag Concert''s "Bongsunga School" segment, wrapping up his rants with the catchphrase "geukkaikkeo geunyang mwo dae-chung" ("whatever, just roughly") to suggest that even a tough problem could be solved with a shrug.',
  'From the security-guard character on KBS''s Gag Concert segment "Bongsunga School," which aired from late November 2004 to April 2006. Jang Dong-min, who debuted in 2004 as part of KBS''s 19th open-recruitment comedian class, played a security guard speaking in Chungcheong dialect who barged into class to boast before wrapping up with "whatever, just roughly!" The catchphrase made his name known to the public right at his debut and was later quoted and parodied across various broadcasts.',
  'Used to brush off a difficult task lightly.',
  null,
  array['그까이꺼','그까이꺼 그냥 뭐 대충','봉숭아학당 그까이꺼 대충'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- knk2hsye  meme_id=d5fbbcff-805a-4141-b203-6109d21823e9  우정의 무대 그리운 어머니
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd5fbbcff-805a-4141-b203-6109d21823e9',
  'en',
  'stage-of-friendship-longing-for-mother',
  'Stage of Friendship''s "Longing for Mother"',
  'Stage of Friendship''s "Longing for Mother" segment means the tearjerker military-show finale where a mother and her soldier son are dramatically reunited on stage.',
  'From July 1990, this military variety show''s "Stage of Friendship" segment closed each episode with the theme song "Longing for Mother" playing as a mother, called out by name, walked onto the stage for a dramatic reunion with her soldier son -- a moment that reduced viewers to tears every time it aired. The opening of "When I Miss Mom" is still clipped and replayed today as a symbol of nostalgia.',
  'From KBS''s "Stage of Friendship" segment (1990s).',
  'Cited as a comparison when describing a moving reunion scene.',
  null,
  array['그리운 어머니','엄마가 보고플 때','우정의 무대 그리운 어머니'],
  '[{"situation": "KakaoTalk", "text": "This reunion clip hits just like the Stage of Friendship segment."}, {"situation": "SNS comment", "text": "I still tear up every time \"Longing for Mother\" comes on."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- r2fg5gqv  meme_id=bff1b60f-c247-4033-a8cb-806bcad0173b  잘자 내꿈꿔
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'bff1b60f-c247-4033-a8cb-806bcad0173b',
  'en',
  'sleep-tight-dream-of-me',
  'Sleep Tight, Dream of Me',
  '"Sleep Tight, Dream of Me" is a catchphrase from a 1999-2000 TV commercial that became a widely used goodnight greeting.',
  'In a 1999 ad for KTF''s email service, singers Jo Sung-mo and Lee Jung-hyun played a couple saying goodbye, ending with the flirtatious line "sleep tight, dream of me" ("jalja nae kkumkkwo"). The ad''s sparkly teddy bear also became a huge hit, with the "dream-of-me bear" toy becoming a near-essential item among students. Roughly 200 parody versions mimicking the delivery in celebrities'' voices reportedly circulated on TV and radio, and the line ranked among the top catchphrases of 1999 -- a prime example of an ad tagline becoming an everyday greeting.',
  'From a 1999 KTF email-service TV commercial starring Jo Sung-mo and Lee Jung-hyun.',
  'Can be used as-is as a goodnight greeting between close friends.',
  null,
  array['잘 자, 내 꿈 꿔','잘자 내꿈꿔'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- uvdujpcy  meme_id=c80ac83d-0002-4981-a1b8-93945a965e17  그리운 어머니
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'c80ac83d-0002-4981-a1b8-93945a965e17',
  'en',
  'longing-for-mother-stage-of-friendship',
  '"Longing for Mother" (Stage of Friendship)',
  '"Longing for Mother" means the tearful segment on Stage of Friendship where host Lee Sang-yong helped soldiers guess their mother''s identity by voice alone before a surprise reunion.',
  'On MBC''s "Stage of Friendship" (1989-1997), host Lee Sang-yong had soldiers try to identify their own mother from behind the stage using only her voice, before staging a surprise reunion -- a segment that, paired with the theme song "Longing for Mother" used from July 1990 onward, became an iconic tearjerker moment for the entire nation.',
  'Became the segment''s fixed theme song starting with the episode aired July 23, 1990, on MBC''s "Stage of Friendship."',
  'Cited when describing a moving family reunion scene.',
  null,
  array['우정의 무대','어머니 상봉 코너','그리운 어머니'],
  '[{"situation": "KakaoTalk", "text": "This reunion video is as moving as the \"Longing for Mother\" segment."}, {"situation": "SNS comment", "text": "I still cry every time I rewatch Stage of Friendship''s \"Longing for Mother.\""}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 345hhqyt  meme_id=a90b8639-151a-45ee-9c5c-6d57601950c5  말하지 않아도 알아요
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'a90b8639-151a-45ee-9c5c-6d57601950c5',
  'en',
  'you-know-without-saying-choco-pie',
  '"You Know Without Saying" (Choco Pie Jeong)',
  '"You Know Without Saying" is the beloved jingle for Orion''s Choco Pie "Jeong" campaign, symbolizing the concept of Korean familial affection.',
  'Produced in 1989 and used throughout Choco Pie ads across the 1990s, this short jingle chorus set to the word "jeong" (a uniquely Korean sense of affection and attachment) stuck in the minds of generations. It has since been rearranged into many versions and is still used as a brand jingle today.',
  'From Orion''s Choco Pie "Jeong" TV commercial jingle (1989 through the 1990s).',
  'Hummed or quoted to express warmth or unspoken affection.',
  null,
  array['초코파이 정 CM송','말하지 않아도 알아요'],
  '[{"situation": "KakaoTalk", "text": "No need to say thanks -- you know without saying, right? That''s us."}, {"situation": "SNS comment", "text": "This scene reminds me of the Choco Pie \"Jeong\" jingle."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- hy3gqdv6  meme_id=8ebb24a9-ac04-4129-b86f-4e17cc31d121  몸짱 아줌마
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8ebb24a9-ac04-4129-b86f-4e17cc31d121',
  'en',
  'buff-auntie-momjjang-ajumma',
  'The "Buff Auntie" Phenomenon',
  'The "Buff Auntie" phenomenon means an ordinary housewife''s before-and-after diet and muscle transformation sparking a nationwide fitness craze in 2005.',
  'Before-and-after photos of Jung Da-yeon shedding fat and sculpting a toned physique down from 70kg spread through the press and online in 2005, kicking off the "Buff Auntie" ("Momjjang Ajumma") craze. In contrast to the "pretty-face" (eoljjang) trend, the story of an ordinary person building a healthy body through hard work resonated widely and fed into a nationwide diet boom.',
  'Jung Da-yeon''s diet success story, first known from a 2002 contribution to the online outlet Ddanzi Ilbo, went nationally viral after 2005 press coverage.',
  'Referenced when discussing 2000s diet trends or body transformation.',
  null,
  array['봄날 아줌마','정다연','몸짱 아줌마'],
  '[{"situation": "KakaoTalk", "text": "I''ve been working out lately -- I want to end up looking like the Buff Auntie."}, {"situation": "SNS comment", "text": "A body built through that much effort is straight-up Buff Auntie level."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- g2s5d2v6  meme_id=d82b66a8-25ea-4238-a48b-1f8ebb0862e2  브라운아이드걸스 하우컴 레트로댄스
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd82b66a8-25ea-4238-a48b-1f8ebb0862e2',
  'en',
  'brown-eyed-girls-how-come-retro-dance',
  'Brown Eyed Girls'' "How Come" Retro Dance',
  'Brown Eyed Girls'' "How Come" Retro Dance means the retro-styled choreography and leggings fashion trend sparked by the group''s 2008 song "How Come."',
  'Released in 2008, Brown Eyed Girls'' "How Come" was a retro-style dance track that marked the group''s turning point from an R&B vocal team into a dance-focused act, and the leggings worn as part of the stage outfit became a fashion trend.',
  'Choreography for the title track of Brown Eyed Girls'' mini-album "My Style."',
  'Cited as an example of the 2008 retro-dance trend.',
  null,
  array['How Come 댄스','브라운아이드걸스 하우컴 레트로댄스'],
  '[{"situation": "KakaoTalk", "text": "That leggings look is total How Come era style."}, {"situation": "SNS comment", "text": "When it comes to retro dance, it''s gotta be How Come."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- h6wskk4v  meme_id=62d6b185-cfac-4fa1-9e9b-8b7f33febf70  친구의 친구를 사랑했네
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '62d6b185-cfac-4fa1-9e9b-8b7f33febf70',
  'en',
  'i-loved-a-friend-of-a-friend-hansol-pcs-018',
  '"I Loved a Friend of a Friend" (Hansol PCS 018 CM)',
  '"I Loved a Friend of a Friend" was an emotionally resonant Hansol PCS 018 mobile-carrier ad that used a Lee Seung-chul ballad as its jingle.',
  'In 1997, Hansol PCS used Lee Seung-chul''s song "I Loved a Friend of a Friend" as the jingle for its 018 brand commercial, creating an emotional mood. It''s often cited as an example of borrowing a popular ballad for advertising to softly convey a brand''s image. Despite the song''s popularity, the 018 brand itself later disappeared when it merged into KTF.',
  'From a 1997 Hansol PCS 018 TV commercial featuring Lee Seung-chul''s song.',
  'Cited as an example of emotional marketing that repurposed a ballad as an ad jingle.',
  null,
  array['한솔PCS 018 CM송','친구의 친구를 사랑했네'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 5qw2ggqg  meme_id=dbff1d5b-e6d6-4fcd-9564-48c4ce6de1e4  회상(터보)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'dbff1d5b-e6d6-4fcd-9564-48c4ce6de1e4',
  'en',
  'turbo-hoisang-december',
  'Turbo''s "Hoisang (December)"',
  'Turbo''s "Hoisang (December)" was the group''s beloved winter hit, known for its heartfelt lyrics and choreography.',
  '"Hoisang (December)," the follow-up single from Turbo''s 1997 third album "Born Again," won huge popularity for its plaintive melody and stage performance. It''s one of the defining 90s ballad-dance songs that got replayed constantly on broadcasts and in the streets every winter.',
  'Follow-up single from Turbo''s third album "Born Again" (October 1997).',
  'Cited as a retro song when discussing year-end or winter sentimentality.',
  null,
  array['터보 회상','December','회상(터보)'],
  '[{"situation": "KakaoTalk", "text": "Once winter hits, Turbo''s \"Hoisang\" starts playing on autopilot in my head."}, {"situation": "SNS comment", "text": "This feeling is straight-up that winter, all over again."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- ckzrrca9  meme_id=981bbf8f-3c85-4e45-8961-e064210186a7  히밥
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '981bbf8f-3c85-4e45-8961-e064210186a7',
  'en',
  'heebab',
  'Heebab',
  'Heebab is the nickname and meme surrounding a female YouTuber who debuted in 2019 and became known for extreme-eating mukbang videos.',
  'Debuting on AfreecaTV (now SOOP) in December 2019, Heebab became a viral mukbang creator by polishing off a giant pork cutlet faster than fellow creator Tzuyang. She went on to surpass one million YouTube subscribers and establish herself as a leading mukbang YouTuber. Remarks like hers that "red food gets better views" have become memes repeated within the mukbang community.',
  'Went viral through YouTube mukbang content after debuting on AfreecaTV in 2019.',
  'Used when discussing mukbang YouTubers or big eaters.',
  null,
  array['heebab','먹방 히밥'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- h5ragtd9  meme_id=20ee90c8-e917-4627-a781-98676e56c7b3  이수영 - 라라라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '20ee90c8-e917-4627-a781-98676e56c7b3',
  'en',
  'lee-soo-young-la-la-la',
  'Lee Soo-young - "La La La"',
  '"La La La" is Lee Soo-young''s beloved 2002 hit, known for its simple, addictive chorus.',
  'The title track of Lee Soo-young''s fourth studio album, released in 2002, "La La La" swept the music charts of the time with its simple, catchy "la la la" chorus. It''s one of the signature songs that cemented her standing as a ballad singer.',
  'Released as the title track of Lee Soo-young''s fourth studio album, "My Stay in Sendai" (2002).',
  'Cited when discussing great early-2000s ballads.',
  null,
  array['이수영 4집 타이틀곡','이수영 - 라라라'],
  '[{"situation": "KakaoTalk", "text": "La la la -- this chorus just keeps looping in my head."}, {"situation": "SNS comment", "text": "When it comes to great early-2000s ballads, it''s gotta be \"La La La.\""}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- x4zwc4wk  meme_id=b6d92676-a240-4a48-a523-8d627ef7c6a4  그래, 결심했어!
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'b6d92676-a240-4a48-a523-8d627ef7c6a4',
  'en',
  'alright-ive-decided',
  '"Alright, I''ve Decided!"',
  '"Alright, I''ve Decided!" was the signature catchphrase from the TV segment "Life Theater," declared at every fork-in-the-road moment.',
  'Starting in 1993, on MBC''s "Sunday Sunday Night" segment "TV Life Theater," host Lee Hwi-jae would stand before two life choices, face the camera, and declare "Alright, I''ve decided!" The format -- where the moral choice led to a happy ending and the immoral one to disaster -- is still parodied today at moments of decision.',
  'From MBC''s "Sunday Sunday Night - TV Life Theater" (1993-1995), hosted by Lee Hwi-jae.',
  'Quoted jokingly at the moment of making an important decision.',
  null,
  array['TV 인생극장','이휘재 인생극장','그래, 결심했어!'],
  '[{"situation": "KakaoTalk", "text": "What should I have for lunch... Alright, I''ve decided! Gukbap it is."}, {"situation": "SNS comment", "text": "After a lot of back and forth, I said \"alright, I''ve decided\" and just went for it."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- uskrnffh  meme_id=b54e3944-9dee-4f4e-8ba4-cb08778711b2  나야나(프로듀스101)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'b54e3944-9dee-4f4e-8ba4-cb08778711b2',
  'en',
  'its-me-produce-101',
  '"It''s Me" (Produce 101)',
  '"It''s Me" ("Nayana") is the theme song of Produce 101 Season 2 that became a nationwide meme.',
  'The theme song of Mnet''s survival show Produce 101 Season 2 (2017), "It''s Me" ("Nayana") went viral for its choreography of trainees shouting "it''s me, it''s me!" to appeal for votes. The exaggerated facial expressions and gestures were endlessly reproduced in parodies and edited images, making it one of the defining entertainment and internet memes of 2017.',
  'Spread following the 2017 broadcast of Mnet''s Produce 101 Season 2.',
  'Used playfully to express self-promotion or a desire to be chosen.',
  null,
  array['PICK ME','나야 나','나야나(프로듀스101)'],
  '[{"situation": "KakaoTalk", "text": "It''s me! It''s me! This time it''s my turn to be picked lol"}, {"situation": "SNS comment", "text": "This kind of self-promotion is total \"It''s Me\" energy."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- jkq83czt  meme_id=e8baeb72-71e1-48e8-9822-f86d40760a81  DDR(댄스 댄스 레볼루션) 오락실 열풍
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'e8baeb72-71e1-48e8-9822-f86d40760a81',
  'en',
  'ddr-dance-dance-revolution-arcade-craze',
  'The DDR (Dance Dance Revolution) Arcade Craze',
  'DDR was the Japanese rhythm arcade machine that swept Korean arcades in 1999.',
  'Developed by Japan''s Konami, the rhythm arcade game Dance Dance Revolution (DDR) landed in Korean arcades around July 1999. Its novel gameplay -- stepping on floor arrows in time with the music -- caught on quickly enough to spawn online communities almost immediately after launch, and combined with a diet craze at the time to become a social phenomenon enjoyed by people of all ages. It became popular enough that terrestrial broadcasters aired DDR tournaments, but it lost ground within about three years to the competing domestic machine "Pump It Up" from Andamiro.',
  'Landed in Korean arcades around July 1999.',
  'Can be brought up when reminiscing about turn-of-the-millennium arcade culture.',
  null,
  array['DDR','댄스댄스레볼루션','DDR(댄스 댄스 레볼루션) 오락실 열풍'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- n8x6kv6e  meme_id=fd63d7c5-893f-401d-b993-e10f762b2ca2  대장금 홍시맛 명대사
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fd63d7c5-893f-401d-b993-e10f762b2ca2',
  'en',
  'dae-jang-geum-tastes-like-persimmon-line',
  'Dae Jang Geum''s "Tastes Like Persimmon" Line',
  'This is a famous line from the 2003 drama Dae Jang Geum, spoken by the young heroine Jang-geum.',
  'In episode 5 of MBC''s 2003 drama Dae Jang Geum, young Jang-geum is asked by a court lady what ingredient gave a dish its flavor and answers, "It just tasted like persimmon, so I thought it was persimmon..." -- a line that became an iconic quote from a drama that drew ratings above 50%.',
  'From episode 5 of MBC''s drama Dae Jang Geum, aired September 29, 2003. In the scene, young Jang-geum correctly identifies the exact taste of a dish for the head court lady, Lady Jeong. When Lady Jeong asks, "How did you know it was persimmon?", Jang-geum answers, "It just tasted like persimmon, so I thought it was persimmon..." and Lady Jeong marvels, "You truly were born with a gifted palate." A signature scene from a drama that hit ratings above 50%, the line became a fixed reference for teasing someone''s illogical, circular explanation.',
  'Quoted jokingly when someone gives an illogical explanation.',
  null,
  array['홍시맛이 나서 홍시라 생각했느냐','대장금 홍시맛 명대사'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- xgzqteb3  meme_id=31d79b28-24cf-4d5a-9e0f-7a40a370838e  컴백홈
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '31d79b28-24cf-4d5a-9e0f-7a40a370838e',
  'en',
  'come-back-home-seo-taiji-and-boys',
  '"Come Back Home" (Seo Taiji and Boys)',
  '"Come Back Home" refers to Seo Taiji and Boys'' 1995 comeback stage that sparked a nationwide hip-hop fashion trend.',
  'At a special broadcast unveiling Seo Taiji and Boys'' fourth album in October 1995, the group''s snowboard jackets, baggy hip-hop pants, and half-shaved hairstyles spread into a nationwide fashion trend. The moment is also cited as the point when the concept of the "fan club" first took hold in Korea, and it has remained a frequent subject of parody and nostalgic content ever since.',
  'From MBC''s special broadcast "Come Back Home: Seo Taiji and Boys," aired October 6, 1995.',
  'Cited when reminiscing about 90s fashion and idol culture.',
  null,
  array['서태지와 아이들 4집','Come Back Home','컴백홈'],
  '[{"situation": "KakaoTalk", "text": "These hip-hop pants are total Come Back Home style."}, {"situation": "SNS comment", "text": "That stage was really the start of fandom culture back then."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 46x2hg97  meme_id=4fd1c758-2785-4a66-a69f-062818ef8ea0  박세리 맨발 투혼
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '4fd1c758-2785-4a66-a69f-062818ef8ea0',
  'en',
  'pak-se-ri-barefoot-grit',
  'Pak Se-ri''s Barefoot Grit',
  'Pak Se-ri''s Barefoot Grit means her taking off her shoes to wade barefoot into a water hazard during a 1998 US Open playoff.',
  'At the 18th-hole playoff of the 1998 US Women''s Open in July, Pak Se-ri took off her shoes and socks to step barefoot into a water hazard and pull off a successful shot -- a moment that gave hope and comfort to a nation exhausted by the IMF financial crisis. The image became so iconic it was later used as a background for renditions of the national anthem.',
  'From the playoff of the 53rd US Women''s Open (July 7, 1998, Blackwolf Run Golf Club).',
  'Cited symbolically when discussing grit and hope in the face of crisis.',
  null,
  array['맨발의 투혼','박세리 US오픈','박세리 맨발 투혼'],
  '[{"situation": "KakaoTalk", "text": "With that much effort, it''s basically Pak Se-ri''s barefoot-grit level."}, {"situation": "SNS comment", "text": "When I think of grit in a crisis, this is the scene that comes to mind."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- h49br6xs  meme_id=f6b2c098-67a2-4f2d-a5d4-44ed2848e02b  백종원의 골목식당 포방터시장 홍탁집
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f6b2c098-67a2-4f2d-a5d4-44ed2848e02b',
  'en',
  'baek-jong-wons-alley-restaurant-hongtak-shop',
  'Baek Jong-won''s Alley Restaurant: The Hongtak Shop',
  'This refers to the dramatic turnaround story of the mother-and-son hongtak restaurant featured in the Pobangteo Market episode of Baek Jong-won''s Alley Restaurant, widely cited as the show''s best-ever outcome.',
  'In the ninth solution location of SBS''s "Baek Jong-won''s Alley Restaurant" (November 2018), set in Seoul''s Hongeun-dong Pobangteo Market, the owner of a mother-and-son-run hongtak (fermented skate and makgeolli) restaurant was called out for a careless attitude during Baek Jong-won''s first visit, but turned things around completely by the end. The episode was such a sensation that it became the show''s first to run for six full episodes, and after it aired, businesses like the market''s pork-cutlet restaurant became nationally famous.',
  'From the Hongeun-dong Pobangteo Market episode of SBS''s "Baek Jong-won''s Alley Restaurant" (November 2018).',
  'Frequently cited as a prime example of a small-business turnaround story.',
  null,
  array['포방터시장 돈가스집','포방터시장 레전드','백종원의 골목식당 포방터시장 홍탁집'],
  '[]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- up49tmk9  meme_id=e020d479-c75c-4556-859c-4447d6da6e45  난 알아요 & 회오리춤
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'e020d479-c75c-4556-859c-4447d6da6e45',
  'en',
  'i-know-and-the-whirlwind-dance',
  '"I Know" and the Whirlwind Dance (Seo Taiji and Boys)',
  'This refers to the cultural shock caused by Seo Taiji and Boys'' debut song "I Know" and its unconventional whirlwind dance.',
  '"I Know" and its "whirlwind dance" ("hoeori chum"), performed by Seo Taiji and Boys at their April 1992 debut stage, are remembered as a shocking event that upended the music industry the moment it aired. It became a go-to piece for student talent shows afterward, and it''s still frequently revisited on YouTube today as a cultural icon symbolizing the 90s generational shift.',
  'The title track of Seo Taiji and Boys'' first album, debuting on MBC''s "Special Report: TV Entertainment" (April 11, 1992).',
  'Cited when explaining the cultural shock and generational shift of the 1990s.',
  null,
  array['서태지와 아이들 데뷔 무대','회오리 춤','난 알아요 & 회오리춤'],
  '[{"situation": "KakaoTalk", "text": "Watching new idols debut these days reminds me of the shock of Seo Taiji''s whirlwind dance debut."}, {"situation": "SNS comment", "text": "This is a total generational-shift-level entrance -- takes me back to the whirlwind dance era."}]'::jsonb,
  'machine',
  '2026-07-15T15:30:00.191373+00:00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- ---------------------------------------------------------------------------
-- Self-promotion: flip this slice's 20 rows from 'machine' to 'reviewed'.
-- Freshness-guarded: only promotes if memes.updated_at still equals the
-- source_updated_at snapshotted at insert time (m.updated_at = t.source_updated_at).
-- ---------------------------------------------------------------------------
update public.meme_translations t
set status = 'reviewed',
    reviewed_at = now(),
    reviewed_by = 'c7295ec1-1ca9-414d-a7e1-8f19005a90d0'::uuid
from public.memes m
where t.meme_id = m.id
  and t.locale = 'en'
  and t.status = 'machine'
  and t.model = 'claude-fable-5'
  and t.prompt_version = 12
  and m.updated_at = t.source_updated_at
  and t.meme_id in (
  'f3bcf369-937c-465d-bc94-957069a2eddc',
  '52c381c5-800b-44db-b04b-971653620ce5',
  'd5fbbcff-805a-4141-b203-6109d21823e9',
  'bff1b60f-c247-4033-a8cb-806bcad0173b',
  'c80ac83d-0002-4981-a1b8-93945a965e17',
  'a90b8639-151a-45ee-9c5c-6d57601950c5',
  '8ebb24a9-ac04-4129-b86f-4e17cc31d121',
  'd82b66a8-25ea-4238-a48b-1f8ebb0862e2',
  '62d6b185-cfac-4fa1-9e9b-8b7f33febf70',
  'dbff1d5b-e6d6-4fcd-9564-48c4ce6de1e4',
  '981bbf8f-3c85-4e45-8961-e064210186a7',
  '20ee90c8-e917-4627-a781-98676e56c7b3',
  'b6d92676-a240-4a48-a523-8d627ef7c6a4',
  'b54e3944-9dee-4f4e-8ba4-cb08778711b2',
  'e8baeb72-71e1-48e8-9822-f86d40760a81',
  'fd63d7c5-893f-401d-b993-e10f762b2ca2',
  '31d79b28-24cf-4d5a-9e0f-7a40a370838e',
  '4fd1c758-2785-4a66-a69f-062818ef8ea0',
  'f6b2c098-67a2-4f2d-a5d4-44ed2848e02b',
  'e020d479-c75c-4556-859c-4447d6da6e45'
  );

-- ---------------------------------------------------------------------------
-- Verification: count reviewed rows among this slice's 20 meme_ids.
-- ---------------------------------------------------------------------------
select count(*) as reviewed_count
from public.meme_translations
where locale = 'en'
  and status = 'reviewed'
  and meme_id in (
  'f3bcf369-937c-465d-bc94-957069a2eddc',
  '52c381c5-800b-44db-b04b-971653620ce5',
  'd5fbbcff-805a-4141-b203-6109d21823e9',
  'bff1b60f-c247-4033-a8cb-806bcad0173b',
  'c80ac83d-0002-4981-a1b8-93945a965e17',
  'a90b8639-151a-45ee-9c5c-6d57601950c5',
  '8ebb24a9-ac04-4129-b86f-4e17cc31d121',
  'd82b66a8-25ea-4238-a48b-1f8ebb0862e2',
  '62d6b185-cfac-4fa1-9e9b-8b7f33febf70',
  'dbff1d5b-e6d6-4fcd-9564-48c4ce6de1e4',
  '981bbf8f-3c85-4e45-8961-e064210186a7',
  '20ee90c8-e917-4627-a781-98676e56c7b3',
  'b6d92676-a240-4a48-a523-8d627ef7c6a4',
  'b54e3944-9dee-4f4e-8ba4-cb08778711b2',
  'e8baeb72-71e1-48e8-9822-f86d40760a81',
  'fd63d7c5-893f-401d-b993-e10f762b2ca2',
  '31d79b28-24cf-4d5a-9e0f-7a40a370838e',
  '4fd1c758-2785-4a66-a69f-062818ef8ea0',
  'f6b2c098-67a2-4f2d-a5d4-44ed2848e02b',
  'e020d479-c75c-4556-859c-4447d6da6e45'
  );
