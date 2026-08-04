-- EN meme_translations batch -- loop-049, generated 2026-08-04.
-- Source: Claude (this conversation) -- hand-translated, not machine-pipeline-generated.
-- Candidates: top 25 by trend_score among approved/limited public memes with no
-- existing 'en' row, fetched via production anon REST (memes + meme_translations).
-- Excluded: 5 meme_ids visible to anon via meme_translations?locale=eq.en, plus all
-- 18 meme_ids named in artifacts/renewal/loop-048/en-translations-top20.sql's
-- per-statement comments (treated as already-applied even though their status='machine'
-- rows aren't yet visible under the reviewed-only public RLS policy).
--
-- Format: plain SQL only (no base64/jsonb_to_record). Each statement is a standalone
-- 'insert ... on conflict (meme_id, locale) do nothing' -- idempotent, safe to re-run,
-- but UNLIKE loop-048 it does NOT re-check that the source Korean row is unchanged
-- (no 'locked' CTE / snapshot-hash guard). If a meme's Korean content changed since
-- this file was generated (source_updated_at != current memes.updated_at), applying
-- this row will NOT be blocked -- verify before applying if content may have drifted.
--
-- status is inserted as 'machine' (matches the DB check constraint and
-- mark_meme_translations_stale() invariant: reviewed_at/reviewed_by must both be
-- null unless status='reviewed'). A human must review and flip status to 'reviewed'
-- (with reviewed_at/reviewed_by set) before meme_translations_public_read RLS will
-- serve these rows to anon.
--
-- caution is inserted as null for all 25 rows per explicit batch instruction, even
-- where the Korean source has a non-null caution (e.g. ay8znvqu/fmbbud58 has one) --
-- caution translation was out of scope for this pass.
--
-- Statements are grouped 2-per-block below for independent orchestrator dispatch.
-- 25 statements total => 13 blocks (12 pairs + 1 single, block 13).


-- === BLOCK 1 ===
-- 3bv6kw7c  trend_score=354.500784535496  꼬셔야겠어 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8908356c-996f-46b1-ad9d-2782e641dcd5',
  'en',
  'pick-you-up-challenge',
  'Pick You Up Challenge',
  'The Pick You Up Challenge is a dance and lip-sync trend set to the chorus of rapper Minoi''s song "Pick You Up."',
  'The challenge has participants strike confident, flirtatious poses along with the hook of "Pick You Up," the track that gave the challenge its name. Both dance and lip-sync versions circulated on TikTok between February and March 2026.',
  'Minoi released "Pick You Up" in July 2024 on her second full album, This Is My Life; the song began being used as challenge audio on TikTok around February 2026.',
  'Used playfully to project confidence while showing off one''s charm.',
  null,
  array['Kkosyeoyagesseo Challenge','Minoi Kkosyeoyagesseo','Pick You Up Challenge'],
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

-- nrk9ryzn  trend_score=354.230679459838  찹츄찹찹츄
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'b2fea6be-63a7-48aa-988d-86dbefb0650d',
  'en',
  'chapchyu-chapchapchyu',
  'Chapchyu Chapchapchyu',
  'Chapchyu Chapchapchyu is a mondegreen -- Korean listeners hear the chorus of a Chinese indie band''s song as this nonsense phrase, and it went viral as background audio for pet videos.',
  'The chorus of "Qiu Qiu" (丘丘) by Chinese indie band Huichundan (回春丹) sounds to Korean ears like "chapchyu chapchapchyu," and the phrase caught on as background music for videos of pets -- especially golden retrievers -- eating or doing cute things. The mishearing also spawned the nickname "Chapchyu-river" for retrievers.',
  'The song appeared on Huichundan''s February 2023 album Micheong (蜜虫) and went rapidly viral as background audio on Korean Reels, Shorts, and TikTok in early 2026.',
  'Used as background audio for cute or rhythmically repetitive pet/animal clips.',
  null,
  array['Qiu Qiu Meme','Chapchu Chapchapchu','Chapchyu-river'],
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

-- === BLOCK 2 ===
-- a3m443m3  trend_score=346.713865399863  소개팅 상황극
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '3ab36237-b6a8-417e-80ed-ae5005e008ca',
  'en',
  'blind-date-skit',
  'Blind Date Skit',
  'The Blind Date Skit is a short-form comedy format that re-enacts absurd things that happen on blind dates.',
  'Creators comically re-enact meeting a date who behaves strangely, often building to a twist that turns the story surprisingly touching. The format spread through dating-story ("yeonae-sseol") accounts that specialize in retelling dating anecdotes.',
  'Spread from dating-story accounts such as Sseolteojim that specialize in retelling blind-date anecdotes.',
  'Cited when recounting an absurd experience from a blind date.',
  null,
  array['Sogaeting Sanghwanggeuk','Sogaeting-sseol'],
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

-- uefmryky  trend_score=344.412408820248  자기 직업 불법적으로 말하기
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '758cef01-7f96-4fd5-87e3-2387b8e7dda6',
  'en',
  'describe-your-job-like-its-illegal',
  'Describe Your Job Like It''s Illegal',
  'This meme means describing an ordinary job in language that makes it sound like a crime -- for example, calling a flight attendant "someone who locks people in a metal tube and watches over them tens of thousands of feet in the air."',
  'The humor comes from the fact that every detail is technically true; only the framing makes it sound criminal. It''s a Korean adaptation of the English-language "Badly Explain Your Profession" meme, which was translated and spread on Threads, Reels, and Shorts around May 2026, popularized domestically by Instagram accounts like @choeeunsu and @baechuu.',
  'Adapted from the English-language "Badly Explain Your Profession" meme format, which took off in Korea around May 2026.',
  'Used to introduce one''s job with a comedic, ominous-sounding twist.',
  null,
  array['Jagi Jigeop Bulbeopjeogeuro Malhagi','Nae Jigeop Bulbeopjeogeuro Malhaebogi'],
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

-- === BLOCK 3 ===
-- 2nxbqxqq  trend_score=343.663638872134  얼음 뮤지컬 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd494f475-6a0c-405c-924b-2f5e4a775b7c',
  'en',
  'freeze-musical-remix',
  'Freeze! Musical Remix',
  'The Freeze! Musical Remix means a musical-style remix that YouTuber Jeffp built around Seong Gi-hun''s "Freeze!" ("eoreum") line from Squid Game season 2.',
  'In January 2025, YouTuber Jeffp released a remix video that set actor Lee Jung-jae''s "Freeze!" line, delivered by his character Seong Gi-hun in Squid Game season 2, to an addictive musical-theater-style melody. The video topped three million views and is widely credited as one of the memes that kicked off 2025''s meme trends.',
  'Originated from YouTuber Jeffp''s remix video of a Squid Game season 2 line.',
  'Cited as an example of a drama-line remix meme.',
  null,
  array['Eoreum Musical Challenge','Eoreum (Jeffp)','Seong Gi-hun Freeze'],
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

-- v6de3tbs  trend_score=341.525470270601  거제 야호
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '4be8ec7d-0540-4750-8a1c-90375bd5b9ea',
  'en',
  'geoje-yaho',
  'Geoje Yaho',
  'Geoje Yaho means shouting a place name before the cheerful exclamation "yaho" for a jarringly upbeat, out-of-nowhere reaction.',
  'During a visit to Geoje Island on member Woni''s travel YouTube channel, Risenneu member Minami suddenly shouted "Geoje yaho-!," and Woni''s baffled reaction became the clip that spread. Geoje City''s official social media accounts responded to the buzz, and all of Risenneu''s members were later appointed honorary ambassadors for the city -- turning the meme into a real piece of local tourism marketing.',
  'Originated on a Geoje Island travel episode of Risenneu member Woni''s YouTube channel.',
  'Used as a cheerful greeting by swapping in a place name or someone''s name before "yaho."',
  null,
  array['Geoje Yaho Meme','Geojeyaho'],
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

-- === BLOCK 4 ===
-- fqs3t9wg  trend_score=338.118461427655  류승룡 기모찌!(오버워치)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '634b5127-f0f8-4789-bde7-8a4e4e3042da',
  'en',
  'ryu-seung-ryong-kimochi-overwatch',
  'Ryu Seung-ryong Kimochi! (Overwatch)',
  'This Overwatch meme means mishearing Genji''s ultimate voice line as sounding like the name of actor Ryu Seung-ryong plus the Japanese word "kimochi."',
  'Genji''s Japanese ultimate line, "Ryujin no ken o kurae" ("Take the blade of the dragon"), gets shouted so fast in the heat of battle that players joke it sounds like "Ryu Seung-ryong kimochi," and the mishearing turned into a running gag among Overwatch players.',
  'A mondegreen of Genji''s Japanese ultimate voice line in Overwatch.',
  'Used to parody the sound of Genji''s ultimate in Overwatch.',
  null,
  array['Ryu Seung-ryong Gimochi','Kimochi'],
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

-- ap3vk283  trend_score=336.395329763285  낉여오거라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '06f17cd7-f14e-4505-8864-8d6dc071f1a2',
  'en',
  'boil-it-and-bring-it',
  'Boil It and Bring It',
  'This meme means playfully, imperiously demanding that someone bring you what you want -- "boil it and bring it."',
  'The phrase is a deliberately garbled, funny misspelling of "kkeuryeo-ogeora" ("boil it and bring it"). It started with a fan-edited photo of NCT WISH''s Yushi professing his love of ramyeon, then spread beyond the fandom through a dog-themed version. It became popular in 2025 and was applied to a wide range of situations.',
  'Originated from a fan-edited photo of NCT WISH''s Yushi.',
  'Used to jokingly demand something in a playful, bossy tone.',
  null,
  array['Kkeuryeo-ogeora','Kkeuryeo-ogeora Meme'],
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

-- === BLOCK 5 ===
-- jxj74cyd  trend_score=334.861437214911  악동뮤지션 K팝스타2 우승
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8ca5b4db-2cbf-4181-bd50-a9365b7ffacf',
  'en',
  'akmu-wins-kpop-star-season-2',
  'AKMU Wins K-pop Star Season 2',
  'This refers to AKMU (Akdong Musician), a teenage sibling singer-songwriter duo, becoming the first act of its kind to win a Korean audition show.',
  'On SBS''s K-pop Star Season 2 in 2013, sibling duo AKMU won the competition on the strength of original songs like "Dali Kkojima" and "Crescendo." Their victory marked the first time a teenage singer-songwriter act had won a major Korean audition program.',
  'The SBS K-pop Star Season 2 finale, aired in April 2013.',
  'Referenced when discussing audition shows or original-song competitions.',
  null,
  array['Akdong Musician K-pop Star 2 Win','Lee Chan-hyuk Lee Su-hyun'],
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

-- ukjwwvde  trend_score=333.515548268426  12-3-30 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'c13a179c-67ce-4a83-809d-4a3614616cf4',
  'en',
  '12-3-30-challenge',
  '12-3-30 Challenge',
  'The 12-3-30 Challenge means walking on a treadmill set to a 12% incline at 3 miles per hour for 30 minutes.',
  'Instead of running, the routine uses low-intensity incline walking to raise the heart rate for fat loss while targeting the lower body and core, and it''s a recurring staple of diet-progress short-form videos. American influencer Lauren Giraldo first posted the routine on YouTube in 2019, then it exploded after she reposted it on TikTok in November 2020.',
  'First shared by American influencer Lauren Giraldo on YouTube in 2019, going viral after a November 2020 TikTok repost.',
  'Mentioned when introducing a diet or cardio routine, e.g. "doing the 12-3-30."',
  null,
  array['12-3-30 Treadmill Challenge','12330 Challenge'],
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

-- === BLOCK 6 ===
-- f8vys3hv  trend_score=333.515548268426  SK텔레콤 되고송
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'a6478781-ef94-43ce-bcfd-8305eed481af',
  'en',
  'sk-telecom-doego-song',
  'SK Telecom''s Doego Song',
  'SK Telecom''s "Doego Song" ("it''ll all come true" song) was a 2008 ad jingle built around a chant of positive affirmations.',
  'In 2008, SK Telecom ran an ad campaign featuring actor Jang Dong-gun and singer Jung Ji-hoon chanting a jingle of positive affirmations built around the word "doego" ("[it''ll] come true"). An Olympic-themed version sung by Epik High, timed to the Beijing Olympics, was popular alongside it. With its easy-to-follow melody, the campaign is often cited as an early example of spreading a culture of positive self-affirmation through advertising.',
  'A 2008 SK Telecom TV commercial starring Jang Dong-gun and Jung Ji-hoon.',
  'Quoted sing-song style to affirm that something positive will come true.',
  null,
  array['Doego Song','Jang Dong-gun Jung Ji-hoon Doego Song'],
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

-- d8kf6t9w  trend_score=330.850152318805  샤갈
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '9e8beb59-6d0c-4d56-87c2-ca41f03927b0',
  'en',
  'syagal',
  'Syagal',
  'Syagal is a YouTube-born catchphrase used as an exclamation for absurd or exasperating situations.',
  'The word started as a verbal tic frequently used by creator Yeoru on the YouTube channel Yeodano, and it spread among viewers as a meme used to react to ridiculous or annoying moments. It caught on quickly through YouTube Shorts, Reels, and comment sections.',
  'Originated as a verbal tic on the YouTube channel Yeodano.',
  'Used as an exclamation in absurd or irritating situations.',
  null,
  array['Ssyagal'],
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

-- === BLOCK 7 ===
-- x5ufdj3c  trend_score=329.121099113754  파라파라나 춰야겠다
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '06450042-a640-43f2-aadd-02b54bd0614d',
  'en',
  'guess-ill-just-dance-para-para',
  'Guess I''ll Just Dance Para Para',
  'This line means playfully dodging an awkward situation instead of dealing with it -- literally, "guess I''ll just dance para para."',
  'The phrase comes from a moment in a Geoje Island travel video where Risenneu''s Minami, in gyaru makeup, suddenly started dancing to the Japanese retro dance style "para para" with no music. The line caught on as a meme for the relatable, cutely evasive feeling of saying, essentially, "I don''t know, guess I''ll just dance para para" whenever things get awkward.',
  'From the "gyaru corner" segment featuring Minami on Risenneu member Woni''s Geoje Island travel content on YouTube.',
  'Used to laughingly dodge an awkward or unwanted situation.',
  null,
  array['Para Para Meme','Para Parana Chwoyagetda'],
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

-- kkz7run4  trend_score=328.649966971128  보아 - No.1
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '83bbcc87-db0d-41bb-aa3b-8d62bae0b07a',
  'en',
  'boa-no1',
  'BoA - No.1',
  'BoA''s "No.1" is a 2002 Eurodance hit that expresses her ambition to become the world''s best singer.',
  'Released in April 2002 as the title track of BoA''s second full album, the song pairs a bright Eurodance sound with lyrics about aspiring to become the world''s top singer. It sold over 500,000 copies that year and cemented BoA''s status as a leading idol of the era.',
  'Released in April 2002 as the title track of BoA''s second full studio album.',
  'Brought up when discussing the peak era of early-2000s solo idols.',
  null,
  array['BoA No.1','BoA Second Album Title Track'],
  '[{"situation": "Reunion with old classmates", "text": "You can''t talk about the early 2000s without BoA''s No.1 -- I really thought she was about to take over the world back then."}, {"situation": "SNS comment", "text": "Listening to BoA''s No.1 again, that early-2000s Eurodance vibe was insane."}]'::jsonb,
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

-- === BLOCK 8 ===
-- sejp2dtf  trend_score=327.757392765871  야르
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '78211f0f-3f29-4fa8-aeb5-fcec2a9483ca',
  'en',
  'yareu',
  'Yareu',
  'Yareu is a coined exclamation for feeling good, used as the cheerful counterpart to the meme "syagal."',
  'It''s used to mean something like "nice," "awesome," or "yay," and according to online meme trend reports, it pairs so consistently with syagal that people describe the formula as "syagal when you''re annoyed, yareu when you''re happy."',
  'A coined YouTube- and social-media-born exclamation that pairs with syagal.',
  'Used as an exclamation in happy or upbeat moments.',
  null,
  array['Yaleu'],
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

-- 5dqfn236  trend_score=327.07779661869  카라 미스터 엉덩이춤
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '15b6a625-1319-44aa-9791-db3300507166',
  'en',
  'kara-mister-hip-dance',
  'KARA''s Mister Hip Dance',
  'KARA''s "Mister Hip Dance" refers to the hip-rolling choreography from KARA''s song "Mister" that became a full-blown dance craze.',
  '"Mister" was originally a B-side on KARA''s 2009 release, but choreographer Bae Yoon-jung''s hip-rolling move became a huge hit right after its first TV performance, drawing more attention than the actual title track. Netizens nicknamed it the "hip dance," and it became popular enough to be covered as a social phenomenon in Japan as well.',
  'Choreography for DSP Media girl group KARA''s "Mister" (2009), created by Bae Yoon-jung.',
  'Recalled when discussing the point-choreography trend among 2009-era girl groups.',
  null,
  array['Mister Hip Roll Dance','Kara Mister Eongdeongi-chum'],
  '[{"situation": "KakaoTalk", "text": "This choreography is as addictive as KARA''s Mister hip dance."}, {"situation": "SNS comment", "text": "The Mister choreography was a genuine sensation back then."}]'::jsonb,
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

-- === BLOCK 9 ===
-- pmdqedqp  trend_score=327.07779661869  에휴에요 에휴
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '87b53438-1535-4c84-837b-80ae64cb4f8b',
  'en',
  'eyu-eyo-eyu',
  'Eyu-eyo Eyu',
  'Eyu-eyo Eyu means a half-formal sigh of exasperation coined by VTuber Fuya of StelLive, used for embarrassing moments.',
  'The phrase comes from StelLive VTuber Sakihane Fuya, who used this signature half-polite sigh to lament viewers'' teasing jokes early in her debut stream. It became her signature catchphrase and was later turned into an official emote.',
  'Originated on StelLive VTuber Fuya''s debut stream.',
  'Used to sigh dramatically over an embarrassing or pathetic situation.',
  null,
  array['Eyu-eyo','ㅇㅎㅇㅇㅎ'],
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

-- s64tpdwu  trend_score=327.028106538696  고마해라 마이 묵었다 아이가
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'b322f070-fac9-4705-af25-1d16a6f5a79d',
  'en',
  'gomahaera-mai-mugeotda-aiga',
  'Gomahaera, Mai Mugeotda Aiga',
  'This means the iconic Gyeongsang-dialect line "That''s enough, you''ve eaten plenty already" from the 2001 film Friend.',
  'The line comes from a confrontation scene between rival gangsters, delivered in thick regional dialect with a distinctive sing-song rhythm that made it a favorite for comedy impressions and parodies.',
  'From the 2001 Korean film Friend.',
  'Still cited today as material for parodies and impressions.',
  null,
  array['Gomahaera','That''s Enough, You''ve Eaten Plenty'],
  '[{"situation": "KakaoTalk", "text": "That''s enough, you''ve eaten plenty already, lol"}, {"situation": "SNS comment", "text": "People still do impressions of this line all the time."}]'::jsonb,
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

-- === BLOCK 10 ===
-- mn3smqqr  trend_score=327.028106538696  쥐롤라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'eb41ea64-cb26-48b9-ae6a-264fa8dcbda5',
  'en',
  'jwi-rola',
  'Jwi-rola',
  'Jwi-rola is the nickname comedian Lee Chang-ho earned after his cover of a Kinky Boots musical number went viral on YouTube.',
  'In August 2024, on the musical-parody segment of the YouTube channel Ppangsongguk, Lee Chang-ho (Lee Ho-gwang) covered "Land of Lola" from the musical Kinky Boots; because he resembled a mouse ("jwi"), viewers nicknamed him "Jwi-rola," and a version with taekwondo moves added earned him the nickname "Taekwon-rola." The video passed five million views in about four weeks, and it drew even people with no prior interest in musicals into theaters, contributing to a sold-out 10th-anniversary run of Kinky Boots.',
  'From a musical-cover segment on the YouTube channel Ppangsongguk.',
  'Cited as an example of a meme born from a comedian''s YouTube content.',
  null,
  array['Taekwon-rola','Lee Ho-gwang Rola'],
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

-- fmbbud58  trend_score=326.135532333439  트랄랄레로 트랄랄라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f9da7a03-01de-42c3-8e1c-c05af1fccf6b',
  'en',
  'tralalero-tralala',
  'Tralalero Tralala',
  'Tralalero Tralala is an Italian-language nonsense meme starring a three-legged shark wearing Nike sneakers.',
  'It debuted on TikTok in January 2025 as the first of the "Italian brainrot" characters -- low-quality AI-generated videos paired with meaningless Italian-sounding lyrics. It''s usually paired with "Bombardiro Crocodilo," a character combining a bomber plane and a crocodile, and the pair went global in March 2025, spawning a wave of parodies on Korean Reels and Shorts as well.',
  'Originated from an AI-generated video posted by a TikTok user, going globally viral in March 2025.',
  'Referenced when discussing AI memes or "Italian brainrot" content.',
  null,
  array['Tralalero-Tralala','Italian Brainrot','Titititi'],
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

-- === BLOCK 11 ===
-- javpvzxr  trend_score=325.601406762941  시추에이션십(Situationship)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'ffa80a30-36b5-4fb8-a1e0-599d2e902625',
  'en',
  'situationship',
  'Situationship',
  'A situationship means an ambiguous relationship that has romantic and physical intimacy without being an official couple.',
  'It describes a relationship where two people share emotional and physical closeness without formally dating. It went viral on TikTok through content formats like "texts with my situationship." The term itself was coined in the 2010s, but TikTok is what turned it into a mainstream buzzword.',
  'Coined in the 2010s; became mainstream through TikTok content in 2023.',
  'Used to describe an undefined, ambiguous romantic relationship.',
  null,
  array['Sichueisyeonsip'],
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

-- u4b43yer  trend_score=324.984804043632  어디출신 미시시피
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fd84e47d-f496-4ed8-bd18-1fdc9e9e979b',
  'en',
  'where-are-you-from-mississippi',
  'Where Are You From? Mississippi!',
  'This meme means parodying the ventriloquist-dummy dialogue from the musical Chicago''s number "We Both Reached for the Gun."',
  'In the original scene, a reporter asks, "Where are you from?" and the character answers "Mississippi!" then "Your parents?" is answered with "Filthy rich!" -- the exchange has become a short-form-video parody format. It went viral alongside a June 2025 revival of Chicago in Korea and is credited with helping boost ticket sales.',
  'Originated from the ventriloquist number in the musical Chicago.',
  'Used when parodying musical-theater memes.',
  null,
  array['Chicago Ventriloquist Meme','Eodichulsin Mississippi'],
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

-- === BLOCK 12 ===
-- upktm4ve  trend_score=324.255517816456  1577-1577 대리운전 CM송
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '02919210-1247-4b0c-a2b6-fee19cf55364',
  'en',
  '1577-1577-designated-driver-jingle',
  '1577-1577 Designated-Driver Jingle',
  'This means the CM jingle that etched the palindrome phone number 1577-1577 into the public''s memory as a designated-driver service.',
  'Around 2008, designated-driver company 1577-1577 ran an ad campaign built around a jingle repeating its own palindromic phone number, "1577-1577 daeriunjeon" ("designated driving"). Sung by comedian Kang Sung-bum and others, the song spread widely enough to be registered on music streaming sites. It later became even more famous after comedian Lee Soo-geun was hired as the brand''s face.',
  'A 1577-1577 designated-driver TV commercial from around 2008.',
  'Cited as a marketing example of a jingle built around a palindromic phone number.',
  null,
  array['Palindrome Phone Number Jingle','1577-1577 Daeriunjeon CM Song'],
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

-- 28mt46c3  trend_score=324.255517816456  안녕히 계세요 여러분 (퇴사짤)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '567cca53-4447-4d44-a2a6-270ea099f677',
  'en',
  'goodbye-everyone-resignation-meme',
  'Goodbye, Everyone (Resignation Meme)',
  'This means quoting the deadpan farewell line "goodbye, everyone" from the Korean dub of Inuyasha whenever someone quits their job.',
  'In the Korean dub of the Japanese anime Inuyasha, the character Kagome -- localized as "Ga-yeong" -- flatly says "annyeonghi gyeseyo, yeoreobun" ("goodbye, everyone"), and the line became a fixed template for announcing you''re quitting or leaving something behind. Thanks to the voice actor''s memorable delivery, it became a nationwide meme used when quitting a job or breaking free of any constraint.',
  'Originated from a line in an episode of the Korean dub of Inuyasha, which aired in 2003, and later became established online as a symbol of quitting and liberation.',
  'Used in place of a goodbye greeting when declaring you''re quitting a job or escaping a tough situation.',
  null,
  array['Annyeonghi Gyeseyo Yeoreobun','Dobby Is Free','Ga-yeong''s Resignation Meme'],
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

-- === BLOCK 13 ===
-- ay8znvqu  trend_score=323.362943611199  마지막 승부·농구대잔치 열풍
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'efa79ac4-109f-4a17-9cc1-39598832f965',
  'en',
  'last-match-college-basketball-boom',
  'Last Match & the College Basketball Boom',
  'This refers to the Korean basketball craze that peaked alongside the 1994 TV drama Last Match.',
  'The 1994 MBC drama Last Match, together with the manga Slam Dunk, is credited as a driving force behind Korea''s 1990s basketball boom, a period when the college-basketball tournament known as the "Nongu Daejanchi" reached peak popularity and laid the groundwork for the launch of the professional Korean Basketball League (KBL).',
  'Last Match was an MBC Monday-Tuesday miniseries that aired from January 3 to February 22, 1994, starring Jang Dong-gun, Son Ji-chang, and Shim Eun-ha in a basketball-themed story. Game scenes were filmed at Jamsil Students'' Gymnasium during the actual college basketball tournament, capturing the real atmosphere and creating a feedback loop between the drama and the real-life basketball boom; alongside Slam Dunk, it''s considered one of the works that drove 1990s Korean basketball''s popularity, and it''s also cited as one of the early Korean Wave dramas exported to Taiwan and Hong Kong.',
  'Can be cited as a prime example of the early-1990s basketball craze.',
  null,
  array['Majimak Seungbu','Nongu Daejanchi','Last Match'],
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

-- ---------------------------------------------------------------------------
-- REPLACEMENT batch (coordinator follow-up, same loop-049 run): re-translate
-- the 5 EN rows that were already applied from loop-048 (provider='mlx') with
-- Claude's own translations. UPDATE, not INSERT -- targets the existing
-- (meme_id, locale='en') primary key. Source Korean fields re-fetched fresh via
-- production anon REST from public.memes (all 5 are moderation_status='approved').
-- Same caveat as above: no snapshot/staleness guard -- verify memes.updated_at
-- still matches source_updated_at below before applying if content may have
-- changed since 2026-08-04. caution set to null per the same batch instruction.
-- 5 statements => 3 blocks (2 pairs + 1 single, block 16).
-- ---------------------------------------------------------------------------

-- === BLOCK 14 (REPLACE existing MLX EN rows) ===
-- REPLACE fhn6bcju  meme_id=02075a74-77bf-4b96-bc0f-d40027e5ec6c  원더걸스 Tell Me 꼭지점춤  (was: loop-048 MLX)
update public.meme_translations set
  localized_slug = 'wonder-girls-tell-me-point-dance',
  title = 'Wonder Girls'' Tell Me Point Dance',
  summary = 'The Wonder Girls'' Tell Me Point Dance means the hand-motion choreography from the chorus of Wonder Girls'' "Tell Me" becoming a nationwide dance craze.',
  description = 'Wonder Girls'' 2007 hit "Tell Me" sparked a nationwide phenomenon with its chorus hand gestures -- the swaying dance, the poking dance, and the bracelet dance -- performed by people of every generation and profession. User-made cover videos poured in from students to the elderly, police officers, and soldiers, giving rise to the saying "if you don''t know Wonder Girls, you must be a spy."',
  origin = 'Choreography for JYP Entertainment girl group Wonder Girls'' "Tell Me" (2007), directed by Park Jin-young.',
  usage_note = 'Used when reminiscing about the late-2000s K-pop dance craze or in cover-dance content.',
  caution = null,
  aliases = array['Wonder Girls Tell Me Kkokjijeom Chum','Tell Me Dance','Bracelet Dance'],
  usage_examples = '[{"situation": "Company dinner group chat", "text": "Let''s do the Tell Me point dance at the dinner lol"}, {"situation": "SNS comment", "text": "This choreography is just as addictive as the Tell Me point dance."}]'::jsonb,
  status = 'machine',
  source_updated_at = '2026-07-15 15:30:00.191373+00',
  provider = 'claude',
  model = 'claude-fable-5',
  prompt_version = 12,
  translated_at = now(),
  reviewed_at = null,
  reviewed_by = null
where meme_id = '02075a74-77bf-4b96-bc0f-d40027e5ec6c' and locale = 'en';

-- REPLACE 7jtq8bwe  meme_id=0959de22-26e0-4a84-879a-20ab2804deb5  따름 챌린지  (was: loop-048 MLX)
update public.meme_translations set
  localized_slug = 'dda-rum-challenge',
  title = 'Dda-rum Challenge',
  summary = 'The Dda-rum Challenge is a step-dance challenge set to the chorus of TWS''s "You, You" ("Neol Ttaraga").',
  description = 'The dance is set to the addictive "Dda-rum" hook from "You, You" ("Neol Ttaraga"), the title track of TWS''s fifth mini-album released in April 2026. Its rhythmic steps express the feeling of wanting to follow someone you like, and the challenge drew attention after idols including Seungkwan of Seventeen, members of NCT WISH, and Kai of EXO joined in. A variant where participants mimic the person dancing beside them also became popular.',
  origin = 'Began with TWS''s "NO TRAGEDY" release in April 2026.',
  usage_note = 'Used for idol challenges and cover-dance content.',
  caution = null,
  aliases = array['TWS Dda-rum Challenge','Neol Ttaraga Challenge'],
  usage_examples = '[]'::jsonb,
  status = 'machine',
  source_updated_at = '2026-07-15 15:30:00.191373+00',
  provider = 'claude',
  model = 'claude-fable-5',
  prompt_version = 12,
  translated_at = now(),
  reviewed_at = null,
  reviewed_by = null
where meme_id = '0959de22-26e0-4a84-879a-20ab2804deb5' and locale = 'en';

-- === BLOCK 15 (REPLACE existing MLX EN rows) ===
-- REPLACE 9ctd73f3  meme_id=add632b9-d0f3-4255-908c-7a99c0cd07fe  코리안특급  (was: loop-048 MLX)
update public.meme_translations set
  localized_slug = 'korean-express',
  title = 'Korean Express',
  summary = 'Korean Express is the nickname Park Chan-ho earned after becoming the first Korean player to debut in Major League Baseball in 1994.',
  description = 'When Park Chan-ho debuted with the LA Dodgers in 1994 as the first Korean player in Major League Baseball history, he was given the nickname "Korean Express," modeled on hard-throwing pitcher Nolan Ryan''s nickname "Ryan Express." The term went on to become a common way of referring to successful Korean sports stars abroad.',
  origin = 'Coverage of Park Chan-ho''s 1994 MLB debut with the LA Dodgers.',
  usage_note = 'Cited when discussing a Korean sports star''s success playing abroad.',
  caution = null,
  aliases = array['Park Chan-ho''s Nickname'],
  usage_examples = '[{"situation": "KakaoTalk", "text": "Doing that well overseas -- total Korean Express."}, {"situation": "SNS comment", "text": "This performance is Korean-Express-level."}]'::jsonb,
  status = 'machine',
  source_updated_at = '2026-07-15 15:30:00.191373+00',
  provider = 'claude',
  model = 'claude-fable-5',
  prompt_version = 12,
  translated_at = now(),
  reviewed_at = null,
  reviewed_by = null
where meme_id = 'add632b9-d0f3-4255-908c-7a99c0cd07fe' and locale = 'en';

-- REPLACE 6bgyw6gb  meme_id=b6cbf1f5-e67b-4018-9116-0b37a9c79f2a  몬주익의 영웅  (was: loop-048 MLX)
update public.meme_translations set
  localized_slug = 'hero-of-montjuic',
  title = 'Hero of Montjuic',
  summary = 'Hero of Montjuic is the nickname Hwang Young-cho earned for his marathon victory at the 1992 Barcelona Olympics.',
  description = 'Hwang Young-cho won Korea''s first Olympic marathon gold in 56 years, since Sohn Kee-chung, at the 1992 Barcelona Olympics. The nickname comes from the moment he overtook the leader on the steep incline of "Montjuic Hill" near the finish line, unleashed a final sprint, and collapsed after crossing the line. It''s still cited today to describe a dramatic last-minute comeback.',
  origin = 'The live broadcast of the Barcelona Olympics marathon on August 9, 1992.',
  usage_note = 'Cited when discussing a dramatic last-minute comeback or an all-out display of willpower.',
  caution = null,
  aliases = array['Hwang Young-cho','Montjuic Hill'],
  usage_examples = '[{"situation": "KakaoTalk", "text": "He totally turned it around at the end -- that''s Hero-of-Montjuic level."}, {"situation": "SNS comment", "text": "This kind of grit is a Montjuic Hill moment all over again."}]'::jsonb,
  status = 'machine',
  source_updated_at = '2026-07-15 15:30:00.191373+00',
  provider = 'claude',
  model = 'claude-fable-5',
  prompt_version = 12,
  translated_at = now(),
  reviewed_at = null,
  reviewed_by = null
where meme_id = 'b6cbf1f5-e67b-4018-9116-0b37a9c79f2a' and locale = 'en';

-- === BLOCK 16 (REPLACE existing MLX EN rows) ===
-- REPLACE 7jwfbdck  meme_id=feed6dfa-b073-46b7-9694-e281f3307e6d  아기상어 (핑크퐁)  (was: loop-048 MLX)
update public.meme_translations set
  localized_slug = 'baby-shark-pinkfong',
  title = 'Baby Shark (Pinkfong)',
  summary = 'Baby Shark is the Pinkfong-produced children''s song that became an explosive global hit.',
  description = 'SmartStudy''s Pinkfong brand arranged and choreographed a version of an American folk children''s song, releasing a Korean-language version on YouTube in November 2015 and an English-language version with added choreography in June 2016. The catchy chorus and hand motions became hugely popular with children, making it the most-viewed video on Korean YouTube in 2016 and the No. 1 children''s song across Korea''s three major music streaming charts.',
  origin = 'Pinkfong''s (SmartStudy) Korean-language version released in November 2015, followed by the English-language choreography version in June 2016.',
  usage_note = 'Cited casually in family- or children-oriented content.',
  caution = null,
  aliases = array['Pinkfong Baby Shark','Shark Family','Aegi Sangeo'],
  usage_examples = '[]'::jsonb,
  status = 'machine',
  source_updated_at = '2026-07-15 15:30:00.191373+00',
  provider = 'claude',
  model = 'claude-fable-5',
  prompt_version = 12,
  translated_at = now(),
  reviewed_at = null,
  reviewed_by = null
where meme_id = 'feed6dfa-b073-46b7-9694-e281f3307e6d' and locale = 'en';
