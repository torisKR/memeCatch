-- 밈 사전 zh 번역 적용 (슬라이스 10, 담당 문서 20건)
-- provider=claude, model=claude-fable-5, prompt_version=12
-- source_updated_at = 조회 시점 memes.updated_at 그대로 사용 (모든 행 2026-07-15T15:30:00.191373+00:00)
-- 조회: GET /rest/v1/memes?id=in.(...)&select=id,title,summary,description,origin,usage_note,caution,aliases,usage_examples,updated_at (anon key, memes 테이블은 SELECT만 수행)

-- Batch 1 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('6105f91b-ed0e-4120-ae88-c839935afb46','zh','le-sserafim-unforgiven-challenge','LE SSERAFIM UNFORGIVEN挑战','利用LE SSERAFIM正规一辑收录曲编舞而兴起的2023年社交媒体舞蹈挑战。','2023年5月发行的LE SSERAFIM正规一辑《UNFORGIVEN》收录曲《Eve, Psyche and the Bluebeard''s Wife》以上半身为主的编舞挑战一度流行。aespa Winter、ENHYPEN Ni-ki、SHINee Key等其他偶像也参与其中，同时还进行了留白部分歌词由参与者自行填词的“开放歌词挑战”。','LE SSERAFIM正规一辑《UNFORGIVEN》(2023年5月1日发行)宣传挑战。','作为偶像编舞挑战类梗使用。',null,array['르세라핌 UNFORGIVEN 챌린지','Unforgiven挑战','爬行挑战'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('50bbc7b0-3526-4b35-a876-f9488cf8510b','zh','lee-daeho-joseon-cleanup-hitter','李大浩·朝鲜第四棒','李大浩在国家队活跃表现催生的流行语式绰号。','2006年多哈亚运会棒球队遭遇惨败之际，李大浩独自在国家队奋力支撑，网民将当时流行的“朝鲜国母”梗改编，称他为“朝鲜第四棒”。也有解读认为，因“国民打者”称号已被李承烨占据，才为他另取此绰号。此后每当李大浩在关键时刻发挥出色，这个绰号便会被重新提起。','2006年多哈亚运会后在棒球球迷社群中扩散开来。','李大浩在关键时刻表现出色时，会被引用为“不愧是朝鲜第四棒”。',null,array['이대호 조선의 4번타자','朝鲜第四棒'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('1bf87f2f-ccb2-41fa-a508-34c2326010b4','zh','infinite-challenge-extreme-part-time-job','无限挑战·极限打工','无限挑战成员体验快递装卸等高强度打工的特别企划。','该特别企划于2014年11月29日至12月6日播出，模仿EBS纪录片《极限职业》，成员们逐日体验各种高强度兼职工作。初级难度包括蛇按摩、便利店打工；中级难度为清洁鳄鱼牙齿、澡堂清扫；高级难度则是快递装卸、冷冻仓库、屠宰场打工。拍摄当天车胜元作为卢弘哲的替补嘉宾出演。','2014年11月29日MBC《无限挑战》特别企划播出。','作为诙谐呈现劳动辛苦的特辑而被重新提及。',null,array['무한도전 극한알바','极限打工特辑'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('5e25b26f-90df-452d-b0ee-82c65178d07d','zh','hodl-wins-bitcoin','死扛到底就是胜利','2018年比特币投资者采访语录在2020年被重新提起的梗。','2018年一档电视采访节目中，一位比特币投资者说出“死扛到底必定胜利”，2020年末比特币暴涨时，这句话被视为预言般重新翻红，再度流行开来。','2018年2月SBS CNBC《经济Wide Issue&》比特币投资者采访。','用于鼓励对方“撑住就会赢”的场合。',null,array['존버는 승리한다','死扛党','死扛到底必定胜利'],'[{"text":"再难也要死扛到底就是胜利，再坚持一下","situation":"KakaoTalk聊天"},{"text":"这句语录完全是死扛精神本身","situation":"社交媒体评论"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('9813bc70-2772-474d-b67a-e7cec560ff08','zh','jo-jjazz-moreusinayo','Jo Jjazz《你不知道吗》','新人Jo Jjazz翻唱Davichi原曲的出道曲经由社交媒体口碑逆袭爆红。','Jo Jjazz于2025年1月7日翻唱Davichi 2013年歌曲《모르시나요（你不知道吗）》作为出道曲发表。相比华丽技巧，更注重情感表达的唱腔通过社交媒体与短视频翻唱内容口口相传，发行一两周后开始发酵，逆袭登上各大音源榜单冠军，并在2025年上半年Circle榜综合榜排名第七。','2025年1月7日Jo Jjazz翻唱Davichi 2013年歌曲《모르시나요》出道，发行一两周内经社交媒体、短视频口碑传播，逆袭登上音源榜单冠军。','用于抒情翻唱视频或原曲翻唱介绍类内容。',null,array['조째즈 모르시나요','모르시나요翻唱','Davichi 모르시나요翻唱'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 2 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('64ef7639-f71c-43b2-b3c8-f57b258fd17d','zh','itzy-mafia-in-the-morning-challenge','ITZY《마.피.아. In the morning》挑战','2021年ITZY《마.피.아. In the morning》卡牌游戏概念编舞挑战。','2021年4月发行的ITZY迷你专辑主打曲《마.피.아. In the morning》的重点编舞模仿挑战风靡TikTok。该编舞以杀手游戏为灵感，特色是神秘的手部动作与充满魅力的表情，发行仅三周MV播放量便突破一亿，话题度极高。','2021年4月发行后不久，TikTok上以"in the morning challenge"标签掀起翻跳视频热潮。','作为girl crush概念挑战的代表案例被提及。',null,array['있지 마피아(Mafia In the morning) 챌린지','ITZY Mafia In the Morning 挑战'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('df2d0c0c-de1e-41ab-8888-b16deb8faba7','zh','tv-brings-love-reunion-show','《电视载爱而来》','1994年开播的寻找故人感动型综艺节目。','1994年5月开播的KBS《电视载爱而来》以帮名人寻找多年未见的故人并促成重逢为形式，随着演播室大门开启重逢瞬间带来的感动而广受欢迎，在1997年前后迎来全盛期。','《电视载爱而来》于1994年5月3日开播，至2010年共播出805期，是KBS的时事教养·综艺节目，制作组通过寻访名人的初恋、恩师、同学等故人促成重逢。节目由无名演员重演委托人与故人的往昔故事，并由金钟焕·张惠善、后来的金一等人的旁白增添感动色彩，这种构成广受欢迎，1997年前后话题度与收视率均达到顶峰。作为寻找故人的真人秀节目鼻祖，长期播出并获得跨世代的人气。','谈及与故人感动重逢的故事时可作为案例提及。',null,array['TV는 사랑을 싣고','电视载爱而来'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('4b3eda59-24ed-4deb-a698-172e8e103191','zh','sg-wannabe-timeless','SG Wannabe《Timeless》','引领中板抒情曲潮流的SG Wannabe 2004年出道曲。','这是2004年发行的SG Wannabe首张专辑主打曲，是当时流行的中板抒情曲代表作品。该曲在数字音源平台上大获成功，使SG Wannabe一跃成为人气组合。','2004年4月作为SG Wannabe出道专辑主打曲发行。','提到2000年代中期抒情组合全盛期时被引用。',null,array['SG워너비 Timeless','SG Wannabe出道曲'],'[{"text":"在听SG Wannabe的Timeless，完全是那个年代KTV的感觉","situation":"KakaoTalk聊天"},{"text":"说到2000年代中期抒情曲，还得是Timeless","situation":"社交媒体评论"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('dea98e3f-3baa-485f-bfe1-7f624621a3fe','zh','mwoya-yeoincheonha','“什么呀?!”（뭬야?!）','史剧《女人天下》敬嫔朴氏激动反应催生的流行语。','SBS大河史剧《女人天下》中，都知媛饰演的敬嫔朴氏在惊讶或愤怒时喊出的“뭬야?!”，因在各类综艺节目中被大量模仿而爆红，成为史剧流行语的代表案例。','2001年初至2002年中期播出的SBS电视剧《女人天下》。','对荒唐或离谱的消息表示惊讶反应时引用。','无',array['뭬야?!','女人天下뭬야'],'[{"text":"뭬야?! 真的假的？","situation":"KakaoTalk聊天"},{"text":"这反应完全是敬嫔朴氏本人","situation":"社交媒体评论"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('cbf5d5b9-00b6-4603-bdd9-941964944f45','zh','bento-korea-team-round-of-16-2022','本托号伟大挑战','在孙兴慜·金玟哉·黄喜灿伤病危机中时隔12年实现客场16强的本托执教之旅。','保罗·本托执教的韩国国家足球队在2022年卡塔尔世界杯12月3日对阵葡萄牙的比赛中戏剧性逆转获胜，时隔12年确定晋级客场16强。这是在多名主力球员伤病危机下，由李政协、赵圭成等球员挺身而出取得的成果，此后在16强赛中以1比4不敌巴西。这段征程被称为“本托号伟大挑战”，成为韩国足球引以为豪的高光时刻。','2022年卡塔尔世界杯小组赛对阵葡萄牙的戏剧性胜利。','用于引用2022年世界杯韩国队感人的客场16强故事时使用。',null,array['벤투호 위대한 도전','2022卡塔尔世界杯16强'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 3 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('c179f8bb-cb43-447e-ada4-d76f63411855','zh','super-junior-sorry-sorry','Super Junior《Sorry Sorry》','以“道歉”手势编舞在亚洲掀起翻跳热潮的歌曲。','2009年3月发行的Super Junior第三张专辑主打曲《Sorry Sorry》，其如歌词般表现道歉动作的编舞简单易学，令歌曲与舞蹈都在10-20岁人群中如流行语般传播。该曲不仅风靡韩国，更席卷中国、台湾、泰国、菲律宾等亚洲各地音源榜单，掀起全球翻跳热潮。','SM娱乐Super Junior正规三辑《Sorry Sorry》(2009年3月)。','提及2009年偶像翻跳热潮的代表案例时使用。',null,array['슈퍼주니어 쏘리쏘리','Sorry Sorry舞','Sorry Sorry编舞'],'[{"text":"这个手势完全是Sorry Sorry风","situation":"KakaoTalk聊天"},{"text":"说到翻跳热潮还得是Sorry Sorry","situation":"社交媒体评论"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('1ceefb91-ef11-4bef-92f3-7253c4c16851','zh','han-ttukbaegi-hasilraeyo','“要不要来一钵？”','艺人河一以憨厚方言喊出的农心巢米粉砂锅广告台词。','2009年农心推出巢米粉砂锅产品，起用艺人河一（罗伯特·哈利）为代言人，打出方言台词“要不要来一钵？”。这位外国人操着一口憨厚的庆尚道方言、且发音不加字幕播出，引发不少误会与笑料，成为热门话题。相比产品本身，这句台词和说话方式反而更为出名，常被提及。','2009年农心巢米粉砂锅电视广告，河一出演。','劝人吃东西时模仿方言语调引用。',null,array['한 뚝배기 하실래예','罗伯特·哈利米粉'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('c6e86300-b08b-4d0f-8625-e3083113afc6','zh','king-of-masked-singer-music-general','《蒙面歌王》“我们社区音乐队长”','在MBC《蒙面歌王》连续19周夺冠、引发轰动的歌王角色。','2015年4月首播的MBC《蒙面歌王》中，2016年初登场的“我们社区音乐队长”以独特的问候语调和爆发力十足的高音连续九次夺冠、称霸19周，成为话题度最高的歌王。网民围绕其真实身份展开热烈猜测，通过分析嗓音与唱法，最终指向摇滚乐队Guckkasten主唱河贤雨，掀起一股猜谜热潮。','2016年MBC《蒙面歌王》登场的“우리동네 음악대장”角色。','作为综艺节目身份猜谜热潮的代表案例被引用。',null,array['우리동네 음악대장','蒙面歌王音乐队长','河贤雨蒙面歌王'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('5182abeb-8fd1-40de-a4af-d5b926f227c7','zh','damo-apeunya-nado-apeuda','《茶母》“疼吗，我也疼”','2003年电视剧《茶母》留下的代表名台词。','在2003年播出的MBC电视剧《茶母》中，李瑞镇对负伤的河智苑说出“疼吗，我也疼”这句台词，随着观众的热烈追剧（“茶母废人”）一同成为被反复提及的经典台词。','2003年7月至9月播出的MBC电视剧《茶母》中，左捕厅从事官皇甫尹（李瑞镇）在梅花盛开的夜晚，对执行任务时受伤的彩玉（河智苑）说出此台词。这段以克制语气表达共情的场面在播出当时引发热潮，甚至催生“茶母废人”这一新造词来形容忠实观众，此后这句台词也常被当作安慰或表达共情的惯用语引用，至今仍被长久传颂。','对他人的痛苦表示共情时引用。',null,array['다모 아프냐 나도 아프다','疼吗我也疼'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('619d1eeb-4831-4999-87d6-52e6d18a64ec','zh','kim-dongmun-ha-taekwon-badminton-doubles-gold','金东文-河泰权羽毛球双打金牌组合','自1997年组队，在2004年雅典奥运会男子双打称霸的羽毛球组合。','金东文与河泰权自1997年起搭档双打，直至退役始终携手出战。两人在1999年世锦赛、2000年全英公开赛等多项国际大赛中夺冠，登顶世界排名第一，并在2004年雅典奥运会男子双打决赛中击败韩国队友组合，摘得金牌。这对组合被视为韩国羽毛球双打全盛时代的象征。','1997年至2004年金东文-河泰权双打组合活跃期，2004年雅典奥运会夺金。','常作为韩国羽毛球双打全盛期的代表案例被引用。',null,array['김동문-하태권 배드민턴 복식 금메달'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Batch 4 (5건)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('9d98c75e-5b11-4b41-9fe1-da7ab2130f6e','zh','park-inbee-golden-career-grand-slam','朴仁妃·黄金生涯大满贯','集齐生涯大满贯与奥运金牌的全球唯一“黄金大满贯”得主。','朴仁妃在2015年英国公开赛夺冠，成为亚洲首位、LPGA历史第七位达成生涯大满贯的选手。翌年即2016年里约奥运会高尔夫女子单打项目中再度摘得金牌，成为男女选手中全球首位达成“黄金生涯大满贯”的运动员。凭借长期稳坐世界排名第一及入选名人堂等成就，球迷称她为“高尔夫女帝”。','2015年达成生涯大满贯及2016年里约奥运会夺金。','谈及韩国女子高尔夫的世界地位时常被作为代表案例引用。',null,array['박인비 골든 커리어 그랜드슬램','高尔夫女帝朴仁妃'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('6caf1ca3-40ca-40aa-abe3-89fb610d0f21','zh','are-you-a-t-mbti','你是T型吗？','对不懂共情的人调侃反问“你是不是MBTI T型”的流行语。','该流行语源自YouTube喜剧频道“밈고리즘（Memegorithm）”的“폭스클럽（Fox Club）”系列，剧中拍摄者指出事实后对方反呛“你是T型吗？”，2023年3月起开始流行。用来调侃对方只讲逻辑、缺乏共情的反应，甚至一度传播至无线电视节目。','YouTube频道“밈고리즘”폭스클럽系列(2023年3月)台词。','用来调侃对方缺乏共情心时使用。','这是用MBTI类型给人下定论的表达，若认真使用可能引发反感。',array['너 T야?','姐你是T型吗','T型吗'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('8ca9a12c-c866-48c9-b902-fce76d429fba','zh','sunpoong-clinic-chant','“顺风，顺风，顺风，耶！”','情景喜剧《顺风妇产科》角色们高喊的口号式流行语。','在SBS日播情景喜剧《顺风妇产科》剧中，角色们为活跃气氛而高喊的口号，常被提及为象征该剧欢快氛围的经典场景。','1998年3月2日至2000年12月1日播出的SBS情景喜剧《顺风妇产科》。','提及1990年代末至2000年代初情景喜剧热潮时引用。','无',array['순풍, 순풍, 순풍, 야!','顺风妇产科口号'],'[{"text":"顺风，顺风，顺风，耶！哈哈（兴奋地）","situation":"KakaoTalk聊天"},{"text":"这句口号完全就是情景喜剧热潮本身","situation":"社交媒体评论"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('004c3d43-a643-4255-adc7-5f05963bc6e9','zh','daehanminguk-clap-cheer','“大~韩民国”拍手应援','2002年韩日世界杯期间凝聚全国的五拍拍手应援法。','高喊“大~韩民国”后接“啪啪啪、啪啪”的拍手节奏，通过街头应援和电视转播传遍全国，成为跨越世代与地区的全民参与型应援文化象征。','2002年韩日世界杯街头应援与赛场助威中自发形成并扩散。','适合在团体应援或营造节日气氛时重现。','无',array['대~한민국 박수 응원','啪啪啪啪啪应援','大韩民国加油拍手'],'[{"text":"今天大家一起来“大~韩民国”拍手应援吧","situation":"KakaoTalk聊天"},{"text":"听到这个节奏就想起2002年","situation":"社交媒体评论"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null),
('7c837ac6-15f8-48e7-9a8d-1e0d68ca633e','zh','apt-challenge-rose-bruno-mars','APT.挑战','Rosé与Bruno Mars歌曲《APT.》带火的韩式酒局游戏全球挑战。','2024年10月18日发行的Rosé与Bruno Mars合作单曲《APT.》风靡全球，歌曲灵感来源的韩式聚会游戏“公寓游戏”翻玩挑战随之流行。参与者依次叠手喊数字，出错者接受惩罚，这种源自韩国团建·聚餐文化的游戏就此传遍世界。该挑战在TikTok创下史上最短时间内突破20亿播放量的纪录。','Rosé向Bruno Mars介绍韩式酒局游戏“아파트（公寓）”，因此成为歌名。2024年MAMA颁奖礼首次公开舞台。','可在聚会、聚餐时提及以活跃气氛。',null,array['아파트 챌린지','APT挑战','公寓游戏挑战','로제 브루노마스 아파트'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null)
on conflict (meme_id, locale) do nothing;

-- Step 5: 자기 행 승격 (담당 20건)
update public.meme_translations t
set status='reviewed', reviewed_at=now(), reviewed_by='c7295ec1-1ca9-414d-a7e1-8f19005a90d0'::uuid
from public.memes m
where t.meme_id=m.id
  and t.locale='zh'
  and t.status='machine'
  and t.model='claude-fable-5'
  and t.prompt_version=12
  and m.updated_at=t.source_updated_at
  and t.meme_id in (
    '6105f91b-ed0e-4120-ae88-c839935afb46',
    '50bbc7b0-3526-4b35-a876-f9488cf8510b',
    '1bf87f2f-ccb2-41fa-a508-34c2326010b4',
    '5e25b26f-90df-452d-b0ee-82c65178d07d',
    '9813bc70-2772-474d-b67a-e7cec560ff08',
    '64ef7639-f71c-43b2-b3c8-f57b258fd17d',
    'df2d0c0c-de1e-41ab-8888-b16deb8faba7',
    '4b3eda59-24ed-4deb-a698-172e8e103191',
    'dea98e3f-3baa-485f-bfe1-7f624621a3fe',
    'cbf5d5b9-00b6-4603-bdd9-941964944f45',
    'c179f8bb-cb43-447e-ada4-d76f63411855',
    '1ceefb91-ef11-4bef-92f3-7253c4c16851',
    'c6e86300-b08b-4d0f-8625-e3083113afc6',
    '5182abeb-8fd1-40de-a4af-d5b926f227c7',
    '619d1eeb-4831-4999-87d6-52e6d18a64ec',
    '9d98c75e-5b11-4b41-9fe1-da7ab2130f6e',
    '6caf1ca3-40ca-40aa-abe3-89fb610d0f21',
    '8ca9a12c-c866-48c9-b902-fce76d429fba',
    '004c3d43-a643-4255-adc7-5f05963bc6e9',
    '7c837ac6-15f8-48e7-9a8d-1e0d68ca633e'
  );

-- Step 6: 검증
select count(*) as reviewed_count
from public.meme_translations
where locale='zh' and status='reviewed'
  and meme_id in (
    '6105f91b-ed0e-4120-ae88-c839935afb46','50bbc7b0-3526-4b35-a876-f9488cf8510b','1bf87f2f-ccb2-41fa-a508-34c2326010b4',
    '5e25b26f-90df-452d-b0ee-82c65178d07d','9813bc70-2772-474d-b67a-e7cec560ff08','64ef7639-f71c-43b2-b3c8-f57b258fd17d',
    'df2d0c0c-de1e-41ab-8888-b16deb8faba7','4b3eda59-24ed-4deb-a698-172e8e103191','dea98e3f-3baa-485f-bfe1-7f624621a3fe',
    'cbf5d5b9-00b6-4603-bdd9-941964944f45','c179f8bb-cb43-447e-ada4-d76f63411855','1ceefb91-ef11-4bef-92f3-7253c4c16851',
    'c6e86300-b08b-4d0f-8625-e3083113afc6','5182abeb-8fd1-40de-a4af-d5b926f227c7','619d1eeb-4831-4999-87d6-52e6d18a64ec',
    '9d98c75e-5b11-4b41-9fe1-da7ab2130f6e','6caf1ca3-40ca-40aa-abe3-89fb610d0f21','8ca9a12c-c866-48c9-b902-fce76d429fba',
    '004c3d43-a643-4255-adc7-5f05963bc6e9','7c837ac6-15f8-48e7-9a8d-1e0d68ca633e'
  );
