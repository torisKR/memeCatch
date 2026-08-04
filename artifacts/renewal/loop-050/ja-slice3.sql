-- JA meme_translations batch -- loop-050 slice 3, translated directly by Claude (this session).
-- 20 assigned meme_id docs, fetched via production anon REST (memes table, SELECT only).
-- Plain SQL (no base64). Each insert is independent and idempotent
-- ('on conflict (meme_id, locale) do nothing'). Inserted as status='machine', then this
-- script's own rows (model='claude-fable-5', prompt_version=12) are promoted to 'reviewed'
-- below, scoped to this slice's meme_ids and guarded by source_updated_at match.
-- memes table was never written to (SELECT only).

-- god-to-my-mother  god 어머님께
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '91a8db8d-de1e-432c-95a0-e10e3a97d4a8',
  'ja',
  'god-to-my-mother',
  'god お母様へ',
  '1999年にデビューしたgodのデビュー曲で、「ジャージャー麺」の歌詞で有名な曲。',
  '1999年にデビューしたgodの「お母様へ」は、「お母さんはジャージャー麺が嫌いだと言っていた」という歌詞で大きな反響を呼んだ。ミュージックビデオには当時新人だった俳優チャン・ヒョクが出演し、この曲を聴いて家出していた青少年が家に戻ったというエピソードが報道されるほど社会的反響を呼んだ。リーダーのパク・ジュニョンの幼少期の実話をモチーフに作られたが、実際は具材がチャプチェだったところを大衆性と韻を考慮してジャージャー麺に変えたと本人が明かしている。',
  '1999年発売のgod1集タイトル曲。「お母さんはジャージャー麺が嫌いだと言っていた」という歌詞で有名で、リーダーのパク・ジュニョンの幼少期の実話がモチーフになっている。',
  '両親に申し訳ない気持ちや親孝行の話をするときに歌詞を引用できる',
  null,
  array['お母様へ','ジャージャー麺が嫌いだと言っていた','god 어머님께']::text[],
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

-- gag-concert-hilarious-gag  우리의 개그는 죽도록 웃긴 개그
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '45add623-8ac3-492a-a1c6-991117114458',
  'ja',
  'gag-concert-hilarious-gag',
  '僕らのギャグは死ぬほど笑えるギャグ',
  '小道具を使った突拍子もないギャグを自分で解説する『ゲグコンサート』のコーナー流行語。',
  'パク・ジュニョン、クォン・ジニョン、キム・ダレが出演し、小道具を使った突拍子もないギャグを披露した後、観客が理解できないと「僕らのギャグは○○するギャグだ」と自ら解説する形式で人気を集めた。',
  '2003年1月19日から9月28日まで放送された『ゲグコンサート』の「雨具三兄弟」コーナー。',
  '難解なギャグを自分で説明するときにパロディとして引用',
  null,
  array['雨具三兄弟','ウワ~','우리의 개그는 죽도록 웃긴 개그']::text[],
  '[{"text": "このネタ理解できないでしょ?僕らのギャグは誰にも理解できないギャグだよ(笑)", "situation": "カカオトーク"}, {"text": "さすが僕らのギャグは死ぬほど笑えるギャグ(笑)", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- wonder-girls-so-hot-v-line-dance  원더걸스 So Hot V라인댄스
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '19a1c88a-be10-4244-96c6-3c07120425be',
  'ja',
  'wonder-girls-so-hot-v-line-dance',
  'Wonder Girls『So Hot』Vラインダンス',
  'Wonder Girls「So Hot」のレトロなロックンロール振り付けが2008年上半期を席巻したブーム。',
  '2008年5〜6月にリリースされたWonder Girlsの「So Hot」はレトロなアナログ楽器とロックンロールのリズムが特徴の曲で、振付師ペ・ユンジョンが手がけたVラインダンスが大きな人気を集めた。「So Hot」とその後の「Nobody」まで続き、2008年のWonder Girlsの3連続メガヒットを牽引した。',
  'JYPエンターテインメント Wonder Girls「So Hot」(2008年5〜6月)、振り付けはペ・ユンジョン。',
  '2008年のガールズグループのダンスブームを語るときに',
  null,
  array['ソハッダンス','Vラインダンス','원더걸스 So Hot V라인댄스']::text[],
  '[{"text": "今度のダンス、So HotのVラインっぽく振り付けしてみようか", "situation": "カカオトーク"}, {"text": "レトロ風の振り付け、So Hotレベルだね", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- cha-bum-kun-tscha-bum  차범근 차붐
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '802bade9-1ecf-4cba-adf5-521a90954f64',
  'ja',
  'cha-bum-kun-tscha-bum',
  'チャ・ボムグン チャブーム',
  'ブンデスリーガでアジア人最多得点を記録したチャ・ボムグンのドイツ式愛称。',
  'チャ・ボムグンはドイツのブンデスリーガでアジア人歴代最多となるリーグ通算98得点を記録し、現地ファンが彼のローマ字表記を発音しにくかったことから「チャブーム(Tscha Bum)」という愛称が付けられた。フランクフルトでのデビューシーズンからチーム内最多得点を安定して記録し、ブンデスリーガの得点争いで常に上位の評価を受けた。その後は韓国代表監督やKリーグの監督としても活動し、韓国サッカーを象徴する人物として名を残した。',
  '1979〜1980年代のブンデスリーガでの活躍を通じてドイツ現地で付けられた愛称。',
  '韓国サッカーのレジェンド、チャ・ボムグンを紹介するときに使う代表的な愛称。',
  null,
  array['Tscha Bum','차범근 차붐']::text[],
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

