-- ZH-TW meme_translations batch -- loop-050 slice 1 (zh-tw), generated 2026-08-04.
-- Source: Claude (this subagent conversation) -- hand-translated from Korean source fields
-- fetched fresh via production anon REST (public.memes, SELECT only), 20 meme_ids
-- assigned to this slice (see task short_ids below). memes table was never written to.
--
-- Format matches loop-050 en/ja slices: plain SQL, idempotent
-- ('on conflict (meme_id, locale) do nothing'). status inserted as 'machine' with
-- reviewed_at/reviewed_by null; a follow-up UPDATE block (bottom of file) promotes
-- this session's own rows to status='reviewed' with a freshness guard
-- (memes.updated_at = t.source_updated_at) so a row is never promoted if the Korean
-- source drifted between fetch and apply.
--
-- caution: translated where present in source (2 of 20 non-null); null otherwise.
-- aliases: each includes the Korean original title plus any Korean aliases already
-- on the source row.
-- usage_examples: translated where the source had any; '[]'::jsonb otherwise.
--
-- 20 statements total.

-- fjhcw2w7  meme_id=fe1e62ef-0d0e-4deb-b7ac-930f3832047a  《鬼滅之刃 無限列車篇》韓國賣座
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fe1e62ef-0d0e-4deb-b7ac-930f3832047a',
  'zh-tw',
  'demon-slayer-mugen-train-korea-hit',
  '《鬼滅之刃 無限列車篇》韓國賣座',
  '時隔4年6週奪下韓國週末票房冠軍的日本動畫劇場版。',
  '2021年上映字幕版、2022年上映配音版的劇場版《鬼滅之刃：無限列車篇》，創下時隔4年6週讓日本電影重返韓國週末票房冠軍的紀錄。這是電視動畫劇場版首次登上週票房冠軍的案例，此後《鬼滅之刃》系列劇場版也對韓國動畫電影市場帶來重大影響。',
  '劇場版《鬼滅之刃：無限列車篇》韓國上映(2021年)',
  '用來提及日本動畫刷新韓國票房紀錄的案例',
  null,
  array['無限列車症候群','귀멸의 칼날 무한열차편 한국 흥행']::text[],
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

-- r8cyrjhy  meme_id=e9a948ba-be09-45f7-9dc4-22f42124c27a  롬곡옾눞(韓文倒讀哏)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'e9a948ba-be09-45f7-9dc4-22f42124c27a',
  'zh-tw',
  'romgok-opnup-hangul-flip',
  '롬곡옾눞(韓文倒讀哏)',
  '將「暴風眼淚(폭풍눈물)」四個字上下顛倒書寫後看起來的樣子，是一種韓文文字遊戲。',
  '這是把「暴風眼淚(폭풍눈물，意指嚎啕大哭)」這幾個字上下顛倒後，看起來像「롬곡옾눞」而誕生的文字遊戲哏。約在2018年，因為是罕見的韓文顛倒現象，在韓國網路社群蔚為話題。',
  '在顛倒韓文字母的遊戲中被發現，經社群分享後擴散開來',
  '用來詼諧表達悲傷或想哭的情況',
  null,
  array['롬곡옾높','暴風眼淚(顛倒前原文)','롬곡옾눞']::text[],
  '[{"text": "考試搞砸了…롬곡옾눞", "situation": "LINE對話"}, {"text": "看到這個結果整個롬곡옾눞", "situation": "社群留言"}]'::jsonb,
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

-- xawqwxax  meme_id=4f7cf03a-7cc5-4e2f-ac5e-3a15f5dd0180  哥哥先請、弟弟先請(農心泡麵廣告)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '4f7cf03a-7cc5-4e2f-ac5e-3a15f5dd0180',
  'zh-tw',
  'brother-first-hyeongnim-meonjeo',
  '哥哥先請、弟弟先請(農心泡麵廣告)',
  '1970年代原版廣告，於2005年由徐炅錫、李潤石搭檔翻拍的農心泡麵廣告詞。',
  '1975年具鳳書與郭圭石主演的農心泡麵廣告詞「哥哥先請、弟弟先請」，在2005年農心創立40週年之際，由徐炅錫與李潤石搭檔翻拍。這是為重新推出懷舊泡麵而企劃、重現當年氛圍的廣告。作為表達互相禮讓美德的用語，至今仍被廣泛引用。',
  '2005年農心牛肉湯泡麵電視廣告，徐炅錫、李潤石主演翻拍版',
  '用於形容互相禮讓的情境時引用「哥哥先請、弟弟先請」',
  null,
  array['徐炅錫 李潤石 牛肉湯廣告','형님먼저 아우먼저']::text[],
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

