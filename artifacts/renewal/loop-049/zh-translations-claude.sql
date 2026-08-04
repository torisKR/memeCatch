-- ZH (Simplified Chinese) meme_translations batch -- loop-049, generated 2026-08-04.
-- Translator: Claude (model claude-fable-5), prompt_version=12. Source: top-30
-- trend_score public memes (moderation_status approved/limited) with no existing
-- 'zh' row, fetched via anon REST from production. Each row's source_updated_at is
-- the meme.updated_at snapshot the translation was made from (used unmodified).
--
-- Format: plain SQL, no base64/CTE -- each statement is an independent 2-line block
-- (insert...values header, then the value tuple + ON CONFLICT clause) so any subset
-- can be run standalone. status='machine' -- a human must review and flip status to
-- 'reviewed' (with reviewed_at/reviewed_by set) before meme_translations_public_read
-- RLS serves these to anon. 'on conflict (meme_id, locale) do nothing' makes re-runs
-- safe, but note this file does NOT re-check that the Korean source is unchanged
-- since capture time (no locked-CTE guard like loop-048's en batch) -- re-verify
-- source_updated_at against current public.memes.updated_at before applying if time
-- has passed.
--
-- Run with: supabase db query --linked --file artifacts/renewal/loop-049/zh-translations-claude.sql

-- 01. trend_score=354.500784535496  꼬셔야겠어 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('8908356c-996f-46b1-ad9d-2782e641dcd5','zh','pick-you-up-challenge','Pick You Up 挑战（꼬셔야겠어 챌린지）','说唱歌手Minoi歌曲《꼬셔야겠어（Pick You Up）》副歌片段带火的舞蹈兼对口型挑战','这是配合说唱歌手Minoi歌曲《꼬셔야겠어（Pick you up）》副歌摆出魅力姿势的舞蹈兼对口型挑战，2026年2月至3月间舞蹈版和对口型版同时在TikTok上走红。人们常在自信展示魅力的场合用它来搞笑。','Minoi于2024年7月发行的第二张正规专辑《This is my life》收录曲《꼬셔야겠어》，2026年2月起被用作TikTok舞蹈·对口型挑战的配乐。','在自信展示魅力的场合用来搞笑。',null,array['꼬셔야겠어 챌린지','Pick You Up 挑战','미노이 꼬셔야겠어'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 02. trend_score=354.230679459838  찹츄찹찹츄
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('b2fea6be-63a7-48aa-988d-86dbefb0650d','zh','qiu-qiu-meme','丘丘（찹츄찹찹츄谐音梗）','中国独立乐队回春丹歌曲《丘丘》副歌被韩国网友谐音听成"찹츄찹찹츄"，因而成为宠物视频的流行配乐','回春丹歌曲《丘丘》的副歌部分发音被韩国网友谐音听成类似"찹츄찹찹츄"的声音，因而被广泛用作金毛寻回犬等宠物进食或卖萌视频的背景音乐。由此还衍生出把金毛称为"찹츄리버"（谐音犬）的说法。','该曲收录于回春丹2023年2月发行的专辑《蜜虫》，2026年初开始在韩国Reels、Shorts、TikTok上作为背景音乐迅速传播开来。','常用作可爱或有节奏感的重复动作视频的背景音乐。',null,array['찹츄찹찹츄','丘丘谐音梗','찹츄리버'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 03. trend_score=346.713865399863  소개팅 상황극
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('3ab36237-b6a8-417e-80ed-ae5005e008ca','zh','blind-date-skit','相亲情景剧（소개팅 상황극）','演绎相亲时遇到离谱对象的爆笑情景剧','这是把相亲时遇到行为怪异对象的经历以搞笑方式重新演绎的情景剧，常见于分享恋爱故事的账号。剧情不少还会以意外反转收尾，带来令人感动的结局。','源自"썰터짐"等分享恋爱故事的账号中流行的相亲情节演绎。','讲述自己相亲时遇到的离谱经历时引用。',null,array['소개팅 상황극','相亲情景剧','相亲爆笑情景剧'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 04. trend_score=344.412408820248  자기 직업 불법적으로 말하기
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('758cef01-7f96-4fd5-87e3-2387b8e7dda6','zh','badly-explain-your-profession','把职业说成犯罪（Badly Explain Your Profession）','把普通职业用夸张说法描述成犯罪行径的整活梗','例如把空乘描述成"把人关进金属罐、在数万英尺高空监视他们的人"，这种用犯罪般措辞夸张描述自己职业的幽默形式即是该梗。内容全部属实，只是换一种说法就让人听起来像犯罪，这种反差正是笑点所在。','英语圈"Badly Explain Your Profession"梗经翻译后于2026年5月左右在Threads、Reels、Shorts上扩散，韩国国内由Instagram账号@choeeunsu、@baechuu等带动流行。','介绍自己职业时用来制造反转笑点。',null,array['자기 직업 불법적으로 말하기','Badly Explain Your Profession','내 직업 불법적으로 말해보기'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 05. trend_score=343.663638872134  얼음 뮤지컬 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('d494f475-6a0c-405c-924b-2f5e4a775b7c','zh','freeze-musical-remix','《冰》音乐剧混音挑战（얼음 뮤지컬 챌린지）','YouTuber제프프将《鱿鱼游戏》第二季成奇勋台词"冰"改编成音乐剧风格混音的挑战','2025年1月，YouTube博主제프프发布了一段将李政宰在《鱿鱼游戏》第二季中饰演的成奇勋台词"冰（얼음）"配上音乐剧风格旋律的混音视频。这段旋律极具洗脑感，播放量突破300万次，被视为2025年整年迷因潮流开端的代表内容。','源自YouTube博主제프프对《鱿鱼游戏》第二季台词的混音改编视频。','常作为韩剧台词混音类迷因的代表案例被提及。',null,array['얼음 뮤지컬 챌린지','冰音乐剧混音','성기훈 얼음'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 06. trend_score=341.525470270601  거제 야호
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('4be8ec7d-0540-4750-8a1c-90375bd5b9ea','zh','geoje-yaho','巨济呀吼（거제 야호）','在地名后加上日语感叹词"呀吼"制造反差反应的迷因','리센느成员미나미在원이的YouTube旅行内容中造访巨济岛时突然喊出"巨济呀吼——！"，원이错愕的反应引发热议。此后巨济市官方社交媒体也做出回应，全体成员更受聘为巨济市宣传大使，让这场迷因延伸为地方营销案例。','源自리센느원이 YouTube频道的巨济岛旅行内容。','在地名或人名后加上"~呀吼"，用来代替开朗的问候语。',null,array['거제 야호','巨济呀吼','야호 밈'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 07. trend_score=338.118461427655  류승룡 기모찌!(오버워치)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('634b5127-f0f8-4789-bde7-8a4e4e3042da','zh','genji-kimochi','柳承龙气持（守望先锋源氏梗）','守望先锋源氏大招台词被听成"柳承龙气持"而走红的谐音梗','源氏使用大招时喊出的日语台词"류진노 켄오 쿠라에"，在激烈战斗中被韩国玩家谐音听成类似"柳承龙气持"的发音，这一说法由此在守望先锋玩家间流行开来。','源自守望先锋源氏大招语音台词的谐音误听。','用来玩梗模仿守望先锋源氏大招的语音。',null,array['류승룡 기모찌!(오버워치)','柳承龙气持','기모찌'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 08. trend_score=336.395329763285  낉여오거라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('06f17cd7-f14e-4505-8864-8d6dc071f1a2','zh','boil-it-and-bring-it','煮了端过来（낉여오거라）','用撒娇又理直气壮的语气命令对方把想要的东西拿来的迷因','"낉여오거라"是"끓여오거라（煮了端过来）"的俏皮变形写法，源自NCT WISH유우시对拉面的喜爱而制作的合成图，后来又衍生出小狗版本，从粉丝圈扩散到圈外。2025年流行期间被套用在各种场景中。','源自NCT WISH유우시的粉丝合成图。','用撒娇的语气要求对方做某事时使用。',null,array['낉여오거라','낋여오걸아','끓여오거라 밈'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 09. trend_score=335.980292826121  따름 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('0959de22-26e0-4a84-879a-20ab2804deb5','zh','you-you-challenge','You, You 挑战（따름 챌린지）','TWS歌曲《널 따라가（You, You）》副歌配的踏步舞挑战','这是配合2026年4月发行的TWS第五张迷你专辑主打曲《널 따라가（You, You）》洗脑的"Dda-rum"副歌部分而设计的舞蹈挑战。舞步用富有节奏感的踏步表现想要跟随心仪对象的心情，SEVENTEEN承宽、NCT WISH、EXO Kai等多位偶像参与，带动话题度。模仿身旁人动作的应用版本也随之流行。','随2026年4月TWS专辑《NO TRAGEDY》发行而开始流行。','常用作偶像挑战、翻跳舞蹈内容。',null,array['따름 챌린지','You You 挑战','널 따라가 챌린지'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 10. trend_score=335.980292826121  에픽하이 Love Love Love 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('f3bcf369-937c-465d-bc94-957069a2eddc','zh','epik-high-love-love-love-challenge','Epik High《Love Love Love》挑战','2007年发行的Epik High歌曲经自然形成的短视频挑战时隔19年再度翻红的案例','配合Epik High 2007年发行歌曲《Love Love Love》副歌比划爱心的简单动作，在TikTok、Reels、Shorts上自然兴起，带动这首歌在2026年初重登音源榜单。这首歌创作之初并未考虑过挑战玩法，这一点本身也成为话题；对Z世代而言它是首新歌，对老粉丝而言则唤起了回忆。','2007年发行的Epik High歌曲在2026年经短视频挑战再度翻红。','用旧日名曲以新挑战形式重新流行时提及。',null,array['에픽하이 Love Love Love 챌린지','Love Love Love 挑战'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 11. trend_score=335.251006598946  봉숭아학당 그까이꺼 대충
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('52c381c5-800b-44db-b04b-971653620ce5','zh','suibian-yingfu-meme','随便应付就好（봉숭아학당 그까이꺼 대충）','张东民在2004年凤仙花学堂饰演的保安角色流行语','2004年末起，喜剧节目《搞笑演唱会》"凤仙花学堂"单元中饰演保安角色的张东民，以流行语"那算什么，随便应付一下就好~"展现出再难的事也能轻松解决的机智感。','该流行语源自2004年11月末至2006年4月播出的KBS《搞笑演唱会》"凤仙花学堂"单元的保安大叔角色。张东民于2004年以KBS第19期公开选拔喜剧演员身份出道，饰演一口忠清道方言的保安，常在上课途中突然登场吹嘘一番，再以"那算什么，随便应付一下就好~"收尾逗笑观众，这句流行语从他出道起就让"张东民"这个名字深入人心，此后在多档节目中被反复引用、模仿。','轻松带过一件麻烦事时使用。',null,array['봉숭아학당 그까이꺼 대충','그까이꺼','随便应付就好'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 12. trend_score=334.861437214911  악동뮤지션 K팝스타2 우승
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('8ca5b4db-2cbf-4181-bd50-a9365b7ffacf','zh','akmu-kpop-star-2-win','AKMU夺得《K-Pop Star》第二季冠军','十几岁的兄妹创作歌手组合首次在选秀节目夺冠的事件','2013年SBS《K-Pop Star》第二季中，兄妹组合AKMU（악동뮤지션）凭借自作曲《다리꼬지마》（别翘二郎腿）、《Crescendo》等赢得极高人气，最终夺得总冠军。这创下了选秀节目史上首次由青少年创作歌手夺冠的纪录。','源自2013年4月SBS《K-Pop Star》第二季总决赛。','谈论选秀节目、自创曲话题时提及。',null,array['악동뮤지션 K팝스타2 우승','이찬혁 이수현','AKMU 우승'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 13. trend_score=333.515548268426  12-3-30 챌린지
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('c13a179c-67ce-4a83-809d-4a3614616cf4','zh','12-3-30-challenge','12-3-30挑战','坡度12%、时速3英里走30分钟的跑步机有氧挑战','将跑步机坡度调至12%、以时速3英里的速度行走30分钟的有氧运动方案。其特点是以低强度快走代替跑步来提升心率，达到减脂并刺激下肢与核心肌群的效果，常在减肥打卡类短视频中反复出现。','美国网红Lauren Giraldo（罗伦·吉拉尔多）2019年首次在YouTube公开该方法，2020年11月在TikTok发布同样内容后迅速走红。','介绍减脂、有氧运动方案时用"在做12-3-30"来表达。',null,array['12-3-30 챌린지','12-3-30 트레드밀 챌린지','12330 챌린지'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 14. trend_score=333.515548268426  SK텔레콤 되고송
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('a6478781-ef94-43ce-bcfd-8305eed481af','zh','sk-telecom-doegosong','SK电讯"心想事成之歌"（되고송）','北京奥运期间歌颂正能量的SK电讯"心想事成之歌"广告曲','2008年SK电讯推出以张东健、郑智薰（Rain）为主角、传递正能量信息的"心想事成之歌"广告曲。北京奥运会期间，Epik High演唱的奥运版"心想事成之歌"同样广受欢迎。这首朗朗上口、人人都能跟唱的旋律，被认为推动了积极自我暗示文化的传播。','2008年SK电讯电视广告，由张东健、郑智薰（Rain）出演。','用唱歌般的语气引用来表达"一定会实现"的积极决心。',null,array['SK텔레콤 되고송','장동건 정지훈 되고송','心想事成之歌'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 15. trend_score=330.850152318805  샤갈
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('9e8beb59-6d0c-4d56-87c2-ca41f03927b0','zh','xiagaer-meme','夏噶尔（샤갈）','用来表达无语、慌张情绪的YouTube衍生新造词','该词源自YouTube频道"여단오"中여루常挂在嘴边的口头禅，后在观众间以迷因形式扩散，常用在令人无语或心烦的情境中。借助YouTube短视频、Reels、评论区等渠道迅速传播开来。','源自YouTube频道"여단오"主播的口头禅。','在荒唐或让人心烦的情境下当作感叹词使用。',null,array['샤갈','쌰갈'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 16. trend_score=329.121099113754  파라파라나 춰야겠다
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('06450042-a640-43f2-aadd-02b54bd0614d','zh','parapara-dance-meme','还是跳芭啦芭啦吧（파라파라나 춰야겠다）','用装傻卖萌方式逃避尴尬情况的迷因台词','리센느미나미在巨济岛旅行视频中化着辣妹妆容，在没有伴奏的情况下跳起日式复古舞蹈"芭啦芭啦（파라파라）"，由此说出这句台词。在为难情境下用"管它呢，还是跳芭啦芭啦吧"这种可爱地逃避现实的情绪引发共鸣，成为迷因。','源自리센느원이 YouTube频道巨济岛旅行内容中미나미的辣妹妆环节。','用笑着回避为难或不想做的事情时使用。',null,array['파라파라나 춰야겠다','파라파라 밈'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 17. trend_score=328.649966971128  보아 - No.1
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('83bbcc87-db0d-41bb-aa3b-8d62bae0b07a','zh','boa-no1','BoA-《No.1》','表达志在成为世界级歌手抱负的BoA 2002年欧陆舞曲金曲','该曲是BoA 2002年4月发行的第二张正规专辑主打曲，以明快的欧陆舞曲曲风唱出立志成为世界最佳歌手的抱负。当年销量突破50万张，让BoA正式跻身顶级偶像行列。','2002年4月作为BoA第二张正规专辑主打曲发行。','谈论2000年代初单人偶像全盛期时提及。',null,array['보아 - No.1','보아 2집 타이틀곡'],'[{"situation":"同学聚会","text":"哎提到2000年代初，还得是BoA的No.1啊，那时候真觉得她要\"称霸世界\"了"},{"situation":"SNS评论","text":"一听BoA的No.1，那个年代的欧陆舞曲味儿绝了"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 18. trend_score=327.757392765871  야르
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('78211f0f-3f29-4fa8-aeb5-fcec2a9483ca','zh','yareu-interjection','呀嘞（야르）','与"샤갈"成对使用、表达心情好时的感叹词新造词','意思接近"好棒、好开心、耶"的感叹词，据网络迷因报告称，甚至有"心情不好用샤갈、心情好用야르"这样固定搭配的说法。','与샤갈成对流行的YouTube、社交媒体新造感叹词。','在心情好的情境下当感叹词使用。',null,array['야르','呀嘞'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 19. trend_score=327.07779661869  에휴에요 에휴
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('87b53438-1535-4c84-837b-80ae64cb4f8b','zh','ehyu-eyo-ehyu','唉呀真是唉（에휴에요 에휴）','虚拟主播후야在尴尬场合用半敬语说出的感叹迷因','STELLA LIVE旗下虚拟主播사키하네후야在出道初期，面对观众的调皮玩梗，用她特有的半敬语语气感叹说出这句话，由此成为迷因。这句话如今已成为후야的代表流行语，还被制作成官方表情包。','源自STELLA LIVE후야的出道直播。','在尴尬或无奈的情境下像叹气一样使用。',null,array['에휴에요 에휴','에휴에요','ㅇㅎㅇㅇㅎ'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 20. trend_score=327.07779661869  카라 미스터 엉덩이춤
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('15b6a625-1319-44aa-9791-db3300507166','zh','kara-mister-hip-dance','Kara《Mister》臀舞','Kara歌曲《Mister》中转动骨盆的舞步以"臀舞"之名引发风潮','2009年Kara的《Mister》原本只是专辑里的副打歌，但编舞师裴允贞设计的转胯动作在首播后立刻爆红，风头反而盖过了主打曲。网友们称之为"臀舞"并引发热议，后来这段舞蹈甚至被介绍到日本，成为一种社会现象级的流行。','DSP Media旗下Kara《Mister》（2009）编舞，编舞师裴允贞。','回顾2009年女团标志性舞步风潮时提及。',null,array['카라 미스터 엉덩이춤','미스터 골반춤'],'[{"situation":"聊天软件","text":"这段编舞完全是Kara Mister臀舞级别的洗脑"},{"situation":"SNS评论","text":"Mister这段编舞那时候真的是现象级流行"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 21. trend_score=327.028106538696  고마해라 마이 묵었다 아이가
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('b322f070-fac9-4705-af25-1d16a6f5a79d','zh','gomaehara-friend-movie-line','别闹了，吃够了吧（고마해라 마이 묵었다 아이가）','电影《朋友》（2001）中的经典台词','这是黑帮火拼场面中出现的釜山方言台词，因独特的抑扬顿挫感常被喜剧模仿作品引用。','源自2001年电影《朋友》。','至今仍常作为模仿、模声表演的素材被引用。',null,array['고마해라 마이 묵었다 아이가','고마해라'],'[{"situation":"聊天软件","text":"别闹了，吃够了吧哈哈哈"},{"situation":"SNS评论","text":"这句台词到现在还是模声表演的常客"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 22. trend_score=327.028106538696  쥐롤라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('eb41ea64-cb26-48b9-ae6a-264fa8dcbda5','zh','rat-lola','鼠版罗拉（쥐롤라）','喜剧演员이창호在YouTube《빵송국》翻唱音乐剧曲目而诞生的迷因','2024年8月，YouTube频道"빵송국"的音乐剧扮演企划中，이창호（이호광）翻唱了《长靴皇后（Kinky Boots）》中的《Land of Lola》，因长相神似老鼠而被称为"鼠版罗拉（쥐롤라）"，加入跆拳道动作的版本又被叫作"跆拳罗拉（태권롤라）"。该视频发布约4周播放量突破500万次，一度带动原本对音乐剧不感兴趣的大众走进剧场，助力《长靴皇后》十周年演出售罄。','源自YouTube频道"빵송국"的音乐剧翻唱企划。','常作为喜剧演员YouTube内容衍生迷因的案例被提及。',null,array['쥐롤라','태권롤라','이호광 롤라'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 23. trend_score=326.135532333439  트랄랄레로 트랄랄라
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('f9da7a03-01de-42c3-8e1c-c05af1fccf6b','zh','tralalero-tralala','Tralalero Tralala（트랄랄레로 트랄랄라）','脚踩耐克鞋、长着三条腿的鲨鱼形象引发的意大利语胡言乱语迷因','2025年1月在TikTok上出现的"意大利脑腐（Italian brainrot）"系列首个角色，形象是一只脚穿耐克运动鞋的三腿鲨鱼。低画质AI生成视频配上毫无意义的意大利语歌词是其特征，常与由轰炸机和鳄鱼合体而成的角色"Bombardiro Crocodilo"成对流行。2025年3月在全球扩散，韩国的Reels、Shorts上也涌现出大量模仿作品。','源自TikTok用户上传的AI生成视频，2025年3月起在全球范围扩散。','谈论AI迷因、意大利脑腐话题时提及。','因内容毫无意义，也有人认为它显得幼稚。',array['트랄랄레로 트랄랄라','트랄랄레로트랄랄라','이탈리안 브레인롯'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 24. trend_score=325.601406762941  시추에이션십(Situationship)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('ffa80a30-36b5-4fb8-a1e0-599d2e902625','zh','situationship','Situationship（暧昧关系）','指并非正式恋人却维持着恋人般暧昧关系的新造词','用来形容并未正式确立恋爱关系、却共享情感与身体亲密感的暧昧状态。"我和我的Situationship之间的短信"这类内容形式曾在TikTok上大为流行。这个词虽诞生于2010年代，却是通过TikTok内容才成为大众熟知的新造词。','2010年代出现的新造词，经2023年TikTok内容而大众化传播。','用来描述关系暧昧不明的恋爱状态。',null,array['시추에이션십(Situationship)','Situationship','暧昧关系'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 25. trend_score=324.984804043632  어디출신 미시시피
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('fd84e47d-f496-4ed8-bd18-1fdc9e9e979b','zh','chicago-mississippi-bit','哪里人？密西西比！（어디출신 미시시피）','模仿音乐剧《芝加哥》腹语戏段台词的迷因','音乐剧《芝加哥》曲目《We Both Reached For The Gun》中的腹语戏段台词"哪里人？密西西比！父母呢？超级有钱！"被制作成短视频进行模仿的迷因。2025年6月《芝加哥》重演期间随之流行，也带动了该剧的票房。','源自音乐剧《芝加哥》腹语戏段曲目。','用来模仿、玩梗音乐剧相关内容时使用。',null,array['어디출신 미시시피','시카고 복화술 밈'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 26. trend_score=324.984804043632  코리안특급
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('add632b9-d0f3-4255-908c-7a99c0cd07fe','zh','korean-express','韩国特快（코리안특급）','1994年朴赞浩登陆美国职棒大联盟后获得的绰号','1994年作为韩国首位登陆美国职棒大联盟、效力于洛杉矶道奇队的朴赞浩，参照强投手诺兰·瑞恩（Nolan Ryan）绰号"Ryan Express"获得了"韩国特快"这一绰号，此后成为形容韩国体育明星的惯用修饰语，被广泛沿用。','源自1994年朴赞浩加盟洛杉矶道奇队登陆美国职棒大联盟的相关报道。','谈论韩国体育明星在海外取得成功时引用。',null,array['코리안특급','박찬호 별명'],'[{"situation":"聊天软件","text":"在海外打得这么好，简直是韩国特快啊"},{"situation":"SNS评论","text":"这波表现堪比韩国特快级别"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 27. trend_score=324.984804043632  몬주익의 영웅
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('b6cbf1f5-e67b-4018-9116-0b37a9c79f2a','zh','montjuic-hero','蒙锥克英雄（몬주익의 영웅）','1992年巴塞罗那奥运会马拉松黄英祚获得的绰号','1992年巴塞罗那奥运会马拉松比赛中，黄英祚创下自孙基祯之后时隔56年再度夺金的纪录，他在冲刺前的陡坡"蒙锥克山坡"完成逆转、拼尽全力冲刺后力竭倒地的画面，正是这一绰号的由来。至今在描述最后关头的戏剧性逆转时仍会引用这一说法。','源自1992年8月9日巴塞罗那奥运会马拉松比赛转播。','谈论最后阶段大逆转或拼搏精神时引用。',null,array['몬주익의 영웅','황영조','몬주익 언덕'],'[{"situation":"聊天软件","text":"最后完全逆转了，简直是蒙锥克英雄级别"},{"situation":"SNS评论","text":"这种拼劲就是蒙锥克山坡的重现"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 28. trend_score=324.255517816456  안녕히 계세요 여러분 (퇴사짤)
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('567cca53-4447-4d44-a2a6-270ea099f677','zh','inuyasha-farewell-meme','再见了，各位（퇴사짤）','借用《犬夜叉》韩语配音台词表达辞职的代表性迷因','在日本动画《犬夜叉》韩语配音版中，角色가영（对应原版戈薇）语气平淡地说出"再见了，各位"这句台词，后被固定用作宣告辞职、告别的表情包。凭借配音演员令人印象深刻的演绎，这句台词成为辞职或摆脱某种束缚时使用的国民级迷因。','源自2003年播出的《犬夜叉》韩语配音版某集台词，此后在网络上成为象征辞职与解脱的迷因。','宣告辞职或摆脱困境时用来代替告别语。',null,array['안녕히 계세요 여러분 (퇴사짤)','도비는 자유예요','가영이 퇴사짤'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 29. trend_score=324.255517816456  1577-1577 대리운전 CM송
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('02919210-1247-4b0c-a2b6-fee19cf55364','zh','1577-1577-designated-driver-jingle','1577-1577代驾广告神曲（대리운전 CM송）','把回文式电话号码谱成歌曲、让号码深入人心的代驾广告曲','2008年前后，代驾公司1577-1577推出了"1577-1577代驾"这一前后对称电话号码谱成的广告曲，以此让号码本身深入人心。由姜成范等演唱的这首歌传唱度极高，甚至被收录进音源网站。后来喜剧演员李寿根出任广告代言人，让这首广告曲更加出名。','源自2008年前后1577-1577代驾的电视广告。','作为强调回文式电话号码的广告曲营销案例被引用。',null,array['1577-1577 대리운전 CM송','앞뒤가 똑같은 전화번호'],'[]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;

-- 30. trend_score=324.255517816456  우정의 무대 그리운 어머니
insert into public.meme_translations (meme_id,locale,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,status,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by) values
('d5fbbcff-805a-4141-b203-6109d21823e9','zh','friendship-stage-missed-mother','《友情的舞台》"思念的母亲"环节（그리운 어머니）','军营慰问演出中母子相认的催泪环节','1990年7月起，KBS《友情的舞台》最后一个环节会响起插曲《思念的母亲》，随后思念的母亲会走上舞台与儿子戏剧性重逢，每次播出都让观众落泪。至今提到开头那句"想妈妈的时候"仍是怀旧的象征，常被剪辑成短视频反复播放。','源自KBS《友情的舞台》节目环节（1990年代）。','谈论令人感动的重逢场面时作为比喻引用。',null,array['우정의 무대 그리운 어머니','그리운 어머니','엄마가 보고플 때'],'[{"situation":"聊天软件","text":"这段重逢场面简直是友情的舞台级别的催泪"},{"situation":"SNS评论","text":"一放思念的母亲，眼泪根本忍不住"}]'::jsonb,'machine','2026-07-15T15:30:00.191373+00:00','claude','claude-fable-5',12,now(),null,null) on conflict (meme_id, locale) do nothing;