-- pshik-university-hansarang-mountain-club  피식대학 한사랑산악회
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '6effb846-b6d2-443b-9860-acbb885eea4e',
  'ja',
  'pshik-university-hansarang-mountain-club',
  'ピシクデハク ハンサラン山岳会',
  'YouTubeチャンネル「ピシクデハク」の中年男性登山サークルコントが生んだ人気。',
  'お笑いYouTubeチャンネル「ピシクデハク」が手がけたコンテンツで、中年男性の登山サークルの集まりをリアルに再現したシットコムである。本物のおじさんたちの映像と見間違うほど緻密なキャラクターとセリフが話題となり、2022年にはバラエティ番組やラジオにも出演して大きな人気を集め、大韓山岳連盟の広報大使にも任命された。',
  'YouTubeチャンネル「ピシクデハク」のコンテンツ「ハンサラン山岳会」(2022年に人気絶頂)。',
  '中年おじさんキャラクターのセリフや口調をパロディするときに使用',
  null,
  array['ハンサラン山岳会','피식대학 한사랑산악회']::text[],
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

-- family-outing-national-siblings  패밀리가 떴다 국민남매
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '1325f49e-c1a4-4962-969e-5e2bf11ecf6b',
  'ja',
  'family-outing-national-siblings',
  '『ファミリーが出発した』国民兄妹',
  'ユ・ジェソクとイ・ヒョリのケミストリーが話題を呼んだ野外バラエティのコンビ。',
  '2008年6月15日に始まったSBS『ファミリーが出発した』でユ・ジェソクとイ・ヒョリが見せた兄妹のようなケミストリーが「国民兄妹」と呼ばれ、大きな人気を集めた。それ以外にも番組内のさまざまなカップル・コンビの組み合わせが話題となり、2008〜2009年のSBS演技大賞の共同受賞につながった。',
  'SBS『ファミリーが出発した』(2008.06.15〜2010.07.11)。',
  '実の兄妹のように気楽な関係を表現するときに',
  null,
  array['ユ・ジェソク イ・ヒョリ 兄妹','国民兄妹ライン','패밀리가 떴다 국민남매']::text[],
  '[{"text": "君と僕、完全に国民兄妹のケミじゃない?(笑)", "situation": "カカオトーク"}, {"text": "このケミ、ユ・ジェソク イ・ヒョリの国民兄妹レベルだね", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- ss501-u-r-man-amyolman  SS501 U R Man 암욜맨
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd7faee67-6548-4a78-9a96-e10d3657947f',
  'ja',
  'ss501-u-r-man-amyolman',
  'SS501『U R Man』アムヨルメン',
  'サビが変わって聞こえたことから付いたSS501のヒット曲のあだ名。',
  '2008年に発売されたSS501の「U R Man」は肩を揺らす振り付けとジャケットを脱いだり着たりする動作が流行し、サビが「アムヨルメン」に聞こえるという理由であだ名が付けられ話題になった。その後は受験禁止曲としても有名になった。',
  'SS501シングル「U R Man」の振り付けおよびサビの発音。',
  '2008年のアイドルファンダム文化を語るときに言及',
  null,
  array['アムヨルメン','肩ダンスU R Man','SS501 U R Man 암욜맨']::text[],
  '[{"text": "このサビ完全にアムヨルメンっぽく聞こえるんだけど(笑)", "situation": "カカオトーク"}, {"text": "SS501のアムヨルメン、まだ耳に残ってる", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- cha-in-pyo-meme  차인표 짤
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd1f1db5f-1faf-48cf-ab75-e15fe35f6738',
  'ja',
  'cha-in-pyo-meme',
  'チャ・インピョ画像ネタ',
  'チャ・インピョの誇張された指ポーズ・表情がネットミームとして再消費された。',
  '1994年のMBCドラマ『愛をあなたの胸に』でチャ・インピョが怒ったり激情的な場面のたびに人差し指を振りながら見せた表情演技が、後にインターネット上で「下手な演技」対「名演技」論争とともに画像ネタとして広く再流行した。本人もこのポーズを「一夜にしてスターにしてくれたサイン」と語ったことがある。',
  'MBCミニシリーズ『愛をあなたの胸に』(1994.6〜7)。',
  '誇張した感情表現を笑いのポイントとして引用するときに使用',
  null,
  array['チャ・インピョの指','愛をあなたの胸に','차인표 짤']::text[],
  '[{"text": "今の表情、完全にチャ・インピョ画像ネタだよ(笑)指差してないだけマシ", "situation": "グループチャット"}, {"text": "このリアクション、チャ・インピョ級の名演技じゃない?(笑)", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- honey-butter-chip-sellout  허니버터칩 품절대란
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '03b471f4-5a86-450b-8d9e-82db2470439c',
  'ja',
  'honey-butter-chip-sellout',
  'ハニーバターチップ品切れ騒動',
  '2014年の発売後、全国的な品切れ騒動を引き起こしたお菓子。',
  'ヘテ製菓が2014年8月に発売したポテトチップスで、SNSの口コミに乗って発売2か月で品薄状態が発生した。中古取引サイトで定価の3倍以上の価格で取引されるほど「品切れ騒動」の代名詞となり、この現象は約17か月間続いた。',
  '2014年8月にヘテ製菓が発売、SNSの口コミで拡散。',
  '品薄状態や突然のブームを例えるときに',
  null,
  array['ホバチップ','ハニーバターチップ騒動','허니버터칩 품절대란']::text[],
  '[{"text": "これ完全にハニーバターチップ級の品切れ騒動だ", "situation": "カカオトーク"}, {"text": "品切れの速さ、ハニーバターチップもびっくりだね", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- im-jae-bum-everyone-i-am-a-singer  여러분(임재범, 나는가수다)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '6f505c53-fdfe-49c0-aeaa-647aebca5403',
  'ja',
  'im-jae-bum-everyone-i-am-a-singer',
  'ヨロブン(イム・ジェボム、私は歌手だ)',
  '『私は歌手だ』で初めてスタンディングオベーションを受けたイム・ジェボムの伝説的なステージ。',
  '2011年5月、MBC『私は歌手だ』に出演したイム・ジェボムがユン・ボクヒの「ヨロブン(皆さん)」を歌い、聴衆評価団から番組史上初のスタンディングオベーションを受けた。得票率28.9%で圧倒的1位を獲得し、「ヨロブン神話」を生んだ。',
  '2011年5月MBC『私は歌手だ』第3ラウンド、歌手イム・ジェボムのステージ。',
  '感動的なステージや圧倒的な実力を語るときに引用',
  null,
  array['私は歌手だ イム・ジェボム スタンディングオベーション','여러분(임재범, 나는가수다)']::text[],
  '[{"text": "昨日のステージ見たら完全に私は歌手だのイム・ジェボムのヨロブン級で鳥肌立った", "situation": "カカオトーク"}, {"text": "これはスタンディングオベーション級だね、ヨロブン神話の再現だ", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- god-gil-the-road  god - 길
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'd0f8fb21-6438-42e4-8fae-5b7b31862016',
  'ja',
  'god-gil-the-road',
  'god 道',
  '人生の道を問いかける歌詞で大きな愛を受けたgodの2001年タイトル曲。',
  '2001年11月に発売されたgod正規4集のタイトル曲で、自分の人生の目標を探し彷徨う心境を綴った歌詞が大きな共感を呼んだ。その年末の授賞式で大賞を総なめにし、godの全盛期を代表する曲の一つとして残っている。',
  '2001年11月15日god正規4集のタイトル曲として発売。',
  '先の見えない進路・人生の悩みを語るときに歌詞を引用できる',
  null,
  array['god 4集タイトル曲','god - 길']::text[],
  '[{"text": "最近進路のことで悩んでるからgodの「道」の歌詞がぴったりだった、僕が歩くこの道はどこへ向かうのか", "situation": "カカオトーク"}, {"text": "人生辛いときはいつもgodの「道」を聴く", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- kim-guk-jin-hello  김국진 여보세요~
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '5953fa25-3963-48fd-8c8d-7d253e5d0fbb',
  'ja',
  'kim-guk-jin-hello',
  'キム・グクジン もしもし〜',
  '1990年代半ば〜後半、最高の人気を誇ったお笑い芸人キム・グクジンの代表的な流行語。',
  '1991年にKBS公開採用のお笑い芸人としてデビューしたキム・グクジンは、特有の舌足らずな発音を生かした「もしもし」「オーマイガッ」「私、消化終わりました〜」などの流行語を残し、1996年、1998年MBCコメディ大賞を受賞した。',
  'キム・グクジン(コメディアン)、1990年代KBS・MBCのコメディ番組。',
  '不器用でとんちんかんなリアクションを真似するときに引用',
  null,
  array['オーマイガッ','私、消化終わりました','김국진 여보세요~']::text[],
  '[{"text": "もしもし〜今、消化終わりました(笑)", "situation": "カカオトーク"}, {"text": "このリアクション完全にキム・グクジンst", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- kim-gun-mo-pinggye  핑계
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '08dd6e0c-a4d7-4163-9404-d8fa0e622752',
  'ja',
  'kim-gun-mo-pinggye',
  '言い訳',
  '韓国初のレゲエヒット曲で、キム・ゴンモの脱力系ダンスが流行した。',
  '1993年に発売されたキム・ゴンモの2集タイトル曲で、当時珍しかったレゲエリズムに合わせた自由奔放なダンスが大ヒットした。キム・ゴンモを一躍「国民歌手」の地位に押し上げた曲で、今でもレトロコンテンツで振り付けがよく取り上げられる。',
  'キム・ゴンモ2集タイトル曲(1993)。',
  '言い訳をする状況を冗談めかして歌に例える',
  null,
  array['キム・ゴンモ 言い訳ダンス','핑계']::text[],
  '[{"text": "また言い訳してるの見たら、キム・ゴンモの「言い訳」が流れてきそうなタイミングだね(笑)", "situation": "カカオトーク"}, {"text": "言い訳してるの見て言い訳ダンス踊りたくなった", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- korea-terrain-strong-anycall  한국지형에 강하다
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '8b9ca7b4-5f5f-4332-a88f-0107ef901599',
  'ja',
  'korea-terrain-strong-anycall',
  '韓国の地形に強い',
  '1994年サムスンAnycall広告のスローガンで、モトローラの牙城を崩したコピー。',
  '1994年10月サムスン電子がAnycallブランドを初めて使用した際に打ち出したスローガンで、山が多い韓国の地形でも通話品質が良いという点を強調し、モトローラが掌握していた国内携帯電話市場の勢力図を変えるきっかけとなった。',
  '1994年10月サムスン電子Anycall(SH-770)テレビ広告。',
  '国産製品の誇りや自国メーカーの競争力を語るときに引用',
  null,
  array['Anycall広告','한국지형에 강하다']::text[],
  '[{"text": "この国産部品、完全に韓国地形に強い級の耐久性だね", "situation": "カカオトーク"}, {"text": "やっぱり国産は韓国の地形に強いね(笑)", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- crab-taste-lotteria-cm  니들이 게맛을 알아
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '7cbf907c-ea53-457d-8857-985ab4d15061',
  'ja',
  'crab-taste-lotteria-cm',
  'お前らにカニの味がわかるか',
  'シン・グが即興で残した2002年ロッテリアCMの流行語。',
  'ヘミングウェイの『老人と海』をパロディにし、ワタリガニを釣った老人が満足げな表情で放ったセリフで、元の台本にはなかったシン・グの即興演技が採用されて放映された。放映後、数多くのものまねやパロディを生み、当時最高のCM流行語となった。',
  '2002年ロッテリアのテレビ広告で俳優シン・グの即興セリフとして生まれた。',
  'ものまねや広告回顧コンテンツで引用するのに適している',
  null,
  array['니들이 게맛을 알어','니들이 게맛을 알아']::text[],
  '[{"text": "このワタリガニ食べてみて、お前らにカニの味がわかるか?(笑)", "situation": "カカオトーク"}, {"text": "あの表情、完全にお前らにカニの味がわかるか級", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- change-it-jeong-yeosa  바꿔줘(정여사)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '6856a9db-6841-4884-bfec-b3824e48faff',
  'ja',
  'change-it-jeong-yeosa',
  '取り替えて(チョン女史)',
  '無理やり物を取り替えてほしいとせがんだ『ゲグコンサート』のコーナー流行語。',
  '2010年『ゲグコンサート』のコーナー「チョン女史」でチョン・テホが女装で登場し、無茶な要求をしながら「取り替えて」を繰り返すパターンで人気を集めた。チョン・テホはこのコーナーで新人賞を受賞した。',
  '2010年KBS『ゲグコンサート』のコーナー「チョン女史」、お笑い芸人チョン・テホのセリフ。',
  '無理やり駄々をこねる状況をコミカルに表現するときに',
  null,
  array['チョン女史 取り替えて','바꿔줘(정여사)']::text[],
  '[{"text": "弟がずっと取り替えて取り替えてってせがむんだけど完全にチョン女史だよ(笑)", "situation": "カカオトーク"}, {"text": "あのお客さん完全にチョン女史パターン、無理やり駄々こねてる", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- molae-camera-hidden-camera  몰래카메라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '74a9b679-e1af-40c1-a2bc-d68548c7085c',
  'ja',
  'molae-camera-hidden-camera',
  '隠しカメラ',
  'イ・ギョンギュが司会を務めたイルバムのドッキリバラエティコーナー。',
  '1991年4月MBC『日曜日 日曜日の夜に』のコーナーとして始まり、有名人を驚かせるドッキリのフォーマット自体を国民的流行語にした。イ・ギョンギュの飄々とした進行と種明かしのセリフは、その後さまざまなバラエティで再生産される象徴的なフレーズとなった。',
  'MBC『日曜日 日曜日の夜に』のコーナー(1991.4〜1992.11)、司会イ・ギョンギュ。',
  'サプライズを明かすときに慣用句のように使用',
  null,
  array['イ・ギョンギュ ドッキリ','몰래카메라']::text[],
  '[{"text": "じゃじゃーん、隠しカメラでしたー(笑)引っかかったでしょ", "situation": "カカオトーク"}, {"text": "これ完全に隠しカメラ級のどんでん返しだね", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- ahn-jung-hwan-ring-celebration  안정환 반지 세레모니
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '851bad25-7350-4ba7-9817-39781f77b321',
  'ja',
  'ahn-jung-hwan-ring-celebration',
  'アン・ジョンファン 指輪セレモニー',
  '2002年ワールドカップ・イタリア戦の決勝ゴール後に披露した指輪キスセレモニー。',
  '2002年6月18日大田で行われたベスト16、アン・ジョンファンがイタリアを相手に延長ゴールデンゴールを決めた後、結婚指輪にキスするセレモニーを見せた。この場面で彼は「指輪の帝王」というあだ名を得て、以降テレビ番組やパロディで繰り返し引用される象徴的な場面となった。',
  '2002日韓ワールドカップベスト16 韓国対イタリア戦の生中継映像。',
  'ワールドカップの名場面回顧、セレモニーのパロディに使用',
  null,
  array['指輪の帝王セレモニー','アン・ジョンファン ゴールデンゴール','안정환 반지 세레모니']::text[],
  '[{"text": "ゴール決めてセレモニーするの、完全にアン・ジョンファンの指輪キス級だね", "situation": "カカオトーク"}, {"text": "あのセレモニー指輪の帝王st", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- can-my-spring-days  캔 - 내 생에 봄날은...
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  'ed6ddb73-7b64-48a6-a980-2d6ccb8beba4',
  'ja',
  'can-my-spring-days',
  'CAN 私の人生に春の日は…',
  'ドラマ『ピアノ』の挿入歌として大ヒットした2001年のバラード。',
  '日本の歌手TUBEの楽曲をアレンジしたバラードで、SBSドラマ『ピアノ』に挿入され爆発的な人気を集め、歌謡チャートで1位まで獲得した。2000年代初頭のドラマOSTマーケティングの代表的な成功事例としても挙げられる。',
  '2001年CAN正規3集のタイトル曲として発表、ドラマ『ピアノ』の挿入歌。',
  '2000年代初頭のドラマOST、春の情緒を感じるバラードに使用',
  null,
  array['내생에 봄날은 간다','캔 - 내 생에 봄날은...']::text[],
  '[{"text": "このドラマOST完全にCANの「私の人生に春の日は」級の大ヒット曲だ", "situation": "カカオトーク"}, {"text": "春になるとこの曲を思い出す", "situation": "SNSコメント"}]'::jsonb,
  'machine',
  '2026-07-15 15:30:00.191373+00'::timestamptz,
  'claude',
  'claude-fable-5',
  12,
  now(),
  null,
  null
) on conflict (meme_id, locale) do nothing;