-- buvhcxqg  meme_id=f3060027-cdd8-4236-893a-15e438c992fb  N分割Vlog
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f3060027-cdd8-4236-893a-15e438c992fb',
  'zh-tw',
  'n-split-vlog',
  'N分割Vlog',
  '以分割畫面呈現上班族等多位過著不同生活的人一天日常的Reels形式。',
  '將畫面分割成多格，把上班族、打工度假者、求職生、護理師、公務員等各自過著不同一天的人們拍進同一支影片中呈現的Reels形式。因能比較彼此不同的生活作息與拍攝構圖而充滿趣味，於2025年在Instagram上蔚為流行。',
  '2025年在Instagram Reels上出現的多畫面Vlog趨勢，被列為當年熱門的Reels形式之一',
  '適合朋友之間比較各自一天的作息(上班、打工度假、求職準備等)並一起發布時使用',
  null,
  array['多重Vlog挑戰','N분할 브이로그']::text[],
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

-- 6r7eyh9y  meme_id=fefce520-c551-46fc-963d-e9e527e02392  徐太志與孩子們《我知道》
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fefce520-c551-46fc-963d-e9e527e02392',
  'zh-tw',
  'seo-taiji-i-know',
  '徐太志與孩子們《我知道》',
  '徐太志與孩子們的出道曲，在評審惡評聲中掀起大眾文化大革命的開端。',
  '1992年3月發行的徐太志與孩子們出道曲，在MBC《特種TV演藝》首播的新人舞台上被評審團打出平均7.8分的史上最低分，但隨後在青少年間引發爆炸性迴響，成為改變韓國大眾音樂版圖的象徵性事件。作為「惡評中爆紅」的元祖級哏，至今仍常在選秀節目等場合被提及。',
  '1992年3月發行徐太志與孩子們1輯，同年4月11日於MBC《特種TV演藝》首次登台',
  '用於提及儘管被惡評、結果卻獲得成功的案例時引用',
  null,
  array['徐太志與孩子們1輯','난알아요','난 알아요']::text[],
  '[{"text": "這次企劃一開始大家都說不行，結果做得這麼好，完全是「我知道」的等級", "situation": "公司群組"}, {"text": "選秀被酸還爆紅，這根本是徐太志「我知道」第二季吧", "situation": "跟朋友聊天"}]'::jsonb,
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

-- 7nhgn33j  meme_id=f4db1c4f-832f-41df-acdf-eee08345c763  Roora《3!4!》
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f4db1c4f-832f-41df-acdf-eee08345c763',
  'zh-tw',
  'roora-3-4',
  'Roora《3!4!》',
  '1996年發表，混聲團體Roora的代表性舞曲金曲。',
  '1996年發表的Roora《3!4!》，是當年與Clon《Kkoong Ttari Shabara》爭奪夏季歌謠榜冠軍的歌曲，搭配口號式副歌，被列為象徵1990年代舞曲全盛期的代表歌曲。',
  '1996年6月15日發行，Roora第4張專輯《All System Go》主打歌。歌名「3!4!」蘊含即使跌倒三次，第四次也要再站起來的意義，據傳是作曲家李賢道為了幫助因團員友人喪禮而陷入低潮的Roora重新振作而創作的曲子。在被稱為「群星大戰」的1996年歌壇激戰中，仍連續3週奪下歌謠排行榜冠軍，簡單好記的歌詞與旋律使其成為運動會、校慶的必備歌曲。近年來配合前奏節奏做動作的遊戲也在節目與社群平台上流行。',
  '可用來像熱鬧的應援口號一樣呼喊副歌',
  null,
  array['3!4!','Roora 三四','룰라 3!4!']::text[],
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

