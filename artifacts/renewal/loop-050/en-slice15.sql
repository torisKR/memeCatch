-- EN meme_translations batch -- loop-050, slice 15, generated 2026-08-04.
-- Source: Claude (this subagent session) -- hand-translated from memes REST fetch
-- (anon key, SELECT only), not machine-pipeline-generated.
-- Scope: 20 meme_ids assigned to slice 15 of the loop-050 worklist
-- (artifacts/renewal/loop-050/worklist.json), none of which had an existing
-- 'en' row in meme_translations at fetch time (verified via REST).
--
-- Format follows artifacts/renewal/loop-049/en-translations-claude.sql: plain SQL,
-- each insert is 'on conflict (meme_id, locale) do nothing' -- idempotent, safe to
-- re-run. status is inserted as 'machine'; a separate UPDATE block below promotes
-- this slice's own rows to 'reviewed' under the user's blanket approval recorded
-- in docs/renewal/LOOP_STATE.md loop-049 ("검수 승격은 사용자 포괄 승인").
--
-- caution is translated (not nulled) per this slice's explicit instructions.
-- memes table was never written -- SELECT only via REST.


-- 1/20  s66254dp  meme_id=94bf8fcf-41da-48de-af30-e56df39a1b19  스티킹 아웃 유어 갸트 포 더 리즐러
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '94bf8fcf-41da-48de-af30-e56df39a1b19',
  'en',
  'sticking-out-your-gyat-for-the-rizzler',
  'Sticking Out Your Gyat for the Rizzler',
  'Sticking Out Your Gyat for the Rizzler is a parody song meme that strings together Gen Z/Gen Alpha slang like gyat, rizzler, and skibidi.',
  'The parody song''s lyrics pack in youth slang terms such as ''gyatt,'' ''rizzler,'' ''skibidi,'' and ''fanum tax,'' and the lyrics themselves became the meme. Creators made a wave of reaction and lip-sync videos imitating or teasing kids'' slang. It''s consumed less for the slang itself than as a generation-gap joke about words adults supposedly can''t understand.',
  'TikToker @papaboy020 made the parody song in October 2023, and it spread to spawn over 20,000 spin-off videos within a month.',
  'Used to list out slang terms and play up the generation gap as a joke.',
  'Contains slang with sexual connotations (gyat), so use caution depending on context.',
  array['Sticking Out Your Gyat for the Rizzler','Gyat Rizzler Song','스티킹 아웃 유어 갸트 포 더 리즐러'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 2/20  35jbkzz3  meme_id=2401aaa8-e175-4c94-8df9-1aa8b2c9aff7  개그콘서트 옥동자
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '2401aaa8-e175-4c94-8df9-1aa8b2c9aff7',
  'en',
  'gag-concert-okdongja',
  'Gag Concert''s Okdongja',
  'Okdongja is the ugly-duckling character Jung Jong-chul played on Gag Concert, whose name became 2002-era slang for ''ugly.''',
  'Jung Jong-chul played an intentionally unattractive character on the sketch show Gag Concert, and from 2002 onward the character''s name, ''Okdongja,'' itself became slang used to tease someone about their looks.',
  'Jung Jong-chul debuted in 2000 as a member of KBS''s 15th class of contract comedians, then introduced the character in the ''Bongsunga Hakdang'' segment of KBS''s Gag Concert in June 2002. ''Okdongja'' originally meant a cute baby boy, but once the character built around Jung''s distinctive looks became popular, the word''s meaning was completely overturned into slang for an unattractive appearance almost immediately after debut. Combined with the era''s broadcast custom of comedians being called by their character names more often than their real names, ''Okdongja'' quickly hardened into an appearance-shaming term used outside broadcasting too.',
  'Brought up when explaining the appearance-comedy segment itself.',
  'Has come to be used as slang that mocks someone''s looks, so use caution in actual conversation.',
  array['Okdongja','옥동자'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 3/20  9eabh3s5  meme_id=8c96f19e-158b-4f55-8af7-bdc1c81bf9d4  봄날은 간다 라면 먹고 갈래
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8c96f19e-158b-4f55-8af7-bdc1c81bf9d4',
  'en',
  'one-fine-spring-day-ramyeon-line',
  'One Fine Spring Day: ''Want to Stay for Ramyeon?''',
  '''Want to stay for ramyeon?'' is a dating euphemism that comes from an ad-libbed line in the 2001 film One Fine Spring Day.',
  'In the 2001 film One Fine Spring Day, a line reportedly ad-libbed by Lee Young-ae to Yoo Ji-tae -- ''Would you like to eat ramyeon?'' -- later got retold as ''Want to stay for ramyeon?'' and became the go-to euphemism for asking someone on a date.',
  'In the 2001 film One Fine Spring Day, Eun-su (Lee Young-ae) tries to keep Sang-woo (Yoo Ji-tae) from leaving at her doorstep; the line is said to have originally been scripted as ''Want to have some coffee?'' before Lee Young-ae ad-libbed it into ''Would you like to eat ramyeon?'' This backstory resurfaced as a topic in April 2022 on an SBS film program. Because it conveys a wish to stay together without saying so directly, the euphemism became a widely used, almost idiomatic line in dating situations.',
  'Can be quoted as a light joke when suggesting a date.',
  'Commonly understood with a sexual connotation, so it can be inappropriate depending on context.',
  array['Want to Stay for Ramyeon?','라면 먹고 갈래'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 4/20  3vaayd2t  meme_id=6fd9a595-840f-4222-bae3-f1355bb40095  NMIXX 장르 스위칭 논란
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '6fd9a595-840f-4222-bae3-f1355bb40095',
  'en',
  'nmixx-genre-switching-controversy',
  'NMIXX Genre-Switching Controversy',
  'NMIXX''s genre-switching controversy refers to the buzz and mixed reactions around the debut concept of JYP girl group NMIXX, whose songs shift genres abruptly mid-track.',
  'JYP rookie girl group NMIXX debuted in February 2022 with the single ''O.O,'' whose ''mixed pop'' concept -- switching between several genres within a single song -- generated both buzz and polarized opinions. The unusual blind marketing that kept the group''s name and members'' identities hidden pre-debut, along with early plagiarism accusations, also drew attention.',
  'JYP Entertainment girl group NMIXX''s debut single ''O.O'' (February 2022).',
  'Used when discussing a K-pop track with an unusual genre-switching concept.',
  'The group faced plagiarism controversy early in its career, so be careful when bringing it up.',
  array['NMIXX O.O','NMIXX'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 5/20  wqt7ap2e  meme_id=9172697b-8576-417c-bbe6-65860fa422c4  미룬이 사건
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '9172697b-8576-417c-bbe6-65860fa422c4',
  'en',
  'mirun-i-incident',
  'The ''Mirun-i'' Incident',
  'The Mirun-i Incident is the awkward moment when singer Lee Je-gyu tried to get the crowd to sing along to his new song ''Mirun-i'' at a YouTube fan festival, and no one joined in.',
  'Released in May 2024, Lee Je-gyu''s song ''Mirun-i'' is about someone who starts things but never finishes them. At a YouTube Fan Fest Korea stage, Lee shouted ''Mirun-i!'' to get the crowd singing along, but with no response from the audience he ended up dancing alone in an awkward moment that went viral on social media, later becoming the spark for several spin-off challenges, including the Avocado Challenge.',
  'Singer Lee Je-gyu''s stage at YouTube Fan Fest Korea, May 2024.',
  'Used to describe an embarrassing situation with no audience response.',
  'Since it''s based on a specific singer''s stage failing to land, avoid using it in a mocking tone.',
  array['미룬이 사태','미룬이 사건'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 6/20  btcz2jk3  meme_id=041f6c84-a8fe-4d55-a967-8bf4e95f4a89  짝 애정촌
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '041f6c84-a8fe-4d55-a967-8bf4e95f4a89',
  'en',
  'jjak-love-village',
  'Jjak''s ''Love Village''',
  'Jjak''s Love Village is the format of the SBS reality show Jjak, where contestants are called ''Man No. 1,'' ''Woman No. 1,'' and so on instead of by their real names as they search for a match.',
  'The SBS reality show Jjak, which began in March 2011, called on-camera participants by numbered labels like ''Man No. 1'' and ''Woman No. 1'' instead of their real names, following their search for a match while living together in a shared space called ''Aejeongchon'' (Love Village), and it drew huge attention. In an early season, ''Woman No. 1,'' nicknamed the ''chair-daughter,'' actually went on to marry a fellow contestant, which became a topic of its own, but the show faced major controversy and questions about its survival after a participant died during filming in 2013.',
  'SBS''s Jjak began its regular run on March 23, 2011.',
  'Terms like ''Love Village'' and the numbered ''-ho'' way of addressing contestants are still quoted like catchphrases.',
  'The show is tied to an actual contestant''s death in 2013, so it shouldn''t be treated lightly.',
  array['Jjak Woman No. 1 / Man No. 1','짝 애정촌'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 7/20  ukaacy54  meme_id=6a52ac23-0bd0-453e-924a-e6dd9b669c29  로우도깅 플라이트(Rawdogging a Flight)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '6a52ac23-0bd0-453e-924a-e6dd9b669c29',
  'en',
  'rawdogging-a-flight',
  'Rawdogging a Flight',
  'Rawdogging a flight means enduring a long-haul flight bare -- no in-flight entertainment, no snacks, sometimes not even water.',
  'It''s a trend of showing off getting through a long flight without watching in-flight movies, eating snacks, or even drinking water, staring only at the flight-path map, as if it were proof of toughness. Experts warn that the extreme version carries health risks like dehydration and blood clots. It caught on as an unusual way of enduring boredom.',
  'A trend that spread on TikTok from videos travelers posted in summer 2024.',
  'Used to describe unnecessarily choosing to endure discomfort.',
  'The extreme version -- going a long flight without water or sleep -- carries health risks such as dehydration and blood clots.',
  array['Rawdogging Flight','로우도깅 플라이트'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 8/20  dqdg5gfe  meme_id=554414dd-68eb-4a9c-8941-875665bb03e1  치킨조키 밈
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '554414dd-68eb-4a9c-8941-875665bb03e1',
  'en',
  'chicken-jockey-meme',
  'Chicken Jockey Meme',
  'The Chicken Jockey meme comes from audiences cheering and throwing popcorn when the line ''Chicken Jockey!'' is shouted in A Minecraft Movie.',
  'In the 2025 film A Minecraft Movie, when the rare in-game mob the ''chicken jockey'' (a baby zombie riding a chicken) appears, Jack Black''s character Steve shouts ''Chicken Jockey!'' -- and North American theater audiences responded by throwing popcorn and drinks and cheering as if at a concert, a reaction that spread as a social media meme. The explosive response even moved up the movie''s Korean release date by four days, though some theaters posted notices asking audiences to hold back on disruptive behavior.',
  'North American audience reactions during screenings of A Minecraft Movie in 2025.',
  'Used for humor about theater commotions; take care not to glorify actually disruptive behavior.',
  'There have been real cases of this leading to noise and thrown objects disrupting actual screenings, so it shouldn''t be imitated.',
  array['치킨 조키','Chicken Jockey','치킨조키 밈'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 9/20  9pfn5dqh  meme_id=eb89c5cc-3d9c-4f9a-ab5c-9d14381d57a6  나는 SOLO 영자·영수 커플
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'eb89c5cc-3d9c-4f9a-ab5c-9d14381d57a6',
  'en',
  'i-am-solo-yeongja-yeongsu-couple',
  'I Am Solo: The Yeongja-Yeongsu Couple',
  'The Yeongja-Yeongsu couple is the final pairing from season 1 of SBS Plus dating show I Am Solo, whose story became widely talked about.',
  'When I Am Solo first aired in 2021, the distinct personalities of its cast -- including a dance battle between Hyeon-sook and Yeongja over Yeong-cheol -- drew a lot of attention. Yeongja and Yeongsu, who ended up the final couple, kept dating afterward, but their breakup was reportedly rocky, which kept them in the spotlight even off-screen.',
  'SBS Plus dating reality show I Am Solo, season 1 (aired 2021).',
  'Good to bring up when discussing an early, influential example of dating reality TV.',
  'Involves real people''s private lives, so it should be discussed with care.',
  array['Yeongja-Yeongsu Couple','I Am Solo Season 1','나는 SOLO 영자·영수 커플'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 10/20  xh2f24uz  meme_id=a2c408c1-573a-4cfc-8398-b8e71a643d52  홍명보 나가
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'a2c408c1-573a-4cfc-8398-b8e71a643d52',
  'en',
  'hong-myung-bo-get-out',
  'Hong Myung-bo, Get Out!',
  '''Hong Myung-bo, Get Out!'' is a mocking chant directed at national team manager Hong Myung-bo after Korea''s 2026 World Cup group-stage exit.',
  'After Korea was eliminated in the group stage of the 2026 World Cup in June 2026, a clip of former national goalkeeper Kim Young-kwang shouting ''Hong Myung-bo, get out!'' at the airport went viral and turned into a catchphrase. Angry football fans chanted the same line when the manager returned home, and it spread across social media and online communities. The meme carries a strong current of criticism directed at the manager personally.',
  'Started from Kim Young-kwang''s airport remarks after Korea''s group-stage exit at the 2026 World Cup.',
  'Used in sports news and football communities in the context of criticizing a manager.',
  'Directed at a specific individual, so excessive mockery should be avoided.',
  array['홍명보 나가!','감독 나가 챌린지','홍명보 나가'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 11/20  rvur5fbp  meme_id=1515a4cd-d7e0-43b3-8f31-4618cf97525c  나락퀴즈쇼
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '1515a4cd-d7e0-43b3-8f31-4618cf97525c',
  'en',
  'narak-quiz-show',
  'Narak Quiz Show',
  'Narak Quiz Show is a popular 2023 segment from the YouTube channel Pissikdaehak that puts celebrity guests on the spot with awkward questions.',
  'YouTube channel Pissikdaehak''s ''Narak Quiz Show'' put guests in an uncomfortable spot with questions about sensitive topics like politics, history, and personal life, and it became a major hit in 2023. Much of its popularity came from getting celebrities to bluntly say things they''d normally avoid saying in public, and the word ''narak'' (''the abyss,'' i.e., a tough spot) itself caught on as slang for an awkward situation.',
  'A segment called ''Narak Quiz Show'' on the YouTube channel Pissikdaehak (2023).',
  'Used jokingly to point at an awkward question or situation.',
  'The format deals with sensitive questions about politics and private life, so it can lead into contentious territory.',
  array['Pissikdaehak Narak Quiz Show','나락퀴즈쇼'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 12/20  tebxgauf  meme_id=eabf51de-9d82-4aec-a329-d487ce1f1696  관짝소년단
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'eabf51de-9d82-4aec-a329-d487ce1f1696',
  'en',
  'coffin-dance',
  'Coffin Dance',
  'Coffin Dance is a meme that overlays footage of Ghanaian coffin-carrying dancers onto accident or blooper clips for comic effect.',
  'Footage of Ghana''s coffin-dancing funeral tradition set to the music ''Astronomia,'' spliced onto clips of accidents, first appeared on TikTok in February 2020 and spread worldwide. In Korea it picked up the nickname ''Gwanjjak Sonyeondan'' (''Coffin Boy Band''), a play on BTS''s name, and became a go-to meme spliced onto any near-miss or blunder.',
  'Started from a Ghanaian funeral coffin-dance video edited over footage, posted to TikTok on February 26, 2020; in Korea, online communities dubbed it ''Gwanjjak Sonyeondan.''',
  'Used as a punchline right before someone is about to have an accident.',
  'Avoid splicing it into footage of real, sensitive incidents like actual deaths.',
  array['코핀댄스','관짝춤','Coffin Dance','관짝소년단'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 13/20  5g42bsqk  meme_id=0d0b8b2a-7002-420d-ab0b-437c765359f7  이 아이가 배가 부르다는 느낌을 알까요
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '0d0b8b2a-7002-420d-ab0b-437c765359f7',
  'en',
  'does-this-child-know-what-being-full-feels-like',
  'Does This Child Know What Being Full Feels Like?',
  '''Does this child know what being full feels like?'' is a UNICEF child-hunger PSA line that got repurposed as bait for mukbang donation pranks.',
  'A UNICEF public-service ad about child hunger was frequently used as guilt-tripping bait-donation clips sent to streamers who left food unfinished during mukbang broadcasts. It''s a case where a serious public-interest message ended up being consumed fairly heavily inside the more lighthearted culture of Twitch donations.',
  'Use of a UNICEF PSA video as a Twitch donation clip (roughly 2017-2019).',
  'Brought up jokingly to guilt-trip a streamer who leaves food behind during a mukbang.',
  'Since it''s a PSA about a real hunger crisis, take care not to treat the subject too lightly.',
  array['유니세프 밈','이 아이가 배가 부르다는 느낌을 알까요'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 14/20  vcwrvwrb  meme_id=f6d26ea5-b1e7-4b10-84f8-b983071aa032  핵불닭볶음면 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f6d26ea5-b1e7-4b10-84f8-b983071aa032',
  'en',
  'nuclear-fire-noodle-challenge',
  'Nuclear Fire Noodle Challenge',
  'The Nuclear Fire Noodle Challenge is a spicy-food trend built around Samyang''s limited-edition instant noodles, hotter than the original Buldak.',
  'Samyang Foods released a limited-edition ''Nuclear Buldak Bokkeummyeon,'' spicier than its original fire noodles, in January 2017 to mark the Year of the Red Rooster. It sold more than 8 million packs within two months, and YouTubers filming themselves eating it fueled a ''Fire Noodle Challenge'' trend both in Korea and abroad. Production was discontinued in late April 2017, briefly turning it into a hard-to-find item.',
  'Samyang Foods'' limited-edition Nuclear Buldak Bokkeummyeon launch (January 2017).',
  'Can be brought up casually as a spicy-food-challenge reference.',
  'Actually attempting extremely spicy-food challenges is not recommended due to health risks like stomach issues.',
  array['Fire Noodle Challenge','핵불닭','불닭볶음면 챌린지','핵불닭볶음면 챌린지'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 15/20  f4hfy2ta  meme_id=40194b9d-bfa1-4ed9-9314-7b4fc6e65167  마이야히
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '40194b9d-bfa1-4ed9-9314-7b4fc6e65167',
  'en',
  'mayahi',
  'Mayahi',
  'Mayahi is a Korean meme format that sets footage or a face to the ''ma ya hi'' intro hook of Moldovan group O-Zone''s 2003 hit, which went viral again in Korea in 2021.',
  'The meme uses the ''ma ya hi'' opening hook from O-Zone''s 2003 track ''Dragostea Din Tei,'' set to edited footage or someone''s face. It went viral in Korea in April 2021, and many of the parody videos targeted celebrities who were embroiled in controversy at the time.',
  'The Moldovan group O-Zone''s 2003 release; the video-editing trend went viral in Korea in April 2021.',
  'Good for exaggerating a situation with the catchy hook.',
  'Often used to mock people caught up in controversy, so caution is needed depending on the target.',
  array['마이야히 밈','Dragostea Din Tei Meme','마이야히'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 16/20  2fdk75yd  meme_id=fc516a37-351a-4308-b11d-a1ce49ae1bec  응 아니야 (철구)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fc516a37-351a-4308-b11d-a1ce49ae1bec',
  'en',
  'eung-aniya-cheolgu',
  '''Eung Aniya'' (Cheolgu)',
  '''Eung aniya'' (''Yeah, no'') is a retort catchphrase used by streamer Cheolgu and others, which spun off into several variants.',
  '''Eung aniya'' is a phrase used to lightly deny or tease what someone just said; it took hold through the mutual influence of Afreeca TV streamers (BJs) Cheolgu and Sin Tae-il during the period they broadcast together. Some say streamer Puwo used the phrase even earlier, before Cheolgu. It spun off into variants like ''eung niaemi'' and ''eung neugeumma,'' becoming one strand of the era''s teen slang.',
  'Used on broadcasts by Afreeca TV streamers Cheolgu, Sin Tae-il, and Puwo, among others.',
  'Used to playfully push back on something, though variants aimed at someone''s parents can come across as rude.',
  'Variants like ''eung niaemi,'' which target someone''s parents, can amount to a crude insult about family.',
  array['응 니애미','응 아니야 철구'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 17/20  mzhfgwh2  meme_id=8fb09d4a-2492-451e-8a2c-0e8641503d0a  보이루 여성혐오 논란
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8fb09d4a-2492-451e-8a2c-0e8641503d0a',
  'en',
  'boiru-misogyny-controversy',
  'The ''Boiru'' Misogyny Controversy',
  'The Boiru misogyny controversy was a backlash claiming, without basis, that YouTuber BoGyeom''s greeting ''Boiru'' was a misogynistic term.',
  'YouTuber BoGyeom coined the greeting ''Boiru'' by blending his own nickname with ''hairu'' (a casual ''hi''), but starting in early 2018 some online communities pushed a forced reinterpretation of the word as a vulgar, misogynistic phrase and branded BoGyeom a misogynist. Critics pointed out that no controversy arose when other broadcasters used the same greeting, and courts later ruled in BoGyeom''s favor.',
  'Controversy over YouTuber BoGyeom''s greeting ''Boiru'' (2018).',
  'Mention only when explaining how the controversy unfolded; the greeting itself is neutral.',
  'A sensitive case tangled up with gender conflict, so explain the facts carefully.',
  array['보이루 논란','보이루 여성혐오 논란'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 18/20  wwvqat4n  meme_id=475a56b9-0832-49b5-9b6d-10aeb0027151  화성인 바이러스
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '475a56b9-0832-49b5-9b6d-10aeb0027151',
  'en',
  'martian-virus',
  'Martian Virus',
  'Martian Virus was a 2009 tvN talk show that featured ordinary people with unusual lifestyles.',
  'A talk show that began on tvN in March 2009, spotlighting ordinary people nicknamed ''Martians'' for their unusual lifestyles; it coined slang like ''sipdeokhu'' (''super-otaku'') and became one of tvN''s flagship programs in its early years.',
  'A tvN talk show that aired from March 31, 2009 to 2013, airing footage covering people with unconventional lifestyles dubbed ''Martians,'' followed by studio discussion hosted by figures including Lee Kyung-kyu and Kim Gu-ra. Its provocative subject matter and sensational editing made it a symbol of tvN''s edgy early image, and disputes over the authenticity of some guests'' private lives or backgrounds repeatedly flared up in online communities.',
  'Brought up when discussing late-2000s cable variety show trends.',
  'Take care not to treat the ordinary people featured on the show as objects of ridicule.',
  array[]::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 19/20  qnpmy8rf  meme_id=12914e50-ea2f-41b7-a03b-2a2adb707975  후드에서 살아남기
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '12914e50-ea2f-41b7-a03b-2a2adb707975',
  'en',
  'surviving-in-the-hood',
  'Surviving in the Hood',
  'Surviving in the Hood is a comedy series from a YouTube channel that imitates Black American ''hood'' culture.',
  'Starting with a shorts video titled ''Surviving in the Hood, Chapter 1'' posted by the YouTube channel Hipeul Meme in April 2022, content exaggeratedly imitating everyday life in Black American ''hood'' culture caught on as a meme. Its legalese-style ''Chapter N'' titles and distinctive speech patterns became widely quoted, even in YouTube comment sections, giving it outsized influence.',
  'The YouTube channel Hipeul Meme''s shorts series ''Surviving in the Hood'' (April 2022).',
  'Used when talking about an exaggerated, hip-hop-flavored comedy skit.',
  'Since it exaggeratedly imitates a specific culture, some critics say it trades in racial stereotypes.',
  array['후드 밈','후드에서 살아남기'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- 20/20  bbv77z46  meme_id=77c210a2-bd8a-480d-b505-a97b2c9b1585  KBO AI 직캠 트렌드
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '77c210a2-bd8a-480d-b505-a97b2c9b1585',
  'en',
  'kbo-ai-fancam-trend',
  'KBO AI Fancam Trend',
  'The KBO AI Fancam Trend uses generative AI to make it look like the creator is sitting in the stands at a Korean baseball game.',
  'This trend uses generative AI video tools to create footage that makes it look like the creator is in the crowd at a KBO baseball broadcast. It kicked off in May 2026 when a video posted by an X user titled ''An Average Korean Woman'' surpassed 15 million views, and it later expanded to basketball, soccer, and concert footage. A key feature is that it recreates, via AI, the real KBO broadcast tradition of cutting to attractive spectators in the stands.',
  'An AI-composited video trend that started on X (Twitter) in May 2026.',
  'Used casually as playful AI-video content.',
  'Because the composited footage can look like a real person, there''s potential for misidentification or portrait-rights issues.',
  array['한국 야구 AI 밈','Korean Baseball AI Trend'],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00',
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
)
on conflict (meme_id, locale) do nothing;

-- === Self-promotion: mark this slice's own rows reviewed (idempotent, freshness-guarded) ===
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
  '94bf8fcf-41da-48de-af30-e56df39a1b19',
  '2401aaa8-e175-4c94-8df9-1aa8b2c9aff7',
  '8c96f19e-158b-4f55-8af7-bdc1c81bf9d4',
  '6fd9a595-840f-4222-bae3-f1355bb40095',
  '9172697b-8576-417c-bbe6-65860fa422c4',
  '041f6c84-a8fe-4d55-a967-8bf4e95f4a89',
  '6a52ac23-0bd0-453e-924a-e6dd9b669c29',
  '554414dd-68eb-4a9c-8941-875665bb03e1',
  'eb89c5cc-3d9c-4f9a-ab5c-9d14381d57a6',
  'a2c408c1-573a-4cfc-8398-b8e71a643d52',
  '1515a4cd-d7e0-43b3-8f31-4618cf97525c',
  'eabf51de-9d82-4aec-a329-d487ce1f1696',
  '0d0b8b2a-7002-420d-ab0b-437c765359f7',
  'f6d26ea5-b1e7-4b10-84f8-b983071aa032',
  '40194b9d-bfa1-4ed9-9314-7b4fc6e65167',
  'fc516a37-351a-4308-b11d-a1ce49ae1bec',
  '8fb09d4a-2492-451e-8a2c-0e8641503d0a',
  '475a56b9-0832-49b5-9b6d-10aeb0027151',
  '12914e50-ea2f-41b7-a03b-2a2adb707975',
  '77c210a2-bd8a-480d-b505-a97b2c9b1585'
  );

-- === Verification: reviewed row status for this slice's 20 meme_ids ===
select t.meme_id, t.locale, t.status, t.reviewed_at, t.reviewed_by
from public.meme_translations t
where t.locale = 'en'
  and t.meme_id in (
  '94bf8fcf-41da-48de-af30-e56df39a1b19',
  '2401aaa8-e175-4c94-8df9-1aa8b2c9aff7',
  '8c96f19e-158b-4f55-8af7-bdc1c81bf9d4',
  '6fd9a595-840f-4222-bae3-f1355bb40095',
  '9172697b-8576-417c-bbe6-65860fa422c4',
  '041f6c84-a8fe-4d55-a967-8bf4e95f4a89',
  '6a52ac23-0bd0-453e-924a-e6dd9b669c29',
  '554414dd-68eb-4a9c-8941-875665bb03e1',
  'eb89c5cc-3d9c-4f9a-ab5c-9d14381d57a6',
  'a2c408c1-573a-4cfc-8398-b8e71a643d52',
  '1515a4cd-d7e0-43b3-8f31-4618cf97525c',
  'eabf51de-9d82-4aec-a329-d487ce1f1696',
  '0d0b8b2a-7002-420d-ab0b-437c765359f7',
  'f6d26ea5-b1e7-4b10-84f8-b983071aa032',
  '40194b9d-bfa1-4ed9-9314-7b4fc6e65167',
  'fc516a37-351a-4308-b11d-a1ce49ae1bec',
  '8fb09d4a-2492-451e-8a2c-0e8641503d0a',
  '475a56b9-0832-49b5-9b6d-10aeb0027151',
  '12914e50-ea2f-41b7-a03b-2a2adb707975',
  '77c210a2-bd8a-480d-b505-a97b2c9b1585'
  )
order by t.meme_id;