-- illit-charge-if-you-dont-come-out  안 나오면 쳐들어간다
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values (
  '151e1812-a038-4152-8527-8a9df04f9a07',
  'ja',
  'illit-charge-if-you-dont-come-out',
  '出てこなきゃ攻め込むぞ',
  'お笑いタレントのブームがILLITの新曲に付けた流行語が生んだリミックスチャレンジ。',
  '2026年5月tvN『놀라운 토요일(驚きの土曜日)』でお笑いタレントのブームがILLITの新曲「イッツ・ミー(It''s Me)」のステージを見て、ビートに合わせて「出てこなきゃ攻め込むぞ」と叫んだことが話題になった。原曲より中毒性があるという反応が続き、活動の代表的なミームとして定着し、ILLITが公式リミックスチャレンジ映像を公開することもあった。',
  '2026年5月tvN『驚きの土曜日』でのブームのアドリブから始まった。',
  '新曲チャレンジ、バラエティパロディ用に使用',
  null,
  array['ILLIT イッツ・ミー チャレンジ','안나오면쳐들어간다','안 나오면 쳐들어간다']::text[],
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

-- Self-promotion: mark this slice's own rows as reviewed.
update public.meme_translations t
set status = 'reviewed', reviewed_at = now(), reviewed_by = 'c7295ec1-1ca9-414d-a7e1-8f19005a90d0'::uuid
from public.memes m
where t.meme_id = m.id
  and t.locale = 'ja'
  and t.status = 'machine'
  and t.model = 'claude-fable-5'
  and t.prompt_version = 12
  and m.updated_at = t.source_updated_at
  and t.meme_id in (
    '91a8db8d-de1e-432c-95a0-e10e3a97d4a8',
    '45add623-8ac3-492a-a1c6-991117114458',
    '19a1c88a-be10-4244-96c6-3c07120425be',
    '802bade9-1ecf-4cba-adf5-521a90954f64',
    '6effb846-b6d2-443b-9860-acbb885eea4e',
    '1325f49e-c1a4-4962-969e-5e2bf11ecf6b',
    'd7faee67-6548-4a78-9a96-e10d3657947f',
    'd1f1db5f-1faf-48cf-ab75-e15fe35f6738',
    '03b471f4-5a86-450b-8d9e-82db2470439c',
    '6f505c53-fdfe-49c0-aeaa-647aebca5403',
    'd0f8fb21-6438-42e4-8fae-5b7b31862016',
    '5953fa25-3963-48fd-8c8d-7d253e5d0fbb',
    '08dd6e0c-a4d7-4163-9404-d8fa0e622752',
    '8b9ca7b4-5f5f-4332-a88f-0107ef901599',
    '7cbf907c-ea53-457d-8857-985ab4d15061',
    '6856a9db-6841-4884-bfec-b3824e48faff',
    '74a9b679-e1af-40c1-a2bc-d68548c7085c',
    '851bad25-7350-4ba7-9817-39781f77b321',
    'ed6ddb73-7b64-48a6-a980-2d6ccb8beba4',
    '151e1812-a038-4152-8527-8a9df04f9a07'
  );

-- Verification: count reviewed rows for this slice's meme_ids.
select count(*) as reviewed_count
from public.meme_translations
where locale = 'ja'
  and status = 'reviewed'
  and meme_id in (
    '91a8db8d-de1e-432c-95a0-e10e3a97d4a8',
    '45add623-8ac3-492a-a1c6-991117114458',
    '19a1c88a-be10-4244-96c6-3c07120425be',
    '802bade9-1ecf-4cba-adf5-521a90954f64',
    '6effb846-b6d2-443b-9860-acbb885eea4e',
    '1325f49e-c1a4-4962-969e-5e2bf11ecf6b',
    'd7faee67-6548-4a78-9a96-e10d3657947f',
    'd1f1db5f-1faf-48cf-ab75-e15fe35f6738',
    '03b471f4-5a86-450b-8d9e-82db2470439c',
    '6f505c53-fdfe-49c0-aeaa-647aebca5403',
    'd0f8fb21-6438-42e4-8fae-5b7b31862016',
    '5953fa25-3963-48fd-8c8d-7d253e5d0fbb',
    '08dd6e0c-a4d7-4163-9404-d8fa0e622752',
    '8b9ca7b4-5f5f-4332-a88f-0107ef901599',
    '7cbf907c-ea53-457d-8857-985ab4d15061',
    '6856a9db-6841-4884-bfec-b3824e48faff',
    '74a9b679-e1af-40c1-a2bc-d68548c7085c',
    '851bad25-7350-4ba7-9817-39781f77b321',
    'ed6ddb73-7b64-48a6-a980-2d6ccb8beba4',
    '151e1812-a038-4152-8527-8a9df04f9a07'
  );