-- 8pgbk4qc  meme_id=f4b7170c-76d3-4144-a0a5-2bc23db98169  S.E.S.《Dream》
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f4b7170c-76d3-4144-a0a5-2bc23db98169',
  'zh-tw',
  'ses-dream',
  'S.E.S.《Dream》',
  '1998年發表，S.E.S.的歐陸舞曲風格金曲。',
  'S.E.S.第2張專輯主打歌《Dream》，是一首嘗試當時韓國歌壇罕見歐陸曲風的歌曲，是S.E.S.的代表作，其招牌舞蹈動作也長久以來令人印象深刻。',
  '《Dream》(原名Dreams Come True)是S.E.S.於1998年11月23日發行的第2張正規專輯主打歌。由柳英振改編自1996年芬蘭女子團體Nylon Beat演唱的〈Rakastuin mä looseriin〉，重新填上韓文歌詞誕生，其特色是由Yoo Jin與Shoo演唱的擬聲饒舌段落，是原曲沒有、新增的編曲構成。輕快的歐陸舞曲音色與分段演唱的唱法，在當時被視為新穎風格而大受歡迎。',
  '可作為1990年代末女子團體金曲的代表案例提及',
  null,
  array['Dreams Come True','S.E.S. 드림']::text[],
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

-- w9maxfw2  meme_id=4ced8917-c746-4d22-bff5-bfc19d01f4fa  KT n016《晚安、夢到我》
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '4ced8917-c746-4d22-bff5-bfc19d01f4fa',
  'zh-tw',
  'kt-n016-goodnight',
  'KT n016《晚安、夢到我》',
  '李貞賢與趙成模共同演出、成為國民級廣告曲的n016手機廣告台詞。',
  '2000年KT n016廣告中，李貞賢對趙成模輕聲說出「晚安、夢到我」的畫面，被評為當年廣告業界最紅的作品。可愛的台詞加上兩位明星的默契，成為跨世代仍被提起的廣告金句，至今在道晚安時仍常被戲謔引用。',
  '2000年KT n016電視廣告，李貞賢、趙成模主演',
  '在俏皮地道晚安時被引用',
  null,
  array['李貞賢 趙成模 n016','KT n016 잘자 내꿈꿔']::text[],
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

-- q6t3gkuy  meme_id=fcdf42f9-4e06-423e-8ed8-8fec72fa10e1  牟太釩 溫哥華冬奧金牌
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fcdf42f9-4e06-423e-8ed8-8fec72fa10e1',
  'zh-tw',
  'mo-tae-bum-vancouver-gold',
  '牟太釩 溫哥華冬奧金牌',
  '以黑馬之姿制霸競速滑冰500公尺的2010年溫哥華冬奧牟太釩。',
  '牟太釩在2010年溫哥華冬奧競速滑冰男子500公尺項目中，以兩輪合計69秒82奪得金牌。當時外界關注焦點原本集中在世界排名居前的李奎爀、李康錫身上，這個意外的奪冠結果因此更加轟動。他與從國小時期就相識的李相花、李承勳一同奪牌，被稱為「競速滑冰三兄妹」，受到媒體高度關注。',
  '2010年溫哥華冬奧競速滑冰男子500公尺冠軍',
  '常被引用作為韓國競速滑冰全盛期的代表案例',
  null,
  array['競速滑冰三兄妹','모태범 밴쿠버올림픽 금메달']::text[],
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

-- qysc867v  meme_id=c2cd3366-1acd-4d9a-866a-542732c80fe8  偷蓋兵營(임요환的欺敵戰術)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'c2cd3366-1acd-4d9a-866a-542732c80fe8',
  'zh-tw',
  'im-yo-hwan-sneaky-barracks',
  '偷蓋兵營(임요환的欺敵戰術)',
  '林遙煥的招牌欺敵戰術用語。',
  '林遙煥為躲避對手偵查，反覆祭出偷偷興建兵營等建築物、在對手意想不到的時機派出兵力的欺敵戰術，因而確立了這個用語。與運用運輸機的游擊戰並列，被列為代表林遙煥心理戰風格的戰術。從1999年至2001年林遙煥初期全盛時期開始廣為流傳。',
  '林遙煥《星海爭霸》初期活動(1999~2001年)的欺敵戰術',
  '用來形容在對方不知情的狀況下暗中準備、出其不意的戰略',
  null,
  array['林遙煥 偷蓋兵營','몰래 배럭']::text[],
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

