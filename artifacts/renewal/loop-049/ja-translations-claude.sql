-- JA meme_translations batch -- loop-049, translated directly by Claude (this session).
-- Candidates: top 30 public memes (moderation_status in approved/limited) by trend_score,
-- fetched via production anon REST. meme_translations?locale=eq.ja returned 0 anon-visible
-- rows at fetch time, so no memes were excluded as already-translated.
-- Plain SQL (no base64). Each statement below is an independent, idempotent block
-- ('on conflict (meme_id, locale) do nothing'). status='machine': a human reviewer must
-- flip status to 'reviewed' (with reviewed_at/reviewed_by set) before the
-- meme_translations_public_read RLS policy will serve these rows to anon.
-- NOT executed against any database by this batch job -- apply is the orchestrator's job.

-- kkosyeoyagesseo-challenge  trend_score=354.5  꼬셔야겠어 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8908356c-996f-46b1-ad9d-2782e641dcd5',
  'ja',
  'kkosyeoyagesseo-challenge',
  'コショヤゲッソ・チャレンジ',
  'ミノイの曲『コショヤゲッソ(Pick you up)』に合わせて踊る・口パクするチャレンジ',
  'ラッパー、ミノイの楽曲『コショヤゲッソ(Pick you up)』のサビに合わせて、魅力をアピールするポーズを取るダンス・口パクチャレンジ。2026年2〜3月にかけてTikTokでダンスバージョンと口パクバージョンが同時に流行した。',
  'ミノイが2024年7月に発表した2ndフルアルバム『This is my life』収録曲「コショヤゲッソ」が、2026年2月頃からTikTokのダンス・口パクチャレンジの楽曲として使われ始めた。',
  '自信を持って魅力をアピールする場面で、ネタとして使う。',
  null,
  array['ミノイ コショヤゲッソ','Pick you upチャレンジ','꼬셔야겠어 챌린지']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- chapchu-chapchapchu  trend_score=354.23  찹츄찹찹츄
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'b2fea6be-63a7-48aa-988d-86dbefb0650d',
  'ja',
  'chapchu-chapchapchu',
  'チャプチュチャプチャプチュ',
  '中国のインディーズバンドの曲のサビが空耳で可愛く聞こえ、ペット動画の定番BGMとして流行',
  '中国のインディーズバンド・回春丹(かいしゅんたん)の楽曲「丘丘(Qiu Qiu)」のサビが、韓国語では「チャプチュチャプチャプチュ」のように聞こえる空耳から、ゴールデンレトリバーなどペットがご飯を食べる姿や可愛い仕草の動画のBGMとして広く使われた。レトリバーを「チャプチュリバー」と呼ぶ派生表現も生まれた。',
  '2023年2月発売の回春丹のアルバム『蜜虫』収録曲で、2026年初頭に韓国のリール・ショート・TikTokでBGMとして急速に拡散した。',
  '可愛らしい、あるいはリズミカルな繰り返し動作の動画のBGMとして使う。',
  null,
  array['Qiu Qiuミーム','チャプチュリバー','찹츄찹찹츄']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- sogaeting-skit  trend_score=346.71  소개팅 상황극
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '3ab36237-b6a8-417e-80ed-ae5005e008ca',
  'ja',
  'sogaeting-skit',
  'ソゲッティン(お見合いデート)寸劇',
  '韓国式お見合いデート「ソゲッティン」で起きたとんでもない状況を再現するコント',
  'ソゲッティンの場で奇妙な言動をする相手に出会った体験を、コミカルに再現する寸劇形式のコンテンツ。どんでん返しで感動的な結末を付け加えるパターンも多い。',
  '恋愛体験談を扱うアカウントを中心に流行した、ソゲッティンのエピソードを再現する寸劇。',
  'ソゲッティンで経験したとんでもない出来事を話すときに引用する。',
  null,
  array['ソゲッティン話','소개팅 상황극']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- explain-my-job-illegally  trend_score=344.41  자기 직업 불법적으로 말하기
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '758cef01-7f96-4fd5-87e3-2387b8e7dda6',
  'ja',
  'explain-my-job-illegally',
  '自分の職業を犯罪っぽく説明してみる',
  'ごく普通の職業を犯罪組織のように大げさに説明するミーム',
  '客室乗務員を「人々を金属の筒に閉じ込め、数万フィート上空で監視する仕事」のように表現するなど、自分の職業をまるで犯罪行為かのように大げさに説明するユーモア。内容はすべて事実なのに、言い回しを変えるだけで犯罪のように聞こえるというギャップが笑いどころだ。',
  '英語圏の「Badly Explain Your Profession」ミームが翻訳される形で2026年5月頃にThreads・リール・ショートで広まり、韓国国内ではInstagramアカウント@choeeunsu、@baechuuなどがこの形式を流行させた。',
  '自分の職業を紹介する際、意外性で笑いを取るために使う。',
  null,
  array['職業を違法っぽく説明する','私の職業を犯罪っぽく説明してみる','자기 직업 불법적으로 말하기']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- eoreum-musical-challenge  trend_score=343.66  얼음 뮤지컬 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd494f475-6a0c-405c-924b-2f5e4a775b7c',
  'ja',
  'eoreum-musical-challenge',
  '氷(フリーズ)ミュージカルチャレンジ',
  '『イカゲーム』シーズン2でソン・ギフンが叫ぶ「氷(フリーズ)」というセリフに、YouTuberジェププが曲を付けたミュージカル風リミックス',
  '2025年1月、YouTuberのジェププが『イカゲーム』シーズン2でイ・ジョンジェが演じたソン・ギフンのセリフ「氷(フリーズ)」に、ミュージカルナンバー風のメロディーを付けたリミックス動画を公開した。中毒性のあるメロディーで話題になり再生回数300万回を突破し、2025年のミームトレンドの幕開けを告げたコンテンツとされている。',
  'YouTuberジェププによる『イカゲーム』シーズン2のセリフリミックス動画',
  'ドラマのセリフをリミックスしたミームの事例として紹介する。',
  null,
  array['氷(ジェププ)','ソン・ギフンの氷','얼음 뮤지컬 챌린지']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- geoje-yahho  trend_score=341.53  거제 야호
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '4be8ec7d-0540-4750-8a1c-90375bd5b9ea',
  'ja',
  'geoje-yahho',
  '巨済(コジェ)ヤッホー',
  '日本語の掛け声「ヤッホー」に地名をつけて叫ぶ、ギャップ萌えリアクションミーム',
  'リセンヌのメンバー、ミナミがウォニのYouTube旅行コンテンツで巨済島(コジェド)を訪れた際、突然「コジェ、ヤッホー!」と叫び、ウォニが唖然とするリアクションが話題になった。その後、巨済市の公式SNSが反応し、メンバー全員が巨済市の広報大使に任命されるなど、地域マーケティングにもつながった。',
  'リセンヌのウォニのYouTubeチャンネルの巨済島旅行コンテンツ',
  '地名や名前を入れて「〜ヤッホー」と、明るい挨拶代わりに使う。',
  null,
  array['ヤッホーミーム','巨済ヤッホー','거제 야호']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- ryu-seung-ryong-kimochi-overwatch  trend_score=338.12  류승룡 기모찌!(오버워치)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '634b5127-f0f8-4789-bde7-8a4e4e3042da',
  'ja',
  'ryu-seung-ryong-kimochi-overwatch',
  'リュ・スンリョン、気持ち!(オーバーウォッチ)',
  'ゲンジの必殺技のセリフが、韓国語圏で空耳して生まれたオーバーウォッチのミーム',
  'ゲンジが必殺技使用時に叫ぶ日本語のセリフ「龍神の剣を喰らえ」が、緊迫した戦闘中の韓国プレイヤーの耳には俳優リュ・スンリョンの名前と「気持ち」を合わせたように聞こえるという反応から生まれ、オーバーウォッチのユーザーの間で流行語になった。',
  'オーバーウォッチのゲンジ必殺技ボイスの空耳から',
  'オーバーウォッチのゲンジの必殺技ボイスをパロディするときに使う。',
  null,
  array['気持ち','류승룡 기모찌']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- kkeullyeo-ogeora  trend_score=336.4  낉여오거라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '06f17cd7-f14e-4505-8864-8d6dc071f1a2',
  'ja',
  'kkeullyeo-ogeora',
  '茹でて参れミーム',
  '欲しいものを堂々と持って来いと命じる、時代劇口調のミーム',
  '「茹でて持って来い」を大げさな時代劇口調に変形させた言葉で、NCT WISHのユウシがラーメン好きを表す合成画像から生まれ、犬バージョンとしてファンダムの外にも広まった。2025年に流行し、さまざまな場面で使われた。',
  'NCT WISHユウシのファン制作合成画像から始まった',
  'ふざけて何かを要求するときに使う。',
  null,
  array['낉여오거라']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- epik-high-love-love-love-challenge  trend_score=335.98  에픽하이 Love Love Love 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f3bcf369-937c-465d-bc94-957069a2eddc',
  'ja',
  'epik-high-love-love-love-challenge',
  'エピックハイ『Love Love Love』チャレンジ',
  '2007年発売のエピックハイの楽曲が、自然発生したショート動画チャレンジをきっかけに19年ぶりに再ヒットした事例',
  'エピックハイが2007年に発表した『Love Love Love』のサビに合わせてハートを描く簡単な振り付けが、TikTok・リール・ショートで自然発生的に広まり、2026年初頭に音楽チャートを再浮上させた。制作当時はチャレンジを想定していなかった点が話題を呼び、Z世代には新曲として、既存ファンには懐かしい曲として受け止められた。',
  '2007年発売のエピックハイの楽曲が2026年にショート動画チャレンジで再ヒット',
  '昔の名曲を新しいチャレンジとして楽しむときに使う。',
  null,
  array['에픽하이 Love Love Love 챌린지']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- ddarum-challenge  trend_score=335.98  따름 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '0959de22-26e0-4a84-879a-20ab2804deb5',
  'ja',
  'ddarum-challenge',
  'TWS『ッタルム(Dda-rum)』チャレンジ',
  'TWSの「君についてく(You, You)」のサビに合わせたステップダンスチャレンジ',
  '2026年4月発売のTWSミニ5集タイトル曲「君についてく(You, You)」の中毒性のある「ッタルム(Dda-rum)」というサビに合わせたダンスチャレンジ。好きな相手についていきたい気持ちをリズミカルなステップで表現しており、SEVENTEENのスングァン、NCT WISH、EXOのカイなど多数のアイドルが参加して話題を集めた。隣の人の動きを真似する応用バージョンも流行した。',
  '2026年4月のTWS「NO TRAGEDY」発売とともに始まった',
  'アイドルチャレンジ、カバーダンスコンテンツとして使う。',
  null,
  array['TWSッタルムチャレンジ','君についてくチャレンジ','따름 챌린지']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- geukkaikkeo-daechung  trend_score=335.25  봉숭아학당 그까이꺼 대충
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '52c381c5-800b-44db-b04b-971653620ce5',
  'ja',
  'geukkaikkeo-daechung',
  'ポンスンア学堂『そんなの適当に』',
  'チャン・ドンミンが2004年に演じた警備員キャラクターの流行語',
  '2004年末から『ギャグコンサート』の「ポンスンア学堂」コーナーで警備員役を演じたチャン・ドンミンが、「そんなもん、まあ適当に〜」という流行語で、難しいことも簡単に片付くというウィットを見せた。',
  '2004年11月末から2006年4月まで放送されたKBS『ギャグコンサート』の「ポンスンア学堂」コーナーの警備員キャラクターから生まれた流行語。2004年にKBS公開採用19期でデビューしたチャン・ドンミンが忠清道(チュンチョンド)訛りを話す警備員役を演じ、授業中に突然登場してほら話を並べた後、「そんなもん、まあ適当に〜!」と締めくくるパターンで笑いを取った。この流行語はデビューと同時にチャン・ドンミンの名を大衆に印象づけ、以後さまざまな番組で引用・パロディされた。',
  '難しいことを軽く済ませるときに使う。',
  null,
  array['そんなの適当に','봉숭아학당 그까이꺼 대충']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- akmu-kpop-star-season2-win  trend_score=334.86  악동뮤지션 K팝스타2 우승
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8ca5b4db-2cbf-4181-bd50-a9365b7ffacf',
  'ja',
  'akmu-kpop-star-season2-win',
  'AKMU『Kpopスター シーズン2』優勝',
  '10代の兄妹シンガーソングライターデュオが、オーディション番組史上初めて優勝した出来事',
  '2013年、SBS『Kpopスター シーズン2』で兄妹デュオのAKMUが、自作曲「足組むな(タリッコジマ)」「クレッシェンド」などで大きな人気を得て最終優勝を果たした。10代のシンガーソングライターの優勝という、オーディション番組史上初の記録を打ち立てた。',
  '2013年4月、SBS『Kpopスター シーズン2』決勝戦',
  'オーディション番組や自作曲について話すときに使う。',
  null,
  array['イ・チャニョク イ・スヒョン','AKMU優勝','악동뮤지션 K팝스타2 우승']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- sk-telecom-doego-song  trend_score=333.52  SK텔레콤 되고송
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'a6478781-ef94-43ce-bcfd-8305eed481af',
  'ja',
  'sk-telecom-doego-song',
  'SKテレコム『なんとかなるさソング(トェゴソング)』',
  '北京五輪の時期に前向きな力を歌った、SKテレコムの「トェゴソング」キャンペーン',
  '2008年、SKテレコムはチャン・ドンゴンとチョン・ジフンをモデルに起用し、前向きなメッセージを込めた「トェゴソング(なんとかなるさソング)」キャンペーンを展開した。北京オリンピックの最中にはエピックハイが歌ったオリンピック版も同時に人気を集めた。誰でも口ずさみやすいメロディーで、前向きな自己暗示の文化を広めたキャンペーンとされている。',
  '2008年、SKテレコムのテレビCM。チャン・ドンゴン、チョン・ジフン出演',
  '「きっとうまくいく」という前向きな決意を、歌うように引用する。',
  null,
  array['チャン・ドンゴン チョン・ジフン トェゴソング','SK텔레콤 되고송']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- 12-3-30-challenge  trend_score=333.52  12-3-30 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'c13a179c-67ce-4a83-809d-4a3614616cf4',
  'ja',
  '12-3-30-challenge',
  '12-3-30チャレンジ',
  '傾斜12%・時速3マイルで30分歩くトレッドミル有酸素チャレンジ',
  'ランニングマシンの傾斜を12%に上げ、時速3マイルの速度で30分間歩く有酸素ルーティン。ランニングの代わりに低強度のウォーキングで心拍数を上げ、体脂肪の減少と下半身・体幹への刺激を狙うのが特徴で、ダイエット記録系のショート動画で繰り返し使われている。',
  'アメリカのインフルエンサー、ローレン・ジラルド(Lauren Giraldo)が2019年にYouTubeで初めて公開し、2020年11月に同じ内容をTikTokに投稿すると爆発的に広まった。',
  'ダイエットや有酸素運動のルーティンを紹介する際、「12-3-30やってる」のように言及する。',
  null,
  array['12-3-30トレッドミルチャレンジ','12330チャレンジ','12-3-30 챌린지']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- syagal  trend_score=330.85  샤갈
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '9e8beb59-6d0c-4d56-87c2-ca41f03927b0',
  'ja',
  'syagal',
  'シャガル',
  '呆れた・気まずい状況で使う、YouTube発の新語',
  'YouTubeチャンネル「ヨダノ」でヨルがよく使っていた口癖がリスナーの間でミームのように広まった表現で、呆れたりイライラする状況で使う。YouTubeショート・リール・コメント欄などを通じて急速に拡散した。',
  'YouTubeチャンネル「ヨダノ」の口癖から生まれた',
  '呆れた、あるいはイライラする状況で感嘆詞のように使う。',
  null,
  array['샤갈']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- parapara-demo-odoranakya  trend_score=329.12  파라파라나 춰야겠다
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '06450042-a640-43f2-aadd-02b54bd0614d',
  'ja',
  'parapara-demo-odoranakya',
  'パラパラでも踊らなきゃ',
  '気まずい状況を現実逃避するように笑って受け流すリアクションフレーズ',
  'リセンヌのミナミが巨済島旅行動画で、ギャルメイクをしたまま伴奏なしで日本のレトロダンス「パラパラ」を踊り始めたことから生まれたセリフ。困った状況で「知らない、パラパラでも踊らなきゃ」というふうに、可愛らしく現実逃避する感情が共感を呼びミームになった。',
  'リセンヌ、ウォニのYouTubeチャンネルの巨済島旅行コンテンツ(ミナミのギャルコーナー)',
  '困った、あるいはやりたくない状況を笑って受け流すときに使う。',
  null,
  array['パラパラミーム','파라파라나 춰야겠다']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- boa-no1  trend_score=328.65  보아 - No.1
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '83bbcc87-db0d-41bb-aa3b-8d62bae0b07a',
  'ja',
  'boa-no1',
  'BoA - No.1',
  '世界的な歌手になるという抱負を込めた、BoAの2002年ユーロダンスヒット曲',
  '2002年4月発売のBoA正規2集のタイトル曲で、明るいユーロダンスサウンドに世界一の歌手になるという抱負を込めた。同年50万枚以上を売り上げ、BoAを名実ともにトップアイドルの地位へ押し上げた。',
  '2002年4月、BoA正規2集のタイトル曲として発売',
  '2000年代初頭のソロアイドル全盛期を語るときに言及する。',
  null,
  array['BoA 2集タイトル曲','보아 No.1']::text[],
  '[{"text": "2000年代初頭といえばやっぱりBoAのNo.1だよね、あの頃は本当に世界征服するのかと思ってた", "situation": "同窓会"}, {"text": "BoAのNo.1聴くと、あの時代のユーロダンス感がたまらない", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- yareu  trend_score=327.76  야르
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '78211f0f-3f29-4fa8-aeb5-fcec2a9483ca',
  'ja',
  'yareu',
  'ヤル',
  '気分がいいときに使う感嘆詞で、「シャガル」と対になる新語',
  '「いいね・楽しい・やったー」のような意味で使われる感嘆詞で、あるネットミームのまとめによれば「気分が悪いときはシャガル、気分がいいときはヤル」という公式が成り立つほど対で使われる。',
  'シャガルと対になって生まれた、YouTube・SNS発の感嘆詞の新語',
  '気分がいい状況で感嘆詞のように使う。',
  null,
  array['야르']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- ehyu-eyo-ehyu  trend_score=327.08  에휴에요 에휴
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '87b53438-1535-4c84-837b-80ae64cb4f8b',
  'ja',
  'ehyu-eyo-ehyu',
  'はぁですよ、はぁ',
  'STELLA LIVE所属VTuber、フウヤが気まずい状況でこぼす半敬語のため息ミーム',
  'STELLA LIVE所属VTuberのサキハネ・フウヤが、デビュー初期に視聴者のいたずらっぽいコメントに対し、独特の半敬語で嘆きながらこぼした言葉に由来する。フウヤを代表する流行語として定着し、公式スタンプにもなった。',
  'STELLA LIVEフウヤのデビュー配信',
  '気まずい、あるいは呆れた状況で嘆くように使う。',
  null,
  array['はぁですよ','에휴에요 에휴']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- kara-mister-hip-dance  trend_score=327.08  카라 미스터 엉덩이춤
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '15b6a625-1319-44aa-9791-db3300507166',
  'ja',
  'kara-mister-hip-dance',
  'KARA『ミスター』ヒップダンス',
  'KARAの「ミスター」で腰を振る振り付けが「ヒップダンス」と呼ばれ社会現象を巻き起こした',
  '2009年、KARAの「ミスター」は元々収録曲の一つだったが、振付師ペ・ユンジョンが考案した腰を振る動作が初放送直後に大ヒットし、タイトル曲以上に注目を集めた。ネットユーザーが「ヒップダンス」と呼んで話題になり、その後日本でも一つの社会現象として紹介されるほどの人気を博した。',
  'DSPメディア、KARA「ミスター」(2009年)振付、ペ・ユンジョン',
  '2009年のガールズグループのポイント振り付けブームを振り返るときに使う。',
  null,
  array['ミスター腰振りダンス','카라 미스터 엉덩이춤']::text[],
  '[{"text": "この振り付け、完全にKARAのミスターのヒップダンス級の中毒性", "situation": "LINEトーク"}, {"text": "ミスターの振り付け、あの頃本当に社会現象だったよね", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- jwirolla  trend_score=327.03  쥐롤라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'eb41ea64-cb26-48b9-ae6a-264fa8dcbda5',
  'ja',
  'jwirolla',
  'ネズローラ',
  'コメディアンのイ・チャンホがYouTube「パンソングク」でミュージカルナンバーをカバーして生まれたミーム',
  '2024年8月、YouTubeチャンネル「パンソングク」のミュージカル別キャラコンテンツで、イ・チャンホ(イ・ホグァン)が『キンキーブーツ』の「ランド・オブ・ローラ」をカバーし、ネズミに似ていることから「ネズローラ」、テコンドーの動作を加えて「テコンローラ」というあだ名がついた。動画は約4週間で500万再生を突破して話題になり、ミュージカルに無関心だった層まで実際の劇場へ足を運ばせ、『キンキーブーツ』10周年公演のチケット完売にも貢献した。',
  'YouTubeチャンネル「パンソングク」のミュージカルカバーコンテンツ',
  'コメディアンのYouTubeコンテンツから生まれたミームの事例として紹介する。',
  null,
  array['テコンローラ','イ・ホグァン ローラ','쥐롤라']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- goma-haera-mai-mugeotda-aiga  trend_score=327.03  고마해라 마이 묵었다 아이가
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'b322f070-fac9-4705-af25-1d16a6f5a79d',
  'ja',
  'goma-haera-mai-mugeotda-aiga',
  'もうやめとけ、たんと食うたやろがい',
  '映画『チング/友へ』(2001)の名セリフ',
  '組同士の抗争シーンで出てきた釜山訛りのセリフで、独特のリズム感のある口調から、コメディのパロディでもよく使われた。',
  '2001年公開の映画『チング/友へ』',
  'パロディやものまねのネタとして今も引用される。',
  null,
  array['もうやめとけ','고마해라 마이 묵었다 아이가']::text[],
  '[{"text": "もうやめとけ、たんと食うたやろがいwww", "situation": "LINEトーク"}, {"text": "このセリフ、いまだにものまねの定番だよね", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- tralalero-tralala  trend_score=326.14  트랄랄레로 트랄랄라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'f9da7a03-01de-42c3-8e1c-c05af1fccf6b',
  'ja',
  'tralalero-tralala',
  'トラレレロ・トラララ',
  'ナイキのスニーカーを履いた三本足のサメが登場する、イタリア語のナンセンスミーム',
  '2025年1月にTikTokで登場した「イタリアン・ブレインロット」系キャラクターの第一号で、ナイキのスニーカーを履いた三本足のサメが登場する。低品質なAI生成動画と意味のないイタリア語の歌詞が特徴で、爆撃機とワニが合体したキャラクター「ボンバルディーロ・クロコディーロ」とセットで流行した。2025年3月に世界中に拡散し、韓国のリール・ショートでもパロディが相次いだ。',
  'TikTokユーザーが投稿したAI生成動画から始まり、2025年3月に世界的に拡散した',
  'AIミームやイタリアン・ブレインロットについて話すときに使う。',
  '意味のないナンセンスなので幼稚だという評価もある。',
  array['トラレレロトラララ(異表記)','イタリアン・ブレインロット','ティティティ','트랄랄레로 트랄랄라']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- situationship  trend_score=325.6  시추에이션십(Situationship)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'ffa80a30-36b5-4fb8-a1e0-599d2e902625',
  'ja',
  'situationship',
  'シチュエーションシップ',
  '恋人ではないが恋人のような、曖昧な関係を指す新語',
  '正式に付き合っているわけではないが、感情的・身体的な親密さを共有する曖昧な関係を指す表現。「シチュエーションシップの相手とのやり取り」のようなコンテンツフォーマットでTikTokにおいて大きく流行した。2010年代に作られた語だが、TikTokを通じて一般に広まる新語として定着した。',
  '2010年代に作られた造語が、2023年にTikTokのコンテンツを通じて大衆的に広まった。',
  '曖昧な恋愛関係を説明するときに使う。',
  null,
  array['Situationship','시추에이션십(Situationship)']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- korean-express  trend_score=324.98  코리안특급
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'add632b9-d0f3-4255-908c-7a99c0cd07fe',
  'ja',
  'korean-express',
  'コリアン特急',
  '1994年、パク・チャンホがメジャーリーグデビューして得た愛称',
  '1994年に韓国人として初めてLAドジャースでメジャーリーグデビューを果たしたパク・チャンホが、剛速球投手ノーラン・ライアンの愛称「ライアン・エクスプレス」にちなんで得た愛称。以後、韓国のスポーツスターを呼ぶ慣用的な形容として広く使われるようになった。',
  '1994年、パク・チャンホのLAドジャースメジャーリーグデビューに関する報道',
  '韓国のスポーツスターの海外進出の成功を語るときに引用する。',
  null,
  array['パク・チャンホの愛称','코리안특급']::text[],
  '[{"text": "海外であんなに活躍するなんて、まさにコリアン特急だね", "situation": "LINEトーク"}, {"text": "この活躍はコリアン特急級だ", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- hero-of-montjuic  trend_score=324.98  몬주익의 영웅
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'b6cbf1f5-e67b-4018-9116-0b37a9c79f2a',
  'ja',
  'hero-of-montjuic',
  'モンジュイックの英雄',
  '1992年バルセロナ五輪マラソンでファン・ヨンジョが得た愛称',
  '1992年バルセロナ五輪マラソンで、ソン・ギジョン以来56年ぶりに金メダルを獲得したファン・ヨンジョが、ゴール手前の急坂「モンジュイックの丘」で逆転し、最後のスパートをかけて倒れ込んだ場面に由来する愛称。今でも劇的な土壇場の逆転劇を表現する際に引用される。',
  '1992年8月9日、バルセロナ五輪マラソンの中継放送',
  '土壇場の大逆転劇や闘魂を語るときに引用する。',
  null,
  array['ファン・ヨンジョ','モンジュイックの丘','몬주익의 영웅']::text[],
  '[{"text": "土壇場で完全に逆転したね、モンジュイックの英雄級だ", "situation": "LINEトーク"}, {"text": "この闘魂、モンジュイックの丘の再現だ", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- where-from-mississippi  trend_score=324.98  어디출신 미시시피
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'fd84e47d-f496-4ed8-bd18-1fdc9e9e979b',
  'ja',
  'where-from-mississippi',
  '出身は?ミシシッピ!',
  'ミュージカル『シカゴ』の腹話術シーンのセリフを真似するミーム',
  'ミュージカル『シカゴ』のナンバー「We Both Reached For The Gun」中の「出身は? ミシシッピ! ご両親は? 大金持ち!」という腹話術のセリフをショート動画でパロディするミーム。2025年6月の『シカゴ』再演とともに流行し、公演の興行にも貢献した。',
  'ミュージカル『シカゴ』の腹話術ナンバーに由来',
  'ミュージカルミームをパロディするときに使う。',
  null,
  array['シカゴ腹話術ミーム','어디출신 미시시피']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- 1577-1577-daeri-unjeon-cm-song  trend_score=324.26  1577-1577 대리운전 CM송
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '02919210-1247-4b0c-a2b6-fee19cf55364',
  'ja',
  '1577-1577-daeri-unjeon-cm-song',
  '1577-1577代行運転CMソング',
  '回文のような電話番号を歌にして、代行運転業界に刻み込んだCMソング',
  '2008年頃、代行運転業者「1577-1577」は、前から読んでも後ろから読んでも同じ電話番号「1577-1577代行運転」というCMソングを通じて、番号そのものを印象づけるマーケティングを展開した。カン・ソンボムらが歌ったこの曲は音楽配信サイトにも登録されるほど広まった。後にコメディアンのイ・スグンがモデルに起用され、さらに有名になったCMソングである。',
  '2008年頃の1577-1577代行運転のテレビCM',
  '回文形式の電話番号を強調するCMソングのマーケティング事例として引用される。',
  null,
  array['前後同じ電話番号','1577-1577 대리운전 CM송']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- annyeonghi-gyeseyo-yeoreobun-resignation  trend_score=324.26  안녕히 계세요 여러분 (퇴사짤)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '567cca53-4447-4d44-a2a6-270ea099f677',
  'ja',
  'annyeonghi-gyeseyo-yeoreobun-resignation',
  '皆さん、さようなら(退職ネタ画像)',
  'アニメ『犬夜叉』韓国語吹き替え版のセリフを使った、退職挨拶ミームの定番',
  '日本のアニメ『犬夜叉』の韓国語吹き替え版で、登場人物かごめ(韓国語吹き替え版でのローカライズ名は「ガヨン」)が淡々と言う「皆さん、さようなら」というセリフが、退職や決別を宣言するネタ画像として定着した。声優の印象的な演技のおかげで、会社を辞めたり、何らかのしがらみから抜け出したりするときに使う定番ミームになった。',
  '2003年に放送された『犬夜叉』韓国語吹き替え版のエピソードのセリフに由来し、その後オンラインで退職・解放を象徴するミームとして定着した。',
  '会社を辞める、あるいはつらい状況から抜け出すと宣言するとき、挨拶代わりに使う。',
  null,
  array['ドビーは自由だ','ガヨンの退職ネタ画像','안녕히 계세요 여러분 (퇴사짤)']::text[],
  '[]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- friendship-stage-longing-mother  trend_score=324.26  우정의 무대 그리운 어머니
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd5fbbcff-805a-4141-b203-6109d21823e9',
  'ja',
  'friendship-stage-longing-mother',
  '友情のステージ 恋しい母',
  '軍部隊慰問公演で母と息子が再会する、涙の名物コーナー',
  '1990年7月から、KBS『友情のステージ』の最後の順番として挿入歌「恋しい母」が流れ、恋しい名前の母親がステージへ歩み出て息子と劇的に再会する場面が放送されるたびに、視聴者を涙させた。今でも「お母さんに会いたいとき」の導入部分は、懐かしい記憶の象徴としてクリップ化され再生されている。',
  'KBS『友情のステージ』のコーナー(1990年〜1990年代)',
  '感動的な再会シーンを語るときにたとえとして引用する。',
  null,
  array['恋しい母','お母さんに会いたいとき','우정의 무대 그리운 어머니']::text[],
  '[{"text": "この再会シーン、完全に友情のステージ級の涙だ", "situation": "LINEトーク"}, {"text": "恋しい母が流れると涙をこらえるのがつらい", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;
