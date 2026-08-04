-- ja slice 8: 20 meme translations (machine -> reviewed)
-- generated for memecatch loop-050, ja locale, prompt_version=12, model=claude-fable-5

-- batch ending at row 5
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('9c2d304d-8053-4448-8e1f-f700c82e8e33','ja','maekeun-maekeun-hada-challenge','「ツルツルしている」チャレンジ','フランス出身の振付師カニが韓国語の形容詞を覚えながら踊ったダンスが話題になったミーム。','2025年10月29日、YouTubeバラエティ番組『カニを探して』第20話で、カニが「ツルツルしている、ツルツルした、平らだ、平らな(プンプンだ)」など韓国語の形容詞を繰り返しながら即興で踊った場面が話題になった。その後ヘンボカンピザパンによるリミックス動画が人気を集め、SHINeeのキーをはじめTWS、HEARTS2HEARTS、ZEROBASEONEなどのアイドルたちが真似して踊り、大学修学能力試験の時期と重なったことから「修能禁止曲」というあだ名も付いた。','YouTubeバラエティ『カニを探して』EP.20の形容詞暗記シーン。','中毒性のあるダンスチャレンジの事例として紹介しやすい。',null,array['매끈매끈하다 챌린지','매끈매끈한','카니를 찾아서','수능 금지곡(2025)'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('c4647c65-bf96-4465-b0df-c9772cb03f07','ja','park-jisung-two-hearts','パク・チソン「二つの心臓」','疲れ知らずの豊富な運動量から付いたパク・チソンの代表的な愛称。','パク・チソンはマンチェスター・ユナイテッド時代、試合中ずっと疲れを見せずピッチを駆け回る圧倒的な運動量から「二つの心臓」というあだ名を得た。イギリス現地では「Three-Lung Park(三つの肺)」という表現で彼のスタミナを称えたこともある。実際に彼の分時心拍数は40回程度で、長期間鍛え抜かれたスポーツ心臓の典型例としても紹介された。','2000年代半ば、マンチェスター・ユナイテッド在籍時の活躍を通じて定着。','パク・チソンの卓越した運動量とスタミナを語る際に使われる代表的な愛称。',null,array['박지성 두 개의 심장','Three-Lung Park'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('8b03db9e-2152-4fdb-a21c-77398d5c998f','ja','ongamenet-starleague-launch','オンゲームネット・スターリーグ発足','1999~2000年、韓国国内eスポーツプロリーグ文化の始まり。','1999年の「''99 PKO」を先駆けとし、2000年の「フリーチャル杯」から正式に「スターリーグ」の名称が使われ始めたオンゲームネット・スターリーグは、オープン型スタジオと観客席を導入し、韓国国内のeスポーツ観戦文化を大衆化させた出発点となった。','韓国国内のeスポーツリーグ文化は1999年の「''99 PKO」大会を発端に始まり、2000年のハナロ通信杯トゥーニバース・スターリーグから初めて「スターリーグ」という名称が使われた。この大会の興行的成功を受け、2000年7月24日にファン・ヒョンジュンの提案でゲーム専門チャンネル「オンゲームネット」が開局し、契約職員3~4人が倉庫部屋から始めた放送局が、やがて80人規模の専門放送局へと成長した。同時期の2000年2月、21世紀プロゲーム協会(現・韓国eスポーツ協会)創立式で文化観光部長官が「eスポーツ」という用語に言及し、この呼称が社会的に通用し始めた。','韓国国内eスポーツ産業の出発点として言及できる。',null,array['온게임넷 스타리그 출범','스타리그','''99 PKO'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('111277eb-652c-4e7b-a474-8be535e21b1a','ja','gieogui-seupjak','記憶の習作','1994年に電覧会(チョルラムフェ)ことキム・ドンリュルが発表し、長く愛されているバラードの名曲。','1993年の大学歌謡祭大賞出身のデュオ「電覧会」が1994年に発表した「記憶の習作」は、ダンスやレゲエが主流だった当時、叙情的なバラードで大衆の心をとらえた。作詞・作曲・編曲をすべて手がけたキム・ドンリュルの繊細なメロディーが特徴で、2012年公開の映画『建築学概論』に挿入曲として使われたことで、再び大きな人気を集めた。','キム・ドンリュルとソ・ドンウクは1993年12月、MBC大学歌謡祭に2人組デュオ「電覧会」として出場し、大賞と特別賞を受賞した。翌1994年、シン・ヘチョルやキム・ヒョンソクらが制作に参加した1stアルバム『Exhibition』を発表し、その1曲目に収録されたのが「記憶の習作」だった。2012年の映画『建築学概論』への起用をきっかけに音源チャートを逆走し、世代を超えて韓国バラードの代表曲として位置づけられている。','1990年代の名バラードを語る際の代表例として挙げられる。',null,array['기억의 습작','電覧会 記憶の習作'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('da72423d-7a4c-4f54-9e40-4eb18ea6d1bf','ja','pick-me-syndrome','「私だよ、私(PICK ME)」シンドローム','『PRODUCE 101 シーズン2』のテーマ曲が生んだ国民的オーディションシンドローム。','2017年4月から6月にかけて放送されたMnet『PRODUCE 101 シーズン2』のテーマ曲「私だよ、私(PICK ME)」は、練習生たちの群舞とともに上半期の歌謡・放送界を揺るがすシンドロームを巻き起こした。この番組を通じて結成されたグループWanna Oneは2017年8月にデビューし爆発的な人気を得て、楽曲と振り付けは各種バラエティ・イベントで定番のパロディネタとなった。','Mnet『PRODUCE 101 シーズン2』のテーマ曲(2017年)。','オーディション番組シンドロームと群舞パロディのネタとして言及される。',null,array['나야 나(PICK ME) 신드롬','워너원 나야나','국프 나야나'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- batch ending at row 10
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('47150dcf-062e-422a-b52e-71913716e2ac','ja','hongsimat-hongsira-saenggak','「柿の味がしたから柿だと思っただけなのに」','2003年ドラマ『宮廷女官チャングムの誓い』で幼いチャングムが見せた禅問答のような返答が流行語に。','MBCドラマ『宮廷女官チャングムの誓い』で、幼いチャングムが肉の味を「柿の味」と表現し、理由を問い詰める尚宮(サングン)に対して循環論法的に答えた場面が話題になった。テレビをつければどこかでパロディが流れるほど流行した。','2003年9月29日放送のMBC『宮廷女官チャングムの誓い』第5話でのセリフ。','論理的に噛み合わない答えを冗談めかして指摘する際に引用される。',null,array['홍시맛이 나서 홍시라 생각했는데','홍시맛이 나서 홍시라 생각한 것이온데'],'[{"text": "だから何でそうなったのって~柿の味がしたから柿だと思っただけなのにww", "situation": "カカオトーク"}, {"text": "この返し、完全に循環論法だ", "situation": "SNSコメント"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('436ddcf5-5521-49ad-9a1c-32fb14ce0393','ja','lee-malnyeon-series','イ・マルニョン・シリーズ','DCインサイド出身の作家イ・マルニョンによる不条理ギャグウェブトゥーン、2009年デビュー作。','DCインサイドでアマチュア漫画家として活動していたイ・マルニョンが「燃えるバス」などで注目を集めた後、2009年に正式ウェブトゥーン『イ・マルニョン・シリーズ』でデビューした。論理的な脈絡を無視した突拍子もない展開と不条理ギャグで爆発的な人気を集め、不条理系ウェブトゥーンの代表格となった。','DCインサイドでのアマチュア漫画連載活動を経て正式ウェブトゥーンとしてデビュー。','不条理ギャグウェブトゥーンの元祖として言及される。',null,array['이말년 씨리즈','이말년씨리즈'],'[{"text": "この展開、完全にイ・マルニョン・シリーズ級の不条理さだ", "situation": "カカオトーク"}, {"text": "不条理ギャグウェブトゥーンの元祖はイ・マルニョンでしょ", "situation": "SNSコメント"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('1849c6f7-e13a-49a1-89a6-a13c87ec42d5','ja','choi-dongwon-seon-dongyeol-rivalry','チェ・ドンウォン&ソン・ドンヨル 鉄腕対決','1987年、延長15回完投の引き分けで語り継がれるKBO史上最高峰の投手対決。','1987年5月16日、釜山サジク球場でロッテのチェ・ドンウォンと海太(ヘテ)のソン・ドンヨルが、それぞれ209球・232球を投げ延長15回を完投し、2-2の引き分けに終わった。二人はそれ以前にも2度先発対決を行い、1勝ずつを分け合っている。2022年のKBOリーグ40周年「レジェンド40人」投票ではソン・ドンヨルが1位、チェ・ドンウォンが2位となり、この対決が改めて話題になった。','1987年5月16日のロッテ対海太戦、2022年KBO40周年レジェンド投票で再び脚光を浴びた。','史上最高の投手対決を語る際に引用されるKBOのレジェンド伝説。',null,array['최동원-선동열 무쇠팔 라이벌전','チェ・ドンウォンの鉄腕','ソン・ドンヨル&チェ・ドンウォンの引き分け'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('47a82b00-1c73-4829-ba79-3c6b2ac305be','ja','pc-tongsin-modem-sound','PC通信モデム接続音','1990年代のPC通信・初期インターネットを象徴するダイヤルアップモデムの接続音。','1990年代、ハイテルやナウヌリなどのPC通信に接続する際に鳴った「ピー、ガガガガ、ザーッ」という独特のダイヤルアップモデム接続音は、当時のインターネット世代に強いノスタルジーを呼び起こすシンボリックな音として記憶されている。誰かが電話を取ると接続が切れてしまう状況もよくあった。','1990年代前半~中盤、ハイテル・天里眼(チョルリアン)・ナウヌリなどのPC通信に接続する際、電話回線を通じて聞こえた「ピー、ザザザ、シュー」というダイヤルアップモデムの信号音を指す。電話回線でデジタル信号をやり取りするためのハンドシェイク過程で鳴る音で、当時の利用者の間では「トイレの水を流す音」や「悲鳴」などと呼ばれ、一種のミームとして通用していた。ブロードバンド網の普及後は姿を消したが、この音をサンプリングした音源やYouTubeの懐古動画が絶えず作られており、1980~90年代に学生時代を過ごした世代のノスタルジーを刺激する文化的記号として残っている。','PC通信時代の思い出を語る際、この音を真似て懐かしむことができる。',null,array['PC통신 모뎀 접속음','모뎀 접속 소리'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('9d430343-4454-4433-a0f8-ca4f27395272','ja','sky-castle-sseaengnim','『SKYキャッスル』の「スェンニム」','ドラマ『SKYキャッスル』で女優ヨム・ジョンアの「先生(ソンセンニム)」の発音が生んだ流行語。','2018年に放送されたJTBCドラマ『SKYキャッスル~上流階級の妻たち~』で、ヨム・ジョンア演じるハン・ソジンが受験コーディネーターのキム・ジュヨン(キム・ソヒョン)にすがりつきながら「先生(ソンセンニム)」を「スェンニム」のように発音した場面が話題になった。このほか劇中の様々なセリフも次々と流行語となり、パロディやものまねが続いた。','JTBCドラマ『SKYキャッスル』ハン・ソジン(ヨム・ジョンア)のセリフ(2018年)。','誰かを必死に説得する状況をパロディする際に使われる。',null,array['SKY 캐슬 쓰앵님','아갈머리','혜나는 누가 죽였나요'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- batch ending at row 15
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('1f6a0eef-6fe0-4508-a3ab-8abe3ced086a','ja','hiddink-still-hungry','ヒディンク「私はまだ腹が減っている」','2002年ワールドカップでベスト16進出後に語られたヒディンク監督の謙虚な名言。','2002年日韓ワールドカップで自国史上初のベスト16進出に満足しかけた選手たちに、グース・ヒディンク監督が贈った言葉。さらに大きな目標に向けて慢心しないようにという意味合いで、その後さまざまな分野で「満足せずもっと前へ進もう」という意味の引用句として広く使われるようになった。','2002年日韓ワールドカップ韓国代表監督グース・ヒディンクのインタビュー発言。','目標達成後に謙虚さと前進を強調する際に引用される。',null,array['히딩크 나는 아직 배가 고프다','まだ腹が減っている','ヒディンク語録'],'[{"text": "目標は達成したけど、私はまだ腹が減っている", "situation": "カカオトーク"}, {"text": "この考え方、完全にヒディンク式だね", "situation": "SNSコメント"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('7e246da6-a151-4445-bc0d-dd88b18cfc6b','ja','kawaikute-gomen','可愛くてごめん','日本のユニットHoneyWorksの楽曲に合わせて投げキッスと頬タッチをするダンスチャレンジ。','日本のクリエイターユニットHoneyWorksによるキャラクターソングで、2022年11月にミュージックビデオが公開された後、歌詞に合わせて投げキッスをしたり、謝るように頬に手を当てたりする振り付けのダンスチャレンジがTikTokで大きく流行した。2022年8月に同人版が先に広まり人気を得て、同年12月にはK-POPアイドルのメンバーたちもダンス動画を投稿し、国内外に拡散した。','日本のユニットHoneyWorksによる楽曲「可愛くてごめん」のミュージックビデオ公開(2022年11月)。','可愛いコンセプトの短いダンスチャレンジで、誰でも真似しやすい。',null,array['귀여워서 미안해','可愛くてごめん'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('9b4cc86f-09ce-475c-bb83-c1ffcbab309e','ja','minecraft-inde-challenge','「マインクラフトなんだけど」チャレンジ','マインクラフト系YouTuberウォンダの楽曲「四角なんだけど」に自分のキャラを登場させて参加するチャレンジ。','アメリカのYouTuber camman18の「Minecraft, but」ショート動画フォーマットを、韓国のYouTuberイビオンが「マインクラフトなんだけど」シリーズとして取り入れたのが始まりで、2024年5月24日にマインクラフト系YouTuberのウォンダがゲムマトク・クムサヒャンをフィーチャリングに迎えたデジタルシングル「四角なんだけど」を発表した。ウォンダが自分のキャラクターを登場させられる配布ファイルを公開したことで、多くのYouTuberが「マインクラフトなんだけど」チャレンジに参加した。','YouTuberウォンダのデジタルシングル「四角なんだけど」と自キャラ配布ファイル。','ゲーム系YouTuberのコラボチャレンジ事例として紹介できる。',null,array['마인크래프트인데 챌린지','네모인데','원다 네모인데'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('7cc58443-34af-46ea-b6ce-7d2dd54c8ffd','ja','luksam-eo','ルカ語(ルクサム語)','チジク配信者ルクサム特有のなまった発音から生まれた新造の隠語体系。','ハースストーンの元プロゲーマーで配信者のルクサムの、独特に転がすような発音から派生した隠語群を「ルカ語」と呼ぶ。2025年9月初旬の『デッドバイデイライト』コラボ配信ブームの時期に他の配信者たちと絡む中で急速に広まり、ルクサム本人も知らない派生語が生まれると、作った人の名前を付けて「〇〇トゥリ」と呼ぶ。','チジク配信者ルクサムの発音の特徴から派生した視聴者の隠語。','チジク配信の視聴者間で使われる隠語で、文脈を知らないと理解しづらい。','ファンダム内輪の用語のため、一般的な場で使うと意味が伝わらない可能性がある。',array['룩어','Looker','룩삼어'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('984b4bc5-357d-4334-8632-0086d6697368','ja','yeolsimhi-ilhan-dangsin-tteonara','「一生懸命働いたあなた、旅立て」','2001年、現代カードの広告に登場した旅行を勧めるキャッチコピー。','2001年の現代カードCMで俳優チョン・ジュノとチャン・ジニョンが出演し伝えた「一生懸命働いたあなた、旅立て」というコピーは、休暇や旅行を勧める慣用句として定着した。その後も旅行関連の文句としてパロディされながら長く引用された。','現代カードのテレビ広告から生まれたコピーで、汗を流して働く場面と自然へ旅立つ場面を対比させて伝えた。BGMはサイモン&ガーファンクルの「The Boxer」だった。斬新で洗練された映像美で話題を集め流行語となり、その後企業のリストラ期には「一生懸命働いたあなた、(会社を)去れ」と皮肉って使われるなど、社会的な文脈に合わせてパロディされることもあった。広告放映時期は2001年とされているが、話題性を扱った主要記事は2002年に報じられた。','休暇や旅行を勧める際にそのまま引用して使える。',null,array['열심히 일한 당신, 떠나라','열일당신 떠나라','現代カードのコピー'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- batch ending at row 20
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('dc46243d-f704-4519-ba01-bca3819b8be4','ja','be-the-reds-tshirt','「Be the Reds」Tシャツ','2002年ワールドカップの国民的ユニフォームとなった赤い「Be the Reds」Tシャツ。','プルグナクマ(赤い悪魔)サポーターズが作ったフレーズ「Be the Reds!」をプリントした赤いTシャツで、2002年5月の発売から1か月で数十万枚が売れ、全国民が着る「国民ユニフォーム」となった。その後、デザインの著作権をめぐる訴訟でも話題になった。','プルグナクマ公式サポーターズグッズとして2002年発売、デザイナーはパク・ヨンチョル。','2002年ワールドカップの熱気を象徴するグッズとして言及できる。',null,array['Be the Reds 티셔츠','비더레즈','붉은악마 티셔츠'],'[{"text": "今回の応援、Be the Redsのお揃いのTシャツ着よう", "situation": "カカオトーク"}, {"text": "あの頃の国民ユニフォームだったよね", "situation": "SNSコメント"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('1866f498-f749-41b1-98f4-de2d1723f95a','ja','namjaui-jagyeok-nella-fantasia','『男の資格』青春合唱団 ネラ・ファンタジア','高齢出演者だけで構成し「ネラ・ファンタジア」ブームを引き継いだ『男の資格』の合唱特集。','2009~2013年に放送されたKBS『男の資格』の「ハーモニー」特集で「ネラ・ファンタジア」ブームを巻き起こした「男格合唱団」に続き、メンバーを高齢者だけで構成した「青春合唱団」特集が制作された。パク・カルリンが指揮を務め、カリスマ性のある指導で話題を集めた。2011年10月末の青春合唱団終了を機に、脚本家イ・ウジョンが番組を降板した。','KBS『男の資格』ハーモニー特集から派生し、青春合唱団は2011年に終了した。','感動系バラエティの合唱フォーマットの元祖として言及される。',null,array['남자의 자격 청춘합창단 넬라 판타지아','男格合唱団','青春合唱団'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('2c7e2c44-0937-47f3-ade4-af273ce4a49e','ja','jeong-ilyeong-hwabeop-meme','チョン・イルヨン先生の話法ミーム','침착맨(チムチャンメン)配信に出演した仁荷大学フランス語講師の独特な対応法が話題になったミーム。','仁荷大学校フランス語講師チョン・イルヨンが2024年パリ五輪シーズンにYouTube配信「침착맨(チムチャンメン)」に出演し、「地下鉄の切符なしで乗って捕まったとき」「フランスで不当な扱いを受けたとき」などの対処法を独特の話し方で説明したことが話題になった。「私たちは○○するお客様です」「パトロン(責任者)を呼んでこい!」といった表現が、視聴者の間でさまざまな状況に応用されるミームとなった。','2024年パリ五輪シーズンのYouTube番組「침착맨」出演回。','不当な扱いに堂々と立ち向かう状況を表現する際に引用される。','ミームが誤って伝わり、事実と異なる内容(兵役関連など)で広まった事例があり、訂正報道が出たことがある。',array['정일영 선생님 화법 밈','정일영 선생님'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('b4354c93-bfd9-4fc3-b24b-d5e1f944b3f0','ja','balletcore','バレエコア','バレエ衣装のシルエットを普段着に取り入れたTikTok発のファッション美学。','レオタード、ラップスカート、レッグウォーマー、バレエフラットなど、バレエ衣装の要素をカジュアルに組み合わせるスタイル。TikTokやInstagramで「balletcore」のハッシュタグとともに広まり、リボン装飾とパステルトーンの組み合わせが特徴。韓国国内ではRed Velvetの「Feel My Rhythm」やNewJeansのグラビアなどと結び付けて知られるようになった。','2020年代初め、TikTok/Instagramで「バレエ(ballet)」と「ノームコア(normcore)」の合成語として名付けられ、2022年後半のRed Velvetのカムバックを機に韓国国内でも検索量が急増した。','バレエフラットやレッグウォーマーなどでコーディネートした優雅なルックを紹介する際に使う。',null,array['발레코어','발레코어룩','balletcore'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;
insert into public.meme_translations
  (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by)
values
  ('ddee812b-43f0-428f-b4ef-4133ff504ed8','ja','amazon-express-ceremony','アマゾンエクスプレス・セレモニー','遊園地のラフティング施設のキャストダンスが、後になってミームとして再発見された事例。','エバーランドのアマゾンエクスプレスで2006年から行われてきたキャストたちの「アマゾン歓迎セレモニー」サプライズダンスパフォーマンスが、2019年にウォークマンなどのウェブバラエティ撮影やYouTuberユンチュックの動画で紹介されたことをきっかけに、突然大衆的なミームとして流行した。ラップはユンチュックが作り、作曲・振り付けはギジョンジャン(班長)のソン・ヨンフンが担当した。','エバーランドのアマゾンエクスプレスのキャストダンス、オンラインで再脚光(2019年)。','盛り上がる遊園地ダンスのネタとして言及できる。',null,array['아마존 익스프레스 세레모니','아마존 환영 세레모니'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- promote own rows to reviewed
update public.meme_translations t
set status='reviewed', reviewed_at=now(), reviewed_by='c7295ec1-1ca9-414d-a7e1-8f19005a90d0'::uuid
from public.memes m
where t.meme_id = m.id
  and t.locale = 'ja'
  and t.status = 'machine'
  and t.model = 'claude-fable-5'
  and t.prompt_version = 12
  and m.updated_at = t.source_updated_at
  and t.meme_id in ('9c2d304d-8053-4448-8e1f-f700c82e8e33'::uuid,'c4647c65-bf96-4465-b0df-c9772cb03f07'::uuid,'8b03db9e-2152-4fdb-a21c-77398d5c998f'::uuid,'111277eb-652c-4e7b-a474-8be535e21b1a'::uuid,'da72423d-7a4c-4f54-9e40-4eb18ea6d1bf'::uuid,'47150dcf-062e-422a-b52e-71913716e2ac'::uuid,'436ddcf5-5521-49ad-9a1c-32fb14ce0393'::uuid,'1849c6f7-e13a-49a1-89a6-a13c87ec42d5'::uuid,'47a82b00-1c73-4829-ba79-3c6b2ac305be'::uuid,'9d430343-4454-4433-a0f8-ca4f27395272'::uuid,'1f6a0eef-6fe0-4508-a3ab-8abe3ced086a'::uuid,'7e246da6-a151-4445-bc0d-dd88b18cfc6b'::uuid,'9b4cc86f-09ce-475c-bb83-c1ffcbab309e'::uuid,'7cc58443-34af-46ea-b6ce-7d2dd54c8ffd'::uuid,'984b4bc5-357d-4334-8632-0086d6697368'::uuid,'dc46243d-f704-4519-ba01-bca3819b8be4'::uuid,'1866f498-f749-41b1-98f4-de2d1723f95a'::uuid,'2c7e2c44-0937-47f3-ade4-af273ce4a49e'::uuid,'b4354c93-bfd9-4fc3-b24b-d5e1f944b3f0'::uuid,'ddee812b-43f0-428f-b4ef-4133ff504ed8'::uuid);

-- verification
select count(*) as reviewed_count
from public.meme_translations
where locale = 'ja'
  and status = 'reviewed'
  and model = 'claude-fable-5'
  and prompt_version = 12
  and meme_id in ('9c2d304d-8053-4448-8e1f-f700c82e8e33'::uuid,'c4647c65-bf96-4465-b0df-c9772cb03f07'::uuid,'8b03db9e-2152-4fdb-a21c-77398d5c998f'::uuid,'111277eb-652c-4e7b-a474-8be535e21b1a'::uuid,'da72423d-7a4c-4f54-9e40-4eb18ea6d1bf'::uuid,'47150dcf-062e-422a-b52e-71913716e2ac'::uuid,'436ddcf5-5521-49ad-9a1c-32fb14ce0393'::uuid,'1849c6f7-e13a-49a1-89a6-a13c87ec42d5'::uuid,'47a82b00-1c73-4829-ba79-3c6b2ac305be'::uuid,'9d430343-4454-4433-a0f8-ca4f27395272'::uuid,'1f6a0eef-6fe0-4508-a3ab-8abe3ced086a'::uuid,'7e246da6-a151-4445-bc0d-dd88b18cfc6b'::uuid,'9b4cc86f-09ce-475c-bb83-c1ffcbab309e'::uuid,'7cc58443-34af-46ea-b6ce-7d2dd54c8ffd'::uuid,'984b4bc5-357d-4334-8632-0086d6697368'::uuid,'dc46243d-f704-4519-ba01-bca3819b8be4'::uuid,'1866f498-f749-41b1-98f4-de2d1723f95a'::uuid,'2c7e2c44-0937-47f3-ade4-af273ce4a49e'::uuid,'b4354c93-bfd9-4fc3-b24b-d5e1f944b3f0'::uuid,'ddee812b-43f0-428f-b4ef-4133ff504ed8'::uuid);