-- 99u2rws3  meme_id=cb1bb417-d6bf-485b-8808-8a036d204f5a  Fin.K.L.《永遠的愛》
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'cb1bb417-d6bf-485b-8808-8a036d204f5a',
  'zh-tw',
  'fin-kl-eternal-love',
  'Fin.K.L.《永遠的愛》',
  '1999年Fin.K.L.的代表金曲。',
  '1999年5月發行的Fin.K.L.第2張專輯《White》主打歌《永遠的愛》，發行後隨即爆紅，在當年SBS歌謠大戰等各大年末頒獎典禮上橫掃獎項。',
  '《永遠的愛》是Fin.K.L.於1999年5月13日發行的第2張正規專輯《White》主打歌，由金英雅作詞、朱泰榮作曲。發行後在音樂銀行、音樂陣營、人氣歌謠等三大無線台歌謠節目皆奪下冠軍，達成三冠王紀錄，並於1999年末的首爾歌謠大賞與SBS歌謠大戰上，成為首組獲得大賞的女子團體，人氣達到頂峰。以此曲為契機，Fin.K.L.鞏固了「妖精」的形象，成為代表1990年代末的女子團體。',
  '可作為1990年代末女子團體金曲的代表案例提及',
  null,
  array['永遠的愛','핑클 영원한 사랑']::text[],
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

-- a4nkemva  meme_id=fbef165a-1f22-4c61-b4ae-94b848228c1c  《絕地求生》吃到雞了
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fbef165a-1f22-4c61-b4ae-94b848228c1c',
  'zh-tw',
  'pubg-chicken-dinner',
  '《絕地求生》吃到雞了',
  '源自《絕地求生》遊戲獲勝訊息、爆紅成流行語的「吃到雞了」說法。',
  '2017年《絕地求生》在韓國掀起熱潮，遊戲奪冠時彈出的韓文訊息「贏了雞！今晚吃雞肉雞！」中衍生出的「吃到雞了」一詞，成為日常流行語。之後遊戲進行中若嘗試退出，警告文字也一度被改成「要放棄吃雞嗎？」。',
  '遊戲《絕地求生》獲勝訊息(2017年在韓國掀起熱潮時期)',
  '可用作在某件事上獲勝時的慶祝說法',
  null,
  array['吃到雞了','오늘 저녁은 치킨이닭']::text[],
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

-- nuvanjq7  meme_id=f9c65dc7-9fd1-4dee-b49d-3b14133af280  T-ara《Bo Peep Bo Peep》貓咪舞
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f9c65dc7-9fd1-4dee-b49d-3b14133af280',
  'zh-tw',
  't-ara-bo-peep-cat-dance',
  'T-ara《Bo Peep Bo Peep》貓咪舞',
  '讓T-ara一舉躍升頂級女團的2009年冬季金曲舞蹈「貓咪舞」。',
  '2009年冬季發表的T-ara《Bo Peep Bo Peep》，以性感又可愛的服裝與洗腦旋律大受歡迎，其中招牌舞步「貓咪舞」尤其引發話題。在少女時代與Wonder Girls兩強並立的女團市場中，這首歌被評為讓T-ara一舉躋身頂級行列的作品。',
  'Core Contents Media旗下T-ara《Bo Peep Bo Peep》(2009年12月)舞蹈',
  '用於聊到2009年女團舞蹈流行時',
  null,
  array['Bo Peep Bo Peep 舞蹈','貓咪舞','보핍보핍 고양이춤']::text[],
  '[{"text": "這個表情根本是貓咪舞等級", "situation": "LINE對話"}, {"text": "Bo Peep Bo Peep那個年代真的超紅", "situation": "社群留言"}]'::jsonb,
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

