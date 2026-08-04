-- zh-tw meme translations slice 5 (delegated, 20 docs)
-- provider=claude, model=claude-fable-5, prompt_version=12
-- source_updated_at = memes.updated_at at query time (all rows 2026-07-15T15:30:00.191373+00:00)
-- read: GET /rest/v1/memes?id=in.(...)&select=id,title,summary,description,origin,usage_note,caution,aliases,usage_examples,updated_at (anon key)

-- Batch 1 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('67ac33f1-b8f1-4f3e-a7e5-29a94022c691','zh-tw','mukjjippa-opera-rita-meme','剪刀石頭布(歌劇《麗塔》)迷因','2015年歌劇《麗塔》中「主修剪刀石頭布」台詞於2024年被重新挖掘爆紅','演員崔載林、李暻秀主演的2015年歌劇《麗塔》中，兩名男子在剪刀石頭布對決前高唱自己「主修」項目的橋段，於2024年夏天在短影音平台被重新發現後爆紅。網友常以「事實上我大學時主修○○」的句型套入各種主題進行改編。','2015年歌劇《麗塔》演出影片於2024年7月左右在YouTube Shorts上被重新關注','用於煞有其事又滑稽地宣稱自己擅長某件事時的改編哏',null,array['事實上我大學時主修剪刀石頭布','剪刀石頭布學系','묵찌빠(오페라 리타) 밈'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('880c7149-2d93-407f-aa19-582e4fe309d4','zh-tw','hot-candy','H.O.T.〈Candy〉','1996年H.O.T.超級熱門歌曲〈Candy〉及其編舞','1996年發表的H.O.T.〈Candy〉是偶像團體史上首支超級熱門曲，深受各世代喜愛。Kangta的骰子舞、張佑赫的鐵鎚舞、文熙俊的金剛戰士舞等成員各自的招牌舞步相繼誕生，使這首歌成為第一代偶像粉絲文化的象徵。','身為H.O.T.首張專輯的後續曲，SM原本主推〈Candy〉作為主打歌，但依成員意見先發表了〈戰士的後裔〉。該曲因抄襲爭議中止活動後，才接續推出〈Candy〉，據悉作曲人張龍振與當時H.O.T.成員同齡、還是高中生。文熙俊的金剛戰士舞、張佑赫的鐵鎚舞等成員各自的編舞，加上毛帽、毛絨外套穿搭在青少年間掀起流行，使這首歌成為偶像史上首支超級熱門曲，同時也帶動了一波街頭時尚風潮。','可作為第一代偶像編舞文化的代表案例提及',null,array['Candy舞','骰子舞','H.O.T. 캔디'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('3ee79725-7120-4170-b3a5-8a0cc9bf164c','zh-tw','thank-you-sato-gg-sato','謝謝你，佐藤(G.G.佐藤)','以2008年北京奧運韓日戰中失誤的日本外野手佐藤之名而生的反諷感謝哏','在2008年北京奧運棒球準決賽韓日之戰中，日本代表隊選手G.G.佐藤未接住高永珉打出的高飛球而失誤，間接助韓國隊獲勝。轉播球評許球淵在轉播中脫口而出「謝謝你，佐藤」，此後每當國際賽事中對手球員的重大失誤讓韓國隊得利時，網友便會以「謝謝你，○○」來調侃，逐漸成為固定哏。時隔十餘年，這一幕仍被稱為「世紀落球」而被人津津樂道。','2008年北京奧運韓日之戰的失誤畫面，以及球評許球淵的發言','用於國際賽事中對手失誤讓韓國佔便宜時，以反諷語氣表達感謝的哏。',null,array['G.G.佐藤','世紀落球','고마워요 사토 (G.G.사토)'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('48653a33-c3d5-4ee4-9670-330c1a145118','zh-tw','ppap-pen-pineapple-apple-pen','PPAP(筆-鳳梨-蘋果-筆)','日本諧星Piko太郎創作的洗腦短曲，在全球與韓國掀起流行的國際迷因','2016年8月25日，Piko太郎（古坂大魔王）在YouTube上傳的短片，以簡單反覆的歌詞與舞步如洗腦神曲般迅速擴散，甚至被CNN稱為「新江南Style」而風靡全球。韓國於2016年10月正式發行音源，《SNL Korea》的權赫秀、TWICE的子瑜與彩瑛等人也紛紛模仿演出，掀起熱潮。','2016年8月由日本藝人Piko太郎於YouTube公開，隨後擴散至全球','常作為短小荒誕的惡搞內容素材',null,array['筆鳳梨蘋果筆','Piko太郎','PPAP (펜-파인애플-애플-펜)'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('43b7c300-94ef-46b0-8064-5b1dbefb0697','zh-tw','gfriend-rough-dance-challenge','GFRIEND〈Rough(時間穿越而來)〉編舞挑戰','以激烈旋轉動作掀起話題的GFRIEND〈Rough〉編舞翻跳熱潮','2016年1月發行的GFRIEND〈Rough(時間穿越而來)〉，因成員在舞台上多次跌倒仍堅持跳完全曲的激烈編舞而引發話題，這種拚盡全力的形象搭配「神友(갓자친구)」的暱稱獲得廣大迴響。編舞翻跳影片數量爆炸性增長，截至2019年相關影片已多達四萬餘支。','2016年1月GFRIEND發行〈Rough(時間穿越而來)〉，激烈編舞引發話題','常被引用作為展現拚勁與努力的編舞案例',null,array['GFRIEND《時間穿越而來》翻跳','旋轉編舞','여자친구 ''시간을 달려서'' 안무 챌린지'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 2 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('56eaf9a9-f4c2-42ad-94e5-2552246b843c','zh-tw','twice-tt-face-finger-challenge','TWICE〈TT〉表情‧手勢挑戰','TWICE〈TT〉如表情符號般的表情與手指姿勢掀起的編舞挑戰','2016年10月發行的TWICE〈TT〉，以模仿字母TT(哭臉表情符號)的手指姿勢與表情編舞為特色，發行後翻跳與模仿姿勢的挑戰迅速暴增。在2016年MAMA舞台上與〈CHEER UP〉一同演出的組合舞台，被譽為當年最具代表性的K-pop表演之一。','2016年10月TWICE發行〈TT〉，編舞亮點掀起流行','常用於模仿可愛編舞亮點的內容創作',null,array['TWICE TT表情','TT姿勢','TT 표정·손가락 챌린지 (트와이스)'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('cd878fab-b5a2-439d-b375-ab55a530150b','zh-tw','rain-bad-guy','Rain(비) - 壞男人','歌手兼演員Rain(비)2002年個人出道主打歌','2002年5月發行的Rain個人出道專輯主打歌，由朴軫永參與作詞作曲。此後Rain以後續曲〈不說再見〉獲得更大迴響，成長為2000年代最具代表性的男性個人歌手。','2002年5月13日作為Rain首張專輯主打歌發行','常在談論Rain出道初期時被提及',null,array['Rain出道曲','비 - 나쁜 남자'],'[{"text": "你聽過Rain出道初期的〈壞男人〉嗎？", "situation": "KakaoTalk聊天"}, {"text": "這首歌可是Rain的起點呢", "situation": "社群媒體留言"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('3d6d5fb3-22f6-44d8-bcf4-7cba42362065','zh-tw','into-the-arena','Into the Arena','申海澈為2002世界盃創作的加油歌曲，收錄於官方應援專輯','歌手申海澈為配合2002年韓日世界盃而創作的加油歌曲，收錄於世界盃官方應援專輯《夢想成真》的第一首曲目。這首歌被認為對「大~韓民國」拍手節奏的音樂化擴散有所貢獻。','申海澈配合2002年世界盃創作，收錄於官方應援專輯','常作為2002世界盃應援文化的背景音樂被提及',null,array['申海澈世界盃應援歌','《夢想成真》收錄曲','Into the Arena'],'[{"text": "這次幫忙加油播申海澈的Into the Arena吧", "situation": "KakaoTalk聊天"}, {"text": "說到2002應援歌就不能漏掉這首", "situation": "社群媒體留言"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('d661eec7-a57d-476d-b066-af32ff114b60','zh-tw','who-coughed-taejo-wanggeon','是誰咳嗽的','電視劇《太祖王建》中弓裔在施展觀心法時斥責咳嗽臣子的畫面，多年後意外爆紅成為迷因','此為2000年KBS大河劇《太祖王建》第80集中，弓裔施展觀心法時因臣子咳嗽聲而勃然大怒的畫面。播出當時並未引發太大話題，直到2015年左右才在網路社群被重新挖掘，並以替換咳嗽處的詞語進行改編的方式廣為流傳，成為經典迷因。','2000年KBS《太祖王建》第80集弓裔場景，2015年左右重新爆紅','用於諷刺對荒謬或瑣碎小事反應過度的情況',null,array['弓裔觀心法圖','咳嗽聲迷因圖','누가 기침 소리를 내었는가'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('c2a24029-dd2d-46f8-a36b-f0e0f4e7236b','zh-tw','ordinary-high-school-girl-doodle','常見女高中生的無聊小舉動','韓國女高中生把手臂當圓規揮動、畫出完美圓形的7秒影片，2021年成為全球熱議的迷因','此為2021年5月3日上傳的影片，畫面中一名女高中生把手臂當圓規揮動，在黑板上畫出一個完美圓形，隨後說出「啊，怎麼這麼空虛啊」的反應。完成度極高的圓形、優雅的動作與雲淡風輕的反應相互襯托，使這支影片不僅在韓國國內、也在海外網友間廣為人知，成為迷因。','韓國一名女高中生的黑板畫圓影片(2021年5月3日上傳)','適合用來形容看似平凡卻出奇厲害的才藝',null,array['黑板畫圓','흔한 여고생들의 뻘짓'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 3 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('8bbdf79d-aa64-4f10-8d51-88ac4a645a9e','zh-tw','lee-jung-hyun-wa-bakkwo','李貞賢〈換掉吧〉‧〈哇〉','1999年李貞賢展現的顛覆性Techno造型概念','1999年10月發行的李貞賢〈哇〉，帶動了當年下半年的Techno熱潮，人氣延續近四個月。畫著獨眼圖案的紅色扇子、套在小指上的麥克風，以及讓人聯想到巫俗服飾的裝扮，以象徵世紀末氛圍的顛覆造型引發話題，後續曲〈換掉吧〉中的機械翅膀造型同樣話題十足。','此造型概念源自1999年10月20日發行的李貞賢首張專輯《Let''s Go To My Star》主打歌〈哇〉。紅色獨眼扇、手指麥克風、長髮簪與帶有巫俗氛圍的服裝等顛覆性造型，據悉當時前衛到連公司內部都曾強烈反對。這股概念將席捲1999年下半年歌壇的Techno熱潮推向全民風潮，也讓李貞賢獲得「Techno女戰士」的稱號。','可作為1999年世紀末Techno造型概念的代表案例提及',null,array['換掉吧','哇','獨眼扇','이정현 ''바꿔''·''와'''],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('de173441-cc53-46db-adbc-aa003f846e3e','zh-tw','naruto-run','火影忍者跑','模仿《火影忍者》中上身前傾、雙臂後甩的招牌忍者跑步姿勢的迷因','《火影忍者》系列中忍者們上身向前傾、雙臂向後甩的獨特奔跑姿勢，真人模仿以此姿勢奔跑的惡搞影片曾風靡全球。在韓國也知名到被官方火影忍者遊戲廣告採用，如今仍不斷有人在公共場所以此姿勢奔跑並拍成挑戰影片分享。','《火影忍者》動畫(2002年播出)中的忍者跑步姿勢','廣泛用於真人惡搞、Cosplay等影片內容',null,array['火影忍者奔跑','Naruto Run','나루토 런'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('c0a77629-01fb-437d-b2a2-4be1be7bdf07','zh-tw','dubai-chewy-cookie-syndrome','杜拜黏韌餅乾(두쫀쿠)熱潮','杜拜黏韌餅乾在2026年初掀起排隊搶購熱潮的甜點流行','「두쫀쿠」是「杜拜黏韌餅乾」的簡稱，指以棉花糖麵團包裹卡達伊夫酥絲與開心果奶油醬製成的餅乾。此甜點自2025年底開始口耳相傳，2026年初在全國掀起開店搶購與提前售罄的熱潮。社群媒體打卡曬圖與從眾效應相互加乘，使其擴散速度極快，DIY自製教學影片也隨之流行，甚至還被介紹到海外，引發熱議。','衍生自2022年流行的杜拜巧克力，於2026年初在韓國國內爆紅','常作為甜點開箱、吃播內容的素材',null,array['杜拜黏韌餅乾','두쫀쿠','두쫀쿠 신드롬'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('889daeb1-58c5-4476-91a1-84f5b73a8707','zh-tw','shinkansen-derailment-shot','新幹線大脫軌射門','韓國網友為嘲諷錯失輕鬆得分機會的日本前鋒射門而取的迷因名稱','日本前鋒柳澤敦在球門前大好機會下大幅射失，韓國網友調侃這一幕彷彿行駛中的新幹線突然脫軌，因此取名為「新幹線大脫軌射門」。這一幕出現的比賽中，日本原本領先澳洲，卻在下半場連丟三球遭逆轉落敗。此後，這個說法被廣泛用來調侃錯失輕鬆得分機會的荒謬情況。','韓國網友為日本足球國家隊比賽中關鍵射門失誤的畫面所取的名稱','用來調侃錯失關鍵機會的足球選手的說法。',null,array['신칸센 대탈선슛'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('7ba7be7c-0a33-4e4c-8bc8-5969101c75df','zh-tw','girls-generation-forever-1-15th-anniversary','少女時代《FOREVER 1》出道15週年','為紀念出道15週年、少女時代全員回歸推出的專輯與主打歌','少女時代為慶祝出道15週年，於2022年8月以全員回歸的專輯《FOREVER 1》回歸歌壇。主打歌再度邀請當年為少女時代創作出道曲的Kenzie操刀，並在全球31個地區的iTunes專輯榜奪冠，引發熱烈迴響，9月更舉辦了大型粉絲活動。','少女時代出道15週年紀念全員回歸專輯《FOREVER 1》(2022年8月發行)','常在談論長年天團全員回歸時被引用',null,array['FOREVER 1','소녀시대 Forever 1 15주년'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 4 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('44051e47-450c-4704-8fe5-49d69ba1a215','zh-tw','storm-zerg-hong-jinho','暴風蟲族','洪辰浩兇猛蟲族戰術風格的稱號','此為2001年可口可樂盃OnGameNet星海爭霸聯賽等賽事中，與林堯煥展開激烈決賽而嶄露頭角的洪辰浩獲得的稱號。因其打法猶如暴風般凌厲、擅長以數量壓制對手的攻勢戰術，被稱為「暴風蟲族」。此後這個稱號連同他屢屢屈居亞軍、被稱為「萬年老二」的形象，成為洪辰浩的代表稱號。','2001年OnGameNet星海爭霸聯賽，作為洪辰浩的稱號開始流通','常用來稱呼星海爭霸早期表現令人印象深刻的選手',null,array['洪辰浩暴風蟲族','폭풍저그'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('63fd8794-1005-422c-901b-16ed99f25efa','zh-tw','pour-vs-dip-sauce-debate','淋醬派 vs 沾醬派','圍繞糖醋肉該淋醬吃還是沾醬吃、永無止盡的爭論哏','2013年《無限挑戰》中鄭俊夏將醬汁直接淋上糖醋肉、劉在錫出言反對的畫面引發話題，經2014年遊戲社群的二次創作後，於2018年左右成為廣為人知的哏。如今已成為「沒有結論的無謂爭論」的代名詞，藝人與政治人物也常被問及這個問題，並持續被各種二創與綜藝節目重複拿來使用。','起因於2013年《無限挑戰》的畫面，於2018年左右普及化','常作為輕鬆討論個人喜好差異的話題',null,array['淋醬沾醬之爭','부먹 vs 찍먹'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('d51b8be9-be9a-4c75-bed9-955ff8f5caf4','zh-tw','naniga-suki-challenge','「何がスキ？」(喜歡什麼)告白挑戰','以《LoveLive!》企劃團體歌曲歌詞創作的告白最愛挑戰','配合動畫《LoveLive!》企劃團體AiScReam歌曲〈愛♡スクリーム！〉中「何がスキ？(喜歡什麼？)」的歌詞，說出自己喜歡的對象的挑戰。2025年3月登上日本TikTok與韓國Spotify病毒榜冠軍，IVE、NMIXX、Kep1er、BOYNEXTDOOR等偶像團體也紛紛參與。','2025年3月源自日本動畫《LoveLive!》企劃團體歌曲，隨後擴散至整個亞洲','適用於告白最愛、表達喜愛之情的內容',null,array['나니가스키','何がスキ','愛♡スクリーム挑戰','나니가스키 챌린지'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('5a70b638-0aa4-4135-a57f-c57918a535cf','zh-tw','bbikki-bbikki-challenge','삐끼삐끼(Bbikki Bbikki)挑戰','起源於起亞啦啦隊員影片、席捲全球的手勢舞蹈挑戰','起亞老虎隊啦啦隊員李珠恩的短影音爆紅後帶動的舞蹈，特色動作是豎起拇指、手臂呈ㄴ字形上下擺動。背景音樂是印尼DJ混音改編自H.O.T.出身的張佑赫、Tony An、李在元組成的JTL〈My Lecon〉的「Out Song」。2024年下半年席捲海內外社群媒體。','2024年6月YouTube頻道「내맘찍영」上傳的起亞啦啦隊員李珠恩短影音','適合在歡樂氣氛中跟著跳',null,array['삐끼삐끼舞','Out Song挑戰','삐끼삐끼 챌린지'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('80517a0d-8172-4349-b802-fa80a0f39382','zh-tw','twice-look-at-me-challenge','TWICE〈Look at Me(날 바라바라봐)〉挑戰','2017年TWICE專輯收錄曲因海外粉絲發起的挑戰，於2024年逆勢翻紅的案例','〈Look at Me(날 바라바라봐)〉是收錄於TWICE 2017年首張正規專輯中的一首歌，當時並未受到太多關注。然而2024年海外粉絲以簡單編舞發起的「Look at Me」挑戰在TikTok上擴散開來，TWICE成員本人也親自參與挑戰，進一步帶動人氣。最終在TikTok公布的「Year on TikTok 2024」中登上韓國年度歌曲冠軍。','2017年作為TWICE首張正規專輯收錄曲發行，2024年因海外粉絲發起的「Look at Me」挑戰而逆勢翻紅，登上TikTok「Year on TikTok 2024」韓國年度歌曲冠軍。','適用於簡單編舞挑戰影片，或介紹「逆勢翻紅歌曲」的內容',null,array['Look at Me挑戰','날 바라바라봐舞蹈','트와이스 날 바라바라봐 챌린지'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Promote (self-review) rows for docs in this slice
update public.meme_translations t
set status='reviewed', reviewed_at=now(), reviewed_by='c7295ec1-1ca9-414d-a7e1-8f19005a90d0'::uuid
from public.memes m
where t.meme_id = m.id
  and t.locale = 'zh-tw'
  and t.status = 'machine'
  and t.model = 'claude-fable-5'
  and t.prompt_version = 12
  and m.updated_at = t.source_updated_at
  and t.meme_id in (
  '67ac33f1-b8f1-4f3e-a7e5-29a94022c691'::uuid,
  '880c7149-2d93-407f-aa19-582e4fe309d4'::uuid,
  '3ee79725-7120-4170-b3a5-8a0cc9bf164c'::uuid,
  '48653a33-c3d5-4ee4-9670-330c1a145118'::uuid,
  '43b7c300-94ef-46b0-8064-5b1dbefb0697'::uuid,
  '56eaf9a9-f4c2-42ad-94e5-2552246b843c'::uuid,
  'cd878fab-b5a2-439d-b375-ab55a530150b'::uuid,
  '3d6d5fb3-22f6-44d8-bcf4-7cba42362065'::uuid,
  'd661eec7-a57d-476d-b066-af32ff114b60'::uuid,
  'c2a24029-dd2d-46f8-a36b-f0e0f4e7236b'::uuid,
  '8bbdf79d-aa64-4f10-8d51-88ac4a645a9e'::uuid,
  'de173441-cc53-46db-adbc-aa003f846e3e'::uuid,
  'c0a77629-01fb-437d-b2a2-4be1be7bdf07'::uuid,
  '889daeb1-58c5-4476-91a1-84f5b73a8707'::uuid,
  '7ba7be7c-0a33-4e4c-8bc8-5969101c75df'::uuid,
  '44051e47-450c-4704-8fe5-49d69ba1a215'::uuid,
  '63fd8794-1005-422c-901b-16ed99f25efa'::uuid,
  'd51b8be9-be9a-4c75-bed9-955ff8f5caf4'::uuid,
  '5a70b638-0aa4-4135-a57f-c57918a535cf'::uuid,
  '80517a0d-8172-4349-b802-fa80a0f39382'::uuid
  );

-- Verification: reviewed row count for this slice's meme_ids
select count(*) as reviewed_count from public.meme_translations t
where t.locale = 'zh-tw' and t.status = 'reviewed' and t.meme_id in (
  '67ac33f1-b8f1-4f3e-a7e5-29a94022c691'::uuid,
  '880c7149-2d93-407f-aa19-582e4fe309d4'::uuid,
  '3ee79725-7120-4170-b3a5-8a0cc9bf164c'::uuid,
  '48653a33-c3d5-4ee4-9670-330c1a145118'::uuid,
  '43b7c300-94ef-46b0-8064-5b1dbefb0697'::uuid,
  '56eaf9a9-f4c2-42ad-94e5-2552246b843c'::uuid,
  'cd878fab-b5a2-439d-b375-ab55a530150b'::uuid,
  '3d6d5fb3-22f6-44d8-bcf4-7cba42362065'::uuid,
  'd661eec7-a57d-476d-b066-af32ff114b60'::uuid,
  'c2a24029-dd2d-46f8-a36b-f0e0f4e7236b'::uuid,
  '8bbdf79d-aa64-4f10-8d51-88ac4a645a9e'::uuid,
  'de173441-cc53-46db-adbc-aa003f846e3e'::uuid,
  'c0a77629-01fb-437d-b2a2-4be1be7bdf07'::uuid,
  '889daeb1-58c5-4476-91a1-84f5b73a8707'::uuid,
  '7ba7be7c-0a33-4e4c-8bc8-5969101c75df'::uuid,
  '44051e47-450c-4704-8fe5-49d69ba1a215'::uuid,
  '63fd8794-1005-422c-901b-16ed99f25efa'::uuid,
  'd51b8be9-be9a-4c75-bed9-955ff8f5caf4'::uuid,
  '5a70b638-0aa4-4135-a57f-c57918a535cf'::uuid,
  '80517a0d-8172-4349-b802-fa80a0f39382'::uuid
  );
