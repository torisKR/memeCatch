-- 밈 사전 zh-tw 번역 적용 (슬라이스 14, 담당 문서 20건)
-- provider=claude, model=claude-fable-5, prompt_version=12
-- source_updated_at = 조회 시점 memes.updated_at 그대로 사용 (모든 행 2026-07-15T15:30:00.191373+00:00)
-- 조회: mcp__supabase__execute_sql(project_id=onjipuldngbdptldkpoe)로 SELECT (memes 테이블은 SELECT만 수행, anon key 사용 안 함)

-- Batch 1 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('a9b1c0e1-2bb4-42ff-a351-7d82e40830ea','zh-tw','yona-yona-dance','YONA YONA DANCE 舞蹈','日本歌手和田アキ子的歌曲舞蹈在韓國掀起挑戰熱潮','日本歌手和田アキ子於2021年9月發表的歌曲《YONA YONA DANCE》編舞，在2022年於韓國TikTok與YouTube上掀起舞蹈挑戰熱潮。洗腦的副歌旋律搭配簡單易學的動作，吸引各年齡層參與，成為Zero Two系舞蹈中的人氣迷因。','日本歌手和田アキ子的歌曲《YONA YONA DANCE》(2021年發行)於2022年在韓國演變為舞蹈挑戰','適合用來形容任何人都能輕鬆跟跳、氣氛歡樂的舞蹈挑戰',null,array['요나요나 댄스','YONA YONA DANCE'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('607e04a0-26f6-4f57-837a-f355089ee6b9','zh-tw','bacchus-todays-fatigue-today','Bacchus「當天疲勞當天消除」','東亞製藥於1993年推出、以平凡百姓為主角的Bacchus廣告文案','東亞製藥於1993年推出以平凡上班族與市井小民為主角的「New Korean」系列廣告，打出「當天的疲勞，當天消除」這句文案。樸實無華的文案與真摯動人的故事長年為人津津樂道，也經常被喜劇節目拿來模仿。','東亞製藥自1976年起因政府法規限制長達17年無法投放Bacchus廣告，直到1993年才以起用平凡百姓為主角的「新韓國人」系列廣告重新回歸。「當天的疲勞，當天消除」這句文案透過描繪公車總站員工、環衛清潔工等默默耕耘的平凡人身影廣為流傳，該系列廣告至1997年共製作13集，引發熱烈迴響。這種以勞動市民的日常取代華麗明星代言的人文廣告手法，被認為對日後韓國公益與企業廣告產生了深遠影響。','可在結束疲憊的一天、自我安慰打氣時引用',null,array['박카스 ''그날의 피로는 그날에''','當天的疲勞，當天消除'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('6544a811-8f1c-4ba2-b84a-d9c57411440d','zh-tw','babymonster-batter-up-dance-challenge','BABYMONSTER《BATTER UP》舞蹈挑戰','YG新人女團BABYMONSTER搶先發行單曲的編舞，於2023年掀起挑戰熱潮','2023年11月以六人編制搶先出道的BABYMONSTER單曲《BATTER UP》，公開後一天內YouTube音樂錄影帶觀看次數即突破2259萬次，創下K-POP出道MV24小時最多觀看次數紀錄，同時展開「BATTER UP DANCE CHALLENGE」舞蹈挑戰。','BABYMONSTER搶先出道單曲《BATTER UP》(2023年11月27日發行)舞蹈挑戰','作為聲援新人女團出道的挑戰活動使用',null,array['베이비몬스터 Batter Up 댄스 챌린지','Batter Up挑戰','BABYMONSTER出道挑戰'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('6796011b-7d0d-45d7-b520-37c9cc8cb290','zh-tw','one-piece-king-of-pirates-man','我要成為海賊王的男人','《海賊王》魯夫的招牌宣言，也是韓文正式譯本的代表名台詞','《海賊王》第1集中，魯夫離開故鄉時說出「我要成為海賊王！」這句台詞，韓文正式譯本翻譯為「我是要成為海賊王的男人」。這是貫穿《海賊王》所有媒體作品的招牌台詞，作者曾在第91集的SBS單元中親自說明這句台詞所被賦予的意義。','《海賊王》漫畫第1集(1997年開始連載)，魯夫的出航宣言','常被拿來戲仿引用，用以宣示自己的抱負',null,array['해적왕이 될 남자다','我是要成為海賊王的！','魯夫招牌台詞'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('722a94f5-c23d-49c7-a5bc-cb13df64f1e3','zh-tw','getta-man','Getta Man','2000年代初連載於獵奇屋網站的火柴人Flash動畫','這是2000年代初「獵奇」風潮盛行時，刊登於獵奇屋網站的火柴人Flash動畫系列，由創作者「太子」製作。被視為當時經典火柴人角色系列衍生作品的代表之一。','Getta Man是2000年代初「獵奇」風潮盛行時，連載於獵奇屋網站的搞笑英雄火柴人Flash動畫。這是網路漫畫出現之前青少年愛看的Flash內容之一，早期並無固定劇情，常在預告「下集待續」後卻接續完全不同的發展，連載方式相當隨性。後來從「新世紀Getta Man」開始才具備完整的故事線並重新連載，但創作者「太子」於2002年後停止活動、就此銷聲匿跡，作品未完結。目前有YouTuber將殘存的部分Flash檔案修復並上傳為影片。','作為僅在火柴人動畫愛好者圈內流傳的小眾案例來介紹',null,array['겟타맨'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 2 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('fd67592e-1092-45ca-be3e-1e4457884c86','zh-tw','sakuranbo-challenge','櫻桃挑戰','2003年日本歌曲《櫻桃》副歌編舞，於2020年在韓國網路實況主之間以翻跳形式再度掀起熱潮','大塚愛於2003年發表的《櫻桃》，是2000年代初Cyworld世代共同的回憶金曲。2020年網路實況主Lalo在直播中頻繁播放而重新受到關注，AfreecaTV實況主Yoo Hyedi在副歌部分示範閉眼鼓腮、雙手擺動的招牌動作後，這支翻跳挑戰便在實況主之間迅速擴散開來。','大塚愛2003年發行歌曲，2020年在韓國網路實況主之間掀起翻跳熱潮','適合用來形容意外可愛的懷舊歌曲翻跳挑戰',null,array['사쿠란보 챌린지','櫻桃翻跳挑戰'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('321c3670-de0f-449d-b01f-e693b5a43033','zh-tw','gidle-tomboy-challenge','(G)I-DLE《TOMBOY》舞蹈挑戰','登上告示牌年度K-POP冠軍的(G)I-DLE代表曲舞蹈挑戰','(G)I-DLE於2022年3月發行首張正規專輯《I NEVER DIE》主打曲《TOMBOY》，人氣紅到被告示牌選為當年度K-POP冠軍歌曲。歌曲發行後隨即在各大音源網站達成「完美全通」，擷取部分編舞而成的舞蹈挑戰也在社群媒體上掀起熱潮。','(G)I-DLE首張正規專輯主打曲《TOMBOY》(2022年3月發行)舞蹈挑戰','作為自信率性、有型有款的女團舞蹈挑戰使用',null,array['(여자)아이들 TOMBOY 챌린지','Tomboy挑戰'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('20f89fae-8af9-4b64-bc24-44d7521de547','zh-tw','god-childcare-diary','god的育兒日記','偶像團體god照顧嬰兒引發話題，韓國首檔觀察型育兒綜藝','節目記錄了god成員照顧嬰兒Han Jae-min的日常，被視為韓國觀察型綜藝與育兒綜藝的始祖，也是god躍升為國民團體的關鍵推手。','自2000年1月9日至2001年5月12日於MBC播出。','常被提及為觀察型育兒綜藝的始祖案例',null,array['god의 육아일기','god Jae-min育兒'],'[{"text":"這個育兒綜藝根本就是god育兒日記的既視感","situation":"KakaoTalk聊天"},{"text":"說到觀察型育兒綜藝，始祖絕對是god育兒日記","situation":"社群媒體留言"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('240a2533-1e51-47d0-84ab-6235fc20c9f3','zh-tw','mureupak-dosa','膝蓋道士','姜虎東扮演巫師人物、為來賓解惑的談話節目單元','這是2007年1月31日正式成為固定單元的《黃金漁場》談話節目單元。姜虎東扮演巫師角色「膝蓋道士」，為來賓進行人生諮商，直言不諱的提問風格引發話題，被認為帶動了2000年代後期綜藝節目「毒舌路線」的潮流。','MBC《黃金漁場》「膝蓋道士」單元(2007年1月31日起)，主持人姜虎東','談到以綜藝形式進行真摯人生諮商時，常被提及為始祖案例',null,array['무릎팍도사','姜虎東道士','膝蓋'],'[{"text":"今天用膝蓋道士的風格幫我做個心理諮商吧","situation":"KakaoTalk聊天"},{"text":"這個諮商根本是膝蓋道士等級的直白","situation":"社群媒體留言"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('6f7b24aa-6635-44bc-8feb-c14cdb0a2d22','zh-tw','doremi-market','Do Re Mi市場','《驚人的星期六》節目單元，以全國市場美食為賭注比拼歌詞聽寫','這是2018年4月7日於tvN首播的《驚人的星期六》核心單元，以全國市場人氣美食為獎品，比拼準確聽寫歌詞的跨世代音樂綜藝。原本節目分為第一部「傻瓜們的監獄生活」與第二部「Do Re Mi市場」，後來第一部停播，Do Re Mi市場便成為整檔節目的代稱。藝人聽錯歌詞、鬧出笑話般聽寫錯誤的畫面，每集都成為熱門話題。','2018年4月7日作為tvN《驚人的星期六》單元開播','節目中錯誤聽寫的歌詞字幕經常被截圖分享，如迷因般流傳',null,array['도레미마켓','驚人的星期六Do Re Mi市場','聽寫遊戲'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 3 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('7bbbd44e-45f0-4fef-82ae-92627591f596','zh-tw','egatan-chew-tear-taste-enjoy','怡牙錠「咬嚼嚐樂」廣告曲','由歌手Tae Jin-ah與Song Dae-kwan合唱、牙齦藥怡牙錠家喻戶曉的洗腦廣告歌副歌','2004年前後，名人製藥旗下牙齦藥怡牙錠起用演歌歌手Tae Jin-ah與Song Dae-kwan擔任代言人，推出歌曲形式的廣告，歌詞主打「咬嚼嚐樂」。兩人此後多年持續擔任怡牙錠專屬代言人，該廣告曲成為家喻戶曉的洗腦金曲。儘管是牙齦保健產品廣告，卻憑藉輕快的旋律長年為人津津樂道。','2004年前後名人製藥怡牙錠電視廣告，由Tae Jin-ah、Song Dae-kwan主演','用來表示盡情享受某件事時，可引用「咬嚼嚐樂」這句話',null,array['이가탄 씹고 뜯고 맛보고 즐기고','咬嚼嚐樂之歌'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('8b649529-6d16-4360-9aa0-18f99b332e1a','zh-tw','allday-project-wicked-challenge','WICKED挑戰','新人團體ALLDAY PROJECT出道曲舞蹈挑戰','THEBLACKLABEL旗下五人混合編制團體ALLDAY PROJECT於2025年6月出道，雙主打曲之一《WICKED》的編舞挑戰隨出道同步在社群媒體上擴散開來。實驗性的節奏與個性十足的舞台表現引發話題，助其獲得超乎新人水準的人氣。','THEBLACKLABEL新人團體ALLDAY PROJECT 2025年6月出道曲《WICKED》舞蹈挑戰','適合用於參與新人偶像出道曲挑戰內容時',null,array['WICKED 챌린지','ALLDAY PROJECT WICKED挑戰'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('3ba293d3-de62-476a-b9db-19ff033ad788','zh-tw','pocari-sweat-lalala','寶礦力水得「La La La」廣告','以聖托里尼為背景，孫藝珍展現清純魅力的寶礦力水得主題曲廣告','2001年的寶礦力水得廣告起用演員孫藝珍為代言人，以希臘聖托里尼為背景，唱出「Tara-riri La La La La~如果你喜歡我」的主題曲。她身穿白色連身裙騎單車的清純形象大獲好評，成為現象級廣告。孫藝珍後於2007年與2008年再度獲邀代言，是歷代「寶礦力女孩」中唯一兩度簽約的代言人。','2001年東亞大塚寶礦力水得電視廣告，孫藝珍主演','用來表達夏日清涼感時，可哼唱「La La La」主題曲',null,array['포카리스웨트 라라라','孫藝珍寶礦力水得'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('5d2ca1ab-cf76-4f88-ad9a-8ca9dc4f3d03','zh-tw','turbo-hoesang','Turbo《回想》','1997年發行、Turbo在音樂節目上獲得最多冠軍的歌曲','1997年10月發行的Turbo第三張專輯後續曲《回想(December)》，總共在音樂節目上獲得12次冠軍，成為Turbo歷來最成功的歌曲。這是Kim Jung-nam與金鐘國早期活動的代表性熱門歌曲。','Turbo於1997年以第三張專輯《Born Again》主打曲《Goodbye Yesterday》，與H.O.T.、Sechs Kies競爭，在KBS《歌謠TOP10》連續四週奪冠，隨後接續發行後續曲《回想(December)》。《回想》於同年12月17日登上《歌謠TOP10》冠軍後持續蟬聯，據悉兩曲合計創下當時最多冠軍紀錄。哀傷的抒情旋律搭配金鐘國、Kim Jung-nam的歌聲組合引發話題，成為1997年末歌壇代表性的熱門歌曲。','可作為1990年代末舞曲經典來提及',null,array['터보 ''회상''','回想(December)'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('c88bd049-f6b6-467c-814d-e256f610266d','zh-tw','beyblade-craze','戰鬥陀螺熱潮','2002年前後陀螺對戰玩具掀起的校園操場熱潮','根據日本原作動畫改編的陀螺玩具「戰鬥陀螺」，在2002年前後於韓國小學生之間掀起熱潮，各地校園紛紛上演陀螺對戰。這是玩具收集與改裝風氣同步盛行的代表案例。','日本原作玩具與動畫於2002年前後在韓國掀起熱潮','作為回顧2000年代初小學生玩具文化的話題被提及',null,array['탑블레이드 열풍','戰鬥陀螺'],'[{"text":"小時候戰鬥陀螺根本超級大流行","situation":"同學KakaoTalk群組聊天"},{"text":"看到這個陀螺就想起學校操場","situation":"社群媒體留言"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 4 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('0f4f6bea-9b8d-4ba2-91d8-6e12ac11b564','zh-tw','reborn-rich-soonyang-group','《財閥家的小兒子》順陽集團','2022年JTBC電視劇中虛構財閥集團掀起的現象級話題','自2022年11月起播出的JTBC電視劇《財閥家的小兒子》，以虛構財閥「順陽集團」為背景，講述重生復仇故事，是2022年下半年最受矚目的話題作之一，更屢創收視紀錄。「順陽集團」這個名稱與設定本身在網路上引發熱烈討論，成為各種二次創作與迷因的題材。','JTBC電視劇《財閥家的小兒子》(2022年11月播出)中的虛構企業設定','談論財閥劇套路或熱門話題作品時可引用',null,array['재벌집 막내아들 순양그룹','順陽集團'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('7a58b0aa-cf72-46b0-9a79-eccbf62ffab2','zh-tw','lijungddak','利物浦中游論','「利物浦就該待在中游」的縮寫，因實況主Gamst改編歌曲而爆紅的足球迷因','2014年3月，桑德蘭主帥古斯·波耶特表示「如果沒有蘇亞雷斯，利物浦大概只能待在中游」，這句話被簡化為「利物浦中游論」後開始流傳。以曼聯球迷聞名的實況主Gamst將歌手Song Dae-kwan的歌曲《流行歌》改編填詞為「利物浦中游論、利物浦中游論，歡樂的歌」傳唱，透過DCInside等社群網站爆炸性擴散開來。','源自2014年古斯·波耶特教練的發言，經實況主Gamst改編成歌曲後擴散','談論足球或實況主文化時，搭配背景說明使用','帶有貶低特定足球隊的意味，在利物浦球迷面前使用可能顯得失禮。Gamst本人也於2018年正式道歉',array['리중딱','利物浦就該待在中游','利物浦中游論之歌'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('0c318291-73e0-406a-84b7-744589bf4d25','zh-tw','sdm-wedding-package','婚紗攝影・禮服・妝髮套組','婚紗攝影棚、禮服、新娘妝髮準備流程的縮寫，是韓國婚禮籌備必經的新造詞','這是韓國婚禮籌備必經流程──婚紗攝影棚拍攝、禮服租借、髮妝造型──三者的縮寫新造詞，費用大致落在200萬至500萬韓元之間。2024年韓國低出生率高齡社會委員會將高昂的結婚費用列為少子化原因之一，相關市場不透明的定價結構因此再度受到檢視。','婚禮產業幾乎必經的流程，2024年因少子化政策討論而再度受到關注','用來說明籌備婚禮的費用負擔時使用',null,array['스드메','Studio Dress Makeup'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('c2f2ae25-7921-4012-8bf1-bce3119ff8bc','zh-tw','jageop-jungiya','我在搭訕','2003年三星Anycall廣告中誕生的流行語','2003年三星電子Anycall手機廣告系列中的文案「我在搭訕」，用來指稱向心儀對象靠近示好的情境而流行起來。當時「搭訕」一詞本身也作為表示談戀愛嘗試的流行語廣泛使用。','這是2003年三星Anycall電視廣告中演員李瑞鎮留下的台詞。當時廣告與剛以個人身份出道的李孝利共同宣傳130萬畫素相機手機，搭上李孝利掀起的所謂「孝利症候群」話題熱潮而備受矚目。「我在搭訕」這句簡短台詞此後在各類節目與廣告中被反覆模仿，成為長年為人津津樂道的流行語，即便時隔20年至今仍不時被作為懷舊廣告重新提起。','用來輕鬆表達正嘗試向心儀對象示好的情境','帶有輕描淡寫看待追求異性行為的語感，依語境不同可能讓人感到不適',array['작업 중이야','我在搭訕Anycall'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('832c8209-30e8-48f2-82a9-f9c3a58d1cd5','zh-tw','face-taping','臉部貼膠帶','用透明膠帶拉提下顎線與眼型的化妝前準備技巧','這項技巧是將輕薄透明的醫用／角色扮演用膠帶貼在顴骨或下顎線上，拉提臉部輪廓後再上妝。因為不需要打肉毒桿菌或填充劑就能達到立即拉提的效果，在TikTok美妝創作者之間廣泛流傳開來。','原本用於角色扮演（cosplay）業界的技巧，在2023年前後經TikTok美妝創作者介紹為日常化妝技巧後開始流行。','用來指稱不需醫美療程、單靠膠帶拉提修飾臉部線條的化妝技巧。','由於直接將膠帶貼在皮膚上，可能引起皮膚刺激或狀況，長時間使用需特別留意。',array['페이스 테이핑','貼膠帶整形','face taping'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Step 5: 자기 행 승격 (담당 20건)
update public.meme_translations t
set status='reviewed', reviewed_at=now(), reviewed_by='c7295ec1-1ca9-414d-a7e1-8f19005a90d0'::uuid
from public.memes m
where t.meme_id=m.id
  and t.locale='zh-tw'
  and t.status='machine'
  and t.model='claude-fable-5'
  and t.prompt_version=12
  and m.updated_at=t.source_updated_at
  and t.meme_id in (
    'a9b1c0e1-2bb4-42ff-a351-7d82e40830ea',
    '607e04a0-26f6-4f57-837a-f355089ee6b9',
    '6544a811-8f1c-4ba2-b84a-d9c57411440d',
    '6796011b-7d0d-45d7-b520-37c9cc8cb290',
    '722a94f5-c23d-49c7-a5bc-cb13df64f1e3',
    'fd67592e-1092-45ca-be3e-1e4457884c86',
    '321c3670-de0f-449d-b01f-e693b5a43033',
    '20f89fae-8af9-4b64-bc24-44d7521de547',
    '240a2533-1e51-47d0-84ab-6235fc20c9f3',
    '6f7b24aa-6635-44bc-8feb-c14cdb0a2d22',
    '7bbbd44e-45f0-4fef-82ae-92627591f596',
    '8b649529-6d16-4360-9aa0-18f99b332e1a',
    '3ba293d3-de62-476a-b9db-19ff033ad788',
    '5d2ca1ab-cf76-4f88-ad9a-8ca9dc4f3d03',
    'c88bd049-f6b6-467c-814d-e256f610266d',
    '0f4f6bea-9b8d-4ba2-91d8-6e12ac11b564',
    '7a58b0aa-cf72-46b0-9a79-eccbf62ffab2',
    '0c318291-73e0-406a-84b7-744589bf4d25',
    'c2f2ae25-7921-4012-8bf1-bce3119ff8bc',
    '832c8209-30e8-48f2-82a9-f9c3a58d1cd5'
  );

-- Step 6: 검증
select count(*) as reviewed_count
from public.meme_translations
where locale='zh-tw' and status='reviewed'
  and meme_id in (
    'a9b1c0e1-2bb4-42ff-a351-7d82e40830ea','607e04a0-26f6-4f57-837a-f355089ee6b9','6544a811-8f1c-4ba2-b84a-d9c57411440d',
    '6796011b-7d0d-45d7-b520-37c9cc8cb290','722a94f5-c23d-49c7-a5bc-cb13df64f1e3','fd67592e-1092-45ca-be3e-1e4457884c86',
    '321c3670-de0f-449d-b01f-e693b5a43033','20f89fae-8af9-4b64-bc24-44d7521de547','240a2533-1e51-47d0-84ab-6235fc20c9f3',
    '6f7b24aa-6635-44bc-8feb-c14cdb0a2d22','7bbbd44e-45f0-4fef-82ae-92627591f596','8b649529-6d16-4360-9aa0-18f99b332e1a',
    '3ba293d3-de62-476a-b9db-19ff033ad788','5d2ca1ab-cf76-4f88-ad9a-8ca9dc4f3d03','c88bd049-f6b6-467c-814d-e256f610266d',
    '0f4f6bea-9b8d-4ba2-91d8-6e12ac11b564','7a58b0aa-cf72-46b0-9a79-eccbf62ffab2','0c318291-73e0-406a-84b7-744589bf4d25',
    'c2f2ae25-7921-4012-8bf1-bce3119ff8bc','832c8209-30e8-48f2-82a9-f9c3a58d1cd5'
  );