-- grjbe3me  meme_id=ebff6f57-1574-42ec-826c-d931d54ba6cc  「Good bye宣言」手指彈奏挑戰
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'ebff6f57-1574-42ec-826c-d931d54ba6cc',
  'zh-tw',
  'goodbye-sengen-finger-tutting',
  '「Good bye宣言」手指彈奏挑戰',
  '以日本VOCALOID歌曲《Good bye宣言》為背景音樂的手指彈奏(finger tutting)影片，2020年也在韓國掀起流行。',
  'Chinozo於2020年4月13日在NicoNico動畫與YouTube發表的VOCALOID歌曲《Good bye宣言》，在2020年5月也在韓國以哏的形式流行起來。之後在TikTok上出現大量以此曲為背景、快速彈動手指的「手指彈奏(finger tutting)」影片，擴散成一種挑戰，也成為VOCALOID音樂以短影音平台為中心被消費的契機。',
  'Chinozo VOCALOID歌曲《Good bye宣言》(2020年4月13日發表)，2020年5月在韓國流行',
  '適合用來聊展現手部技巧的短挑戰影片時使用',
  '最好知道原曲是日本VOCALOID音樂這一點',
  array['그랏바이 센겐','Good bye宣言']::text[],
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

-- rf3dt6mp  meme_id=fb5c03c4-89b6-4861-86ad-1ac6b6d64175  徐太志與孩子們《Come Back Home》現象
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fb5c03c4-89b6-4861-86ad-1ac6b6d64175',
  'zh-tw',
  'seo-taiji-come-back-home-phenomenon',
  '徐太志與孩子們《Come Back Home》現象',
  '1995年因徐太志與孩子們的歌曲而使離家青少年返家的社會現象。',
  '1995年發表的徐太志與孩子們《Come Back Home》，是一首嘗試黑幫饒舌風格的突破性歌曲，因為有離家出走的青少年聽了這首歌後真的回家的故事被媒體報導，因而催生出「Come Back Home現象」這個說法。',
  '徐太志與孩子們第4張專輯主打歌，MV於1995年10月15日公開。發行後陸續有離家青少年聽了這首歌返家的案例，經SBS《新聞追蹤》、KBS九點新聞等主要媒體以「Come Back Home現象」報導，成為社會話題。徐太志與孩子們曾受政府委託拍攝勸導離家青少年返家的公益廣告，但部分社運圈也批評這是體制順從的訊息。此外，這首歌也曾捲入與美國嘻哈團體Cypress Hill歌曲相似的抄襲爭議，但據悉Cypress Hill方面已親自澄清並非抄襲。',
  '可作為聊到離家出走、返家等溫馨故事時的背景知識',
  null,
  array['Come Back Home','Come Back Home現象','컴백홈']::text[],
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

-- zg2usdxu  meme_id=f7001a00-0875-4fb1-badf-5c4842a96b48  「疙瘩三兄弟」給我蘿蔔
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f7001a00-0875-4fb1-badf-5c4842a96b48',
  'zh-tw',
  'galgali-three-brothers-give-me-radish',
  '「疙瘩三兄弟」給我蘿蔔',
  '由朴俊亨主演、《Gag Concert》「疙瘩三兄弟」單元的代表流行語。',
  '出自朴俊亨、沈炫燮等人演出的「疙瘩三兄弟」單元台詞，這個單元大受歡迎，也成為讓朴俊亨躍升《Gag Concert》新王牌的契機。',
  '2001~2002年《Gag Concert》「疙瘩三兄弟」單元',
  '作為2000年代初《Gag Concert》的懷舊話題被提及',
  '無',
  array['給我蘿蔔','朴俊亨 疙瘩三兄弟','갈갈이 삼형제']::text[],
  '[{"text": "這句台詞根本是疙瘩三兄弟給我蘿蔔的既視感", "situation": "LINE對話"}, {"text": "那個年代真的是Gag Concert的傳奇單元", "situation": "社群留言"}]'::jsonb,
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

