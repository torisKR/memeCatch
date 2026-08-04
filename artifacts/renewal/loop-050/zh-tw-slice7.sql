-- 밈 사전 zh-tw 번역 적용 (슬라이스 7, 담당 문서 20건)
-- provider=claude, model=claude-fable-5, prompt_version=12
-- source_updated_at = 조회 시점 memes.updated_at 그대로 사용 (모든 행 2026-07-15T15:30:00.191373+00:00)
-- 조회: GET /rest/v1/memes?id=in.(...)&select=id,title,summary,description,origin,usage_note,caution,aliases,usage_examples,updated_at (anon key)

-- Batch 1 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('bc68f5c4-2104-4d62-95e5-1e74d6111fbe','zh-tw','sechskies-hakwon-byeolgok','SECHSKIES〈學園別曲〉','1997年SECHSKIES充滿反抗精神的出道曲','1997年出道的SECHSKIES主打歌〈學園別曲〉,以批判升學主義教育現實的反抗歌詞與強烈的表演,獲得廣大青少年共鳴,宣告了與H.O.T.並駕齊驅的第一代偶像團體誕生。','SECHSKIES於1997年4月15日在KMTV《Show Music Tank》以出道曲〈學園別曲〉首次登台,同年5月14日發行同名出道專輯。歌詞正面批判成績至上主義等當時升學教育的問題,將國樂打令調融入饒舌的獨特編曲,搭配高難度特技群舞,在青少年間引發話題,並打入歌謠TOP10排行榜前十名。這首歌是與H.O.T.共同開啟第一代偶像兩強格局的信號彈,作為帶有反抗訊息的偶像出道曲,被認為影響了後續世代的團體。','可作為第一代偶像出道曲的代表案例提及',null,array['젝스키스 ''학원별곡''','學園別曲'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('aa390efd-1ba1-44c6-b493-2b046462ff4d','zh-tw','hearthstone-hakkar-drawing-quote','「欸~抽這麼多牌的話？」','룩삼在使用哈卡爾牌組自滅時留下的《爐石戰記》經典台詞','源自2018年12月《爐石戰記》實況主룩삼(金鎮孝)在排位賽中使用靈魂掠奪者哈卡爾牌組時,明知抽牌過多會有危險卻停不下來,最終自滅時留下的這句話。此後成為爐石粉絲圈用來形容「明知危險卻停不下來」情境的代表流行語。','2018年12月實況主룩삼(金鎮孝)的《爐石戰記》直播發言','用於形容明知有風險卻停不下來的情況',null,array['어~ 그렇게 드로우를 많이 하면?'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('8e975be3-2469-4c4a-a776-a84dbae6ed0b','zh-tw','unbreakable-spirit-world-cup','重要的是不屈的心','2022年卡達世界盃期間成為韓國國家足球隊象徵的加油標語','這句原本流行於電競粉絲圈的用語,在2022年11至12月卡達世界盃小組賽期間,韓國隊先在對烏拉圭、加納兩戰表現低迷,卻在對葡萄牙一戰戲劇性逆轉晉級16強後,迅速被用來形容代表隊不屈不撓的鬥志而廣為流傳。媒體、社群與各類廣告紛紛以縮寫反覆引用,使其成為2022年下半年最具代表性的流行語。此後,這句話也廣泛用於運動、考試、求職等艱難情境下表達不放棄的決心。','2022卡達世界盃韓國代表隊晉級16強過程中重新受到矚目的加油標語','可用於任何人在艱難處境中表達不放棄決心或互相打氣時',null,array['중요한 건 꺾이지 않는 마음','중꺾마'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('3840e458-bfec-497c-bd91-574ca6c4f019','zh-tw','hwang-hee-chan-shirtless-celebration','黃喜燦脫衣慶祝動作','2022年世界盃對葡萄牙戰役絕殺後,黃喜燦脫下球衣的慶祝動作','2022年卡達世界盃小組賽最終戰對葡萄牙,補時階段黃喜燦攻入致勝球後脫下球衣慶祝,因而吃到黃牌警告。這記進球助韓國時隔12年闖進世界盃16強,他脫衣慶祝的畫面與「乳牛」綽號也因此成為熱門話題。','2022卡達世界盃小組賽韓國對葡萄牙,黃喜燦的致勝球慶祝動作','用來形容戲劇性的勝利或痛快淋漓的瞬間',null,array['황희찬 웃통 탈의 세리머니','黃喜燦致勝球慶祝','乳牛'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('9266e072-5ccb-4386-99cd-14e631972eff','zh-tw','baby-shark-challenge','鯊魚寶寶挑戰','跟著Pinkfong〈鯊魚家族〉舞蹈跳舞並上傳社群媒體的挑戰','2018年夏天,Pinkfong〈鯊魚家族(Baby Shark)〉舞蹈版影片在美國、歐洲爆炸性擴散,連名人都加入這股跳舞挑戰熱潮。艾倫·狄珍妮、詹姆士·柯登等海外明星紛紛參與,韓國國內也不只小孩,連大人之間都因其洗腦旋律而掀起話題。','SmartStudy(Pinkfong)〈Baby Shark Dance〉影片(2016年首度上傳,2018年演變為挑戰擴散)','提及K內容全球爆紅案例時可引用',null,array['아기상어 챌린지','鯊魚寶寶舞蹈挑戰','Baby Shark Challenge'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 2 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('2f6da376-12eb-4c66-88b1-96bb4b5eb07d','zh-tw','liverpool-mid-table-song','利中噠(利物浦排中游剛剛好)','源自於對足球教練發言的聳動誤譯報導,經甘斯特改編歌曲而爆紅的足球迷因','2014年桑德蘭主帥古斯·波耶特曾說「若沒有蘇亞雷斯,利物浦大概只能排在中游」,韓國媒體卻聳動翻譯報導為「利物浦排中游剛剛好」,由此衍生出這個說法。實況主甘斯特將宋大琯的歌曲《流行歌》改編歌詞,唱出「利中噠 利中噠 好聽的歌」,使其廣為流傳。此後,每當提到利物浦相關話題,便常被當作帶點調侃意味的引用,成為足球社群裡的固定迷因。','2014年古斯·波耶特教練發言遭誤譯報導+實況主甘斯特改編歌曲爆紅','用於足球、利物浦相關的哏',null,array['리중딱(리버풀은 중위권이 딱이야)','利物浦排中游剛剛好','利中噠改編曲'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('3a805bf1-982b-451d-8a15-7348c96a0bda','zh-tw','seo-taiji-ultraman-song','徐太志〈我是鹹蛋超人〉','首日就創下90萬張首週銷量的徐太志2000年回歸作品','這首徐太志正規六輯主打歌,將當時在韓國尚屬陌生的新金屬曲風帶入主流市場。發行首日首週銷量便達90萬張,創下歷代首週銷量紀錄,並以描寫沉迷單一事物的「狂熱者」心理的顛覆性音樂風格引發話題。','2000年9月8日徐太志正規六輯主打歌回歸','用於談論徐太志回歸或2000年代初搖滾、金屬曲風時',null,array['서태지 - 울트라맨이야','徐太志六輯主打歌'],'[{"text":"這張專輯首週銷量根本徐太志〈我是鹹蛋超人〉等級","situation":"KakaoTalk聊天"},{"text":"那個年代徐太志回歸的影響力真的誇張","situation":"社群留言"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('7ed5b9ee-ea54-4490-befb-0a475fcf0e8a','zh-tw','woo-young-woo-whale-fantasy','禹英禑鯨魚幻想','患有自閉症的主角每次解決問題時腦中浮現鯨魚的CG畫面','在劇集《奇怪的律師禹英禑》中,每當主角禹英禑想出完美解決方案時畫面便出現巨大鯨魚,若非如此則出現海豚,以此呈現她的想像場景。劇中禹英禑答出的鯨魚謎題「鯨魚不會下蛋」也同步引發話題,2022年播出期間成為極高人氣的迷因。','ENA劇集《奇怪的律師禹英禑》(2022年)中的演出畫面與台詞','用於比喻靈光乍現、想出好點子的時刻',null,array['우영우 고래 상상','禹英禑鯨魚謎題'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('b445d585-f77d-4ed3-9a92-f6dc413c058b','zh-tw','shinhwa-top','SHINHWA〈T.O.P〉','1999年SHINHWA二輯主打歌,取樣《天鵝湖》的熱門金曲','1999年發行的SHINHWA二輯主打歌〈T.O.P〉取樣柴可夫斯基《天鵝湖》,引發話題,精緻的編舞與整齊劃一的群舞動作,使SHINHWA自此正式走紅,成為人氣的轉捩點。','SHINHWA於1999年發表二輯主打歌〈T.O.P(Twinkling of Paradise)〉,登上歌謠排行節目冠軍。整首歌取樣柴可夫斯基芭蕾舞劇《天鵝湖》其中一曲〈情景〉的旋律,將古典樂與舞曲結合的獨特編曲引發話題。當時「取樣」概念在韓國尚屬陌生,一度演變為抄襲爭議,但由於原曲來源已被公開並正式使用,多數評價認為並非嚴格意義上的抄襲。這首歌被視為第一代偶像時代的代表金曲,也是SHINHWA初期的代表作之一。','可作為古典樂取樣舞曲的代表案例提及',null,array['신화 ''T.O.P''','T.O.P'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('3dc10a1e-6671-46b5-8281-8ffd149f4d5d','zh-tw','jjilleo-man-stickman','刺客人','以《星海爭霸》狂熱者為原型的火柴人動畫系列','1990年代末至2000年代初連載於獵奇屋、幽默世界等網站的火柴人動畫系列,角色造型以線上遊戲《星海爭霸》中的「狂熱者」單位為原型。','「찔러(刺客人)」是筆名「北瑟尼」創作的火柴人角色動畫,1990年代末至2000年代初於獵奇屋、幽默世界等Flash社群網站連載並廣受歡迎。角色以《星海爭霸》狂熱者單位為原型登場,是當時流行的火柴人動作片代表系列之一。2000年代初獵奇屋沒落、火柴人Flash整體人氣消退後,作者仍透過「Flash365」、「茶壺網」等平台持續活動,並於2008年開設Naver Cafe公開設定與製作近況,但此後未再連載。','可作為졸라맨系火柴人文化的衍生案例提及',null,array['찔러맨','찔러'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 3 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('8fc75170-5bff-4ac0-ad4b-146ec93e06e5','zh-tw','squid-game-freeze-musical-remix','木頭人(傑夫普)','YouTuber傑夫普把《魷魚遊戲2》中「木頭人！」台詞改編成音樂劇風格的迷因音樂','在《魷魚遊戲》第二季中,成奇勳(李政宰飾)在「一二三木頭人」遊戲時一臉認真地對參賽者大喊「木頭人！」,YouTuber傑夫普將這個場景改編成音樂劇歌曲般的風格進行混音。與原作殘酷氛圍形成反差的歡快編曲成為笑點,上線5天觀看次數便突破160萬。','YouTuber傑夫普製作的《魷魚遊戲2》台詞音樂劇混音','用作將嚴肅情境幽默反轉的混音迷因',null,array['얼음(제프프)','魷魚遊戲木頭人音樂劇'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('1e9b2e28-60a2-49d0-a2e8-96ef5fc847bd','zh-tw','pop-cat','啵嘴貓(Pop Cat)','貓咪看著蟲子一開一合嘴巴的影片,2020年底在韓國以點擊遊戲形式爆紅的迷因','一隻名叫「奧特米爾」的貓咪盯著蟲子開合嘴巴的影片,被剪輯配上啵嘴音效後成為風靡全球的迷因。2020年12月在韓國開始流行,人氣延續至2021年1月,2021年8月各國點擊排行活動中,韓國網友甚至集體衝刺點擊以拉抬名次。','剪輯自貓咪「奧特米爾」影片的全球迷因,2020年12月在韓國流行','適合用來形容單純重複卻很有趣的動圖',null,array['팝캣','Pop Cat','啵嘴貓'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('2b77cfc7-5ef3-4ae0-accc-970b6df9630c','zh-tw','gag-concert-forehead-guy','《Gag Concert》額頭仔','以撞額頭肢體笑點聞名的2006年《Gag Concert》單元','自2006年8月起播出的《Gag Concert》單元,禿頭造型的鄭鐘哲以撞額頭的肢體笑點,搭配「巷口大哥額頭仔!把額頭仔當什麼看~」的流行語爆紅。','2006年8月27日至2007年3月於KBS《Gag Concert》播出的單元,鄭鐘哲、金時德、金大範、朴俊亨以拍打額頭的肢體笑點演出。原型據傳是六年前在大學路小劇場演出的「小混混小混混是混混」,經改編搬上Gag Concert舞台後大受歡迎。該單元被評為振興當時陷入低潮的Gag Concert之作,並被改編為金賢秀導演執導的兒童劇場版電影。當時浦項制鐵外籍球員丹尼爾森在慶祝進球時模仿額頭仔動作,因此獲得「丹頭仔」的綽號。','搭配肢體笑點以帶點玩鬧的方式使用',null,array['개그콘서트 마빡이','額頭仔'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('cc07b206-7c81-4780-a51e-17e139ba332f','zh-tw','yoajeong-yogurt-ice-cream','優格冰淇淋的正解','優格冰淇淋品牌「요아정」與其甜蜜組合於2024年在社群媒體爆紅的迷因','以蜂巢蜜與新鮮水果配料為特色的優格冰淇淋品牌「요아정」,在2024年夏天透過Instagram、TikTok大幅走紅。曾有IU粉絲詢問對方是否知道「요아정」,對方誤聽成「妖精」而答非所問的軼事也引發話題。在年輕女性族群中被譽為此生必吃甜點,各種蜜糖組合推薦內容也隨之大量湧現。','「요거트아이스크림의정석」品牌於2024年透過Instagram、TikTok擴散','談論甜點、人生必吃美食時使用',null,array['요아정','優格冰淇淋的正解','蜜糖組合'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('0af67ded-43c6-4273-a375-e0c5c6596dad','zh-tw','dubai-chocolate-syndrome','杜拜巧克力症候群','開心果奶油巧克力透過TikTok爆紅,2024年在韓國掀起熱潮的現象','2023年12月,杜拜一家巧克力品牌的影片在TikTok上引發數月熱議,這股風潮於2024年夏天登陸韓國。民眾為了搶購內含卡達伊夫(中東式炸麵絲)與開心果奶油的巧克力,造成便利商店接連缺貨。這波熱潮甚至一度推高了開心果的價格。','2023年底源自杜拜的TikTok影片擴散,2024年在韓國掀起熱潮','用於談論流行甜點或海外爆紅商品時',null,array['두바이초콜릿 신드롬','杜拜巧克力'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 4 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('69528101-01d5-443d-8077-db730f6ceed1','zh-tw','our-mom-meme','「我媽媽生的」迷因','Stray Kids昌彬改編NewJeans〈OMG〉副歌所引發的2023年自問自答迷因','2023年初,在Stray Kids自製內容《SKZ聊天室》中,昌彬將NewJeans〈OMG〉副歌「Oh my oh my God」改唱成「是誰生得這麼漂亮?我媽媽生的」,因而爆紅成為迷因。他一臉高傲自問自答的模樣引發爆笑,並帶動其他偶像與粉絲跟風二次創作。','Stray Kids自製內容《SKZ聊天室》第56集(約2023年1月)','用於幽默地自吹自擂時',null,array['우리 엄마엄마가 밈','媽媽生的','昌彬媽媽生的'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('db138d82-b0be-468c-b65c-b1af8b876628','zh-tw','jimin-like-crazy-challenge','智旻〈Like Crazy〉挑戰','跟著防彈少年團智旻個人出道曲〈Like Crazy〉編舞跳舞的2023年全球挑戰','2023年3月發行的智旻首張個人正規專輯主打歌〈Like Crazy〉登上Billboard Hot 100冠軍,獲得全球性成功,隨之而來的編舞挑戰也在社群媒體上擴散。歌手太陽等人也參與了這波挑戰。','智旻個人正規一輯《FACE》主打歌〈Like Crazy〉(2023年3月24日發行)宣傳挑戰','作為全球K-POP個人挑戰迷因使用',null,array['지민 Like Crazy 챌린지','Like Crazy挑戰','智旻個人挑戰'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('a6efab03-d735-44ad-bbe0-a85d0eb870e5','zh-tw','sechskies-disbandment','SECHSKIES解散','第一代偶像SECHSKIES無預警宣布解散並舉行告別舞台','1997年出道的SECHSKIES於2000年5月18日召開記者會,無預警宣布解散,兩天後以夢想演唱會(Dream Concert)舞台作為活動終點。後來外界得知,隊長銀志源提議在受粉絲喜愛之際離開,是促成解散的關鍵。','2000年5月18日成員自發宣布解散,5月20日夢想演唱會告別舞台','用於回顧第一代偶像文化、2000年代初粉絲文化時',null,array['젝스키스 해체','SECHSKIES解散宣言'],'[{"text":"提到第一代偶像解散,就會想起SECHSKIES","situation":"KakaoTalk聊天"},{"text":"這場告別舞台真的看到哭","situation":"社群留言"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('d8827144-e48f-4972-b9d1-34793e2a790c','zh-tw','heopop-slime-challenge','HeoPop史萊姆挑戰','2015年透過YouTube傳入韓國的史萊姆(液體怪物)製作、玩樂內容熱潮','2015年左右源自海外的史萊姆熱潮透過YouTube登陸韓國,以HeoPop為首的實驗、兒童內容創作者紛紛上傳製作各種顏色與質地史萊姆的影片,在低齡族群間掀起旋風式人氣。HeoPop於2015年4月與CJ旗下MCN DIA TV簽約,成為代表這股潮流的創作者。','2015年海外史萊姆風潮透過YouTube擴散至韓國','可作為兒童、實驗內容流行案例引用','部分史萊姆材料曾引發有害物質爭議,提及安全相關內容時可作參考',array['허팝 액체괴물(슬라임) 챌린지','史萊姆挑戰'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('34db3403-c1e5-4bbf-8d3c-2a932f453d41','zh-tw','tokyo-olympics-pictogram-meme','東京奧運圖標人迷因','2021年東京奧運開幕式的項目介紹默劇表演在全球引發話題後形成的迷因','2021年7月23日的東京奧運開幕式上,日本舞蹈默劇組合「GABEZ」以肢體演出東奧全部50個項目的「圖標人動作串」表演。這段表演影片在YouTube上突破1000萬次觀看,國內外掀起大量以「圖標人」、「圖標帝」等綽號為主題的二次創作。','2020東京奧運開幕式(2021年7月23日)GABEZ的圖標人表演','適合用來形容用肢體巧妙表現事物的表演',null,array['도쿄올림픽 픽토그램 밈','圖標人','圖標帝'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- ---------------------------------------------------------------------------
-- Self-promotion: mark this slice's freshly inserted machine translations as
-- reviewed. Guarded by model/prompt_version match and source_updated_at ==
-- current memes.updated_at (i.e. source hasn't changed since translation).
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
  'bc68f5c4-2104-4d62-95e5-1e74d6111fbe',
  'aa390efd-1ba1-44c6-b493-2b046462ff4d',
  '8e975be3-2469-4c4a-a776-a84dbae6ed0b',
  '3840e458-bfec-497c-bd91-574ca6c4f019',
  '9266e072-5ccb-4386-99cd-14e631972eff',
  '2f6da376-12eb-4c66-88b1-96bb4b5eb07d',
  '3a805bf1-982b-451d-8a15-7348c96a0bda',
  '7ed5b9ee-ea54-4490-befb-0a475fcf0e8a',
  'b445d585-f77d-4ed3-9a92-f6dc413c058b',
  '3dc10a1e-6671-46b5-8281-8ffd149f4d5d',
  '8fc75170-5bff-4ac0-ad4b-146ec93e06e5',
  '1e9b2e28-60a2-49d0-a2e8-96ef5fc847bd',
  '2b77cfc7-5ef3-4ae0-accc-970b6df9630c',
  'cc07b206-7c81-4780-a51e-17e139ba332f',
  '0af67ded-43c6-4273-a375-e0c5c6596dad',
  '69528101-01d5-443d-8077-db730f6ceed1',
  'db138d82-b0be-468c-b65c-b1af8b876628',
  'a6efab03-d735-44ad-bbe0-a85d0eb870e5',
  'd8827144-e48f-4972-b9d1-34793e2a790c',
  '34db3403-c1e5-4bbf-8d3c-2a932f453d41'
  );

-- ---------------------------------------------------------------------------
-- Verification: count reviewed rows among this slice's 20 meme_ids.
-- ---------------------------------------------------------------------------
select count(*) as reviewed_count
from public.meme_translations
where locale = 'zh-tw'
  and status = 'reviewed'
  and meme_id in (
  'bc68f5c4-2104-4d62-95e5-1e74d6111fbe',
  'aa390efd-1ba1-44c6-b493-2b046462ff4d',
  '8e975be3-2469-4c4a-a776-a84dbae6ed0b',
  '3840e458-bfec-497c-bd91-574ca6c4f019',
  '9266e072-5ccb-4386-99cd-14e631972eff',
  '2f6da376-12eb-4c66-88b1-96bb4b5eb07d',
  '3a805bf1-982b-451d-8a15-7348c96a0bda',
  '7ed5b9ee-ea54-4490-befb-0a475fcf0e8a',
  'b445d585-f77d-4ed3-9a92-f6dc413c058b',
  '3dc10a1e-6671-46b5-8281-8ffd149f4d5d',
  '8fc75170-5bff-4ac0-ad4b-146ec93e06e5',
  '1e9b2e28-60a2-49d0-a2e8-96ef5fc847bd',
  '2b77cfc7-5ef3-4ae0-accc-970b6df9630c',
  'cc07b206-7c81-4780-a51e-17e139ba332f',
  '0af67ded-43c6-4273-a375-e0c5c6596dad',
  '69528101-01d5-443d-8077-db730f6ceed1',
  'db138d82-b0be-468c-b65c-b1af8b876628',
  'a6efab03-d735-44ad-bbe0-a85d0eb870e5',
  'd8827144-e48f-4972-b9d1-34793e2a790c',
  '34db3403-c1e5-4bbf-8d3c-2a932f453d41'
  );