-- 8uxwctr5  meme_id=e25e6224-bef4-403b-9efc-43049adc2e0d  LG Cyon《Lollipop》
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'e25e6224-bef4-403b-9efc-43049adc2e0d',
  'zh-tw',
  'lg-cyon-lollipop',
  'LG Cyon《Lollipop》',
  '由BIGBANG與2NE1合作歌曲打造的LG Cyon手機K-pop廣告曲。',
  '2009年3月LG電子推出手機Cyon Lollipop，並以BIGBANG與2NE1合作的新曲《Lollipop》作為廣告曲。這首把1950年代金曲旋律重新演繹成K-pop風格的歌曲，一經置入廣告便橫掃各大音源排行榜冠軍，掀起爆炸性人氣，被列為偶像合作廣告曲行銷的成功案例。',
  '2009年3月LG電子Cyon Lollipop電視廣告，BIGBANG、2NE1出演',
  '常被引用作為偶像合作廣告曲行銷的案例',
  null,
  array['BIGBANG 2NE1 Lollipop','LG 싸이언 롤리팝']::text[],
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

-- q2hvyc6j  meme_id=dcce87de-d241-41de-b357-b7a385279364  咻咻咻(不倒翁飛鏢)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'dcce87de-d241-41de-b357-b7a385279364',
  'zh-tw',
  'jjiri-jjiri-toss-or-not',
  '咻咻咻(不倒翁飛鏢)',
  '兒童頻道童謠影片被再利用成遊戲搞破壞(trolling)迷因的案例。',
  '2015年公開的兒童頻道「트니트니(Tuny Tuny)」不倒翁飛鏢玩具童謠，因反覆段落中「要不要丟」的收尾橋段而獲得狂熱人氣。2019年9月20日之後，這句台詞在《英雄聯盟》、《DOTA2》、《鬥陣特攻》等講求團隊合作的遊戲中，被用來表達「要不要丟(擺爛/搞破壞)這場遊戲」的意思而流行起來，成為網路迷因。',
  '兒童頻道「트니트니」童謠影片在遊戲社群中被迷因化(2019年9月)',
  '用於在遊戲中開玩笑討論要不要放棄這場勝負時',
  null,
  array['不倒翁飛鏢','要不要丟','던질까 말까']::text[],
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

-- ef2cynar  meme_id=6971f574-afe4-43c5-bd5e-cb0d5e279fff  長頸鹿(李光洙綽號)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '6971f574-afe4-43c5-bd5e-cb0d5e279fff',
  'zh-tw',
  'giraffe-lee-kwang-soo-nickname',
  '長頸鹿(李光洙綽號)',
  '因為身高高，李光洙在《Running Man》初期獲得的綽號。',
  '2010年《Running Man》初期，身高超過190公分的李光洙獲得了「長頸鹿」這個綽號。金鍾國被稱為「獅子」、李光洙被稱為「長頸鹿」，一追一逃的組合成為《Running Man》初期的人氣元素。',
  '2010年SBS《Running Man》初期，源自李光洙的高挑身材',
  '用於親暱調侃身材高大的人時',
  null,
  array['Running Man 長頸鹿','李光洙 長頸鹿','이광수 기린']::text[],
  '[{"text": "長頸鹿幫我把上面那個拿下來啦哈哈 個子高真方便", "situation": "LINE對話"}, {"text": "我這身高根本是李光洙長頸鹿等級", "situation": "社群留言"}]'::jsonb,
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

-- dbyg5vmr  meme_id=faf8d51e-559f-4726-99e6-6e223074d39a  金炳晚的達人
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'faf8d51e-559f-4726-99e6-6e223074d39a',
  'zh-tw',
  'kim-byung-man-the-master',
  '金炳晚的達人',
  '從自稱苦練16年的吹牛台詞開始，最終被拆穿的《Gag Concert》最長壽單元。',
  '從2007年12月9日播出至2011年，長達4年的《Gag Concert》最長壽單元。金炳晚自稱是某領域「達人」，煞有其事地大放厥詞，最終卻被關鍵線索拆穿是唬爛的結構。「你做過~嗎？沒做過就別亂講」等台詞蔚為流行。',
  'KBS《Gag Concert》(2007.12.09~)，金炳晚飾演',
  '用來調侃毫無根據的自信或吹牛',
  null,
  array['達人(Gag Concert)','沒做過就別亂講','안 해봤으면 말을 하지 마세요']::text[],
  '[{"text": "你做過那個嗎？沒做過就別亂講喔哈哈 完全是達人等級", "situation": "LINE對話"}, {"text": "他這吹牛程度根本是達人單元等級", "situation": "社群留言"}]'::jsonb,
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
  and t.locale = 'zh-tw'
  and t.status = 'machine'
  and t.model = 'claude-fable-5'
  and t.prompt_version = 12
  and m.updated_at = t.source_updated_at
  and t.meme_id in (
  'fe1e62ef-0d0e-4deb-b7ac-930f3832047a',
  'e9a948ba-be09-45f7-9dc4-22f42124c27a',
  '4f7cf03a-7cc5-4e2f-ac5e-3a15f5dd0180',
  'f3060027-cdd8-4236-893a-15e438c992fb',
  'fefce520-c551-46fc-963d-e9e527e02392',
  'f4db1c4f-832f-41df-acdf-eee08345c763',
  'f4b7170c-76d3-4144-a0a5-2bc23db98169',
  '4ced8917-c746-4d22-bff5-bfc19d01f4fa',
  'fcdf42f9-4e06-423e-8ed8-8fec72fa10e1',
  'c2cd3366-1acd-4d9a-866a-542732c80fe8',
  'cb1bb417-d6bf-485b-8808-8a036d204f5a',
  'fbef165a-1f22-4c61-b4ae-94b848228c1c',
  'f9c65dc7-9fd1-4dee-b49d-3b14133af280',
  'ebff6f57-1574-42ec-826c-d931d54ba6cc',
  'fb5c03c4-89b6-4861-86ad-1ac6b6d64175',
  'f7001a00-0875-4fb1-badf-5c4842a96b48',
  'e25e6224-bef4-403b-9efc-43049adc2e0d',
  'dcce87de-d241-41de-b357-b7a385279364',
  '6971f574-afe4-43c5-bd5e-cb0d5e279fff',
  'faf8d51e-559f-4726-99e6-6e223074d39a'
  );

-- ---------------------------------------------------------------------------
-- Verification: count reviewed rows among this slice's 20 meme_ids.
-- ---------------------------------------------------------------------------
select count(*) as reviewed_count
from public.meme_translations
where locale = 'zh-tw'
  and status = 'reviewed'
  and meme_id in (
  'fe1e62ef-0d0e-4deb-b7ac-930f3832047a',
  'e9a948ba-be09-45f7-9dc4-22f42124c27a',
  '4f7cf03a-7cc5-4e2f-ac5e-3a15f5dd0180',
  'f3060027-cdd8-4236-893a-15e438c992fb',
  'fefce520-c551-46fc-963d-e9e527e02392',
  'f4db1c4f-832f-41df-acdf-eee08345c763',
  'f4b7170c-76d3-4144-a0a5-2bc23db98169',
  '4ced8917-c746-4d22-bff5-bfc19d01f4fa',
  'fcdf42f9-4e06-423e-8ed8-8fec72fa10e1',
  'c2cd3366-1acd-4d9a-866a-542732c80fe8',
  'cb1bb417-d6bf-485b-8808-8a036d204f5a',
  'fbef165a-1f22-4c61-b4ae-94b848228c1c',
  'f9c65dc7-9fd1-4dee-b49d-3b14133af280',
  'ebff6f57-1574-42ec-826c-d931d54ba6cc',
  'fb5c03c4-89b6-4861-86ad-1ac6b6d64175',
  'f7001a00-0875-4fb1-badf-5c4842a96b48',
  'e25e6224-bef4-403b-9efc-43049adc2e0d',
  'dcce87de-d241-41de-b357-b7a385279364',
  '6971f574-afe4-43c5-bd5e-cb0d5e279fff',
  'faf8d51e-559f-4726-99e6-6e223074d39a'
  );
