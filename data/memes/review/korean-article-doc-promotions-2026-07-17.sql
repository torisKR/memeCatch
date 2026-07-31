begin;
create temporary table contextual_social_promotion_batch (
  meme_title text not null,
  source_platform text not null,
  source_url text primary key,
  content_id text not null,
  title text not null,
  creator_name text not null
) on commit drop;

insert into contextual_social_promotion_batch (
  meme_title, source_platform, source_url, content_id, title, creator_name
) values
(
    '이탈리안 브레인로트', 'TikTok', 'https://www.tiktok.com/@brainrot70207/video/7510440097985137976',
    '7510440097985137976', 'LA VACA TRIPA TROPA BOMBOMBINI GUSINI TRALALA LIRILIRA TUNG TUNG SAHUR BONEKA TUNG TUNG TRALALELO CAPUCCINO ASSASSINE TRIPI TROPA CROCODINA FRULI FRULA ,GRANDE FUSÃO DE BRAIN ROT #brairot #aleatorio #ia #chatgptmemes #fypシ゚viral', 'Brazilian Brainrots'
  ),
(
    '이탈리안 브레인로트', 'TikTok', 'https://www.tiktok.com/@brainrot70207/video/7518526853179591941',
    '7518526853179591941', 'Udin din din din din din din dun Mateoooo Tá Tá Tá Tá Tá Tá Tá Tá Tá Garamararamararaman Sigma Capuccino Sahur , simplesmente uma aberração colossal, uma fusão de fusões estranhas,brain rot absurdo!. #brairot #brairotquiz #aleatorio #fypシ゚viral #fypシ゚viral🖤tiktok', 'Brazilian Brainrots'
  ),
(
    '이탈리안 브레인로트', 'TikTok', 'https://www.tiktok.com/@doge135/video/7529801376944164114',
    '7529801376944164114', 'Sahur Combination#Brainrot#ai#sahur#mergefellas', 'DOGE'
  ),
(
    '이탈리안 브레인로트', 'TikTok', 'https://www.tiktok.com/@random.rush6/video/7535734246535728392',
    '7535734246535728392', '#lasupremacombinacion #fyppppppppppppppppppppppp #creator #fyppppppppppppppppppppppp #brainrot', 'Random Rush'
  ),
(
    '이탈리안 브레인로트', 'TikTok', 'https://www.tiktok.com/@brainrot70207/video/7521876614548966661',
    '7521876614548966661', 'KAKASITO LA VACA TRIPA TROPA BOMBOMBINI GUSINI TRALALA LIRILIRA TUNG SATALITO TUNG SAHUR BONEKA TUNG TUNG TRALALELO CAPUCCINO ASSASSINE TIRILIKALIKA TRIPI TRENOSTRUZZO TURBO 3000 TROPA CROCODINA FRULI CROCODILDO PENOSINI FRULA BULBITO BANDITO TRAKTORITO ,FUSÃO DE BRAIN ROT ASSOLUTAMENTE FOLLE. #brairot #aleatorio #brairotquiz #fypシ゚viral #fypシ゚viral🖤tiktok #absurdo', 'Brazilian Brainrots'
  ),
(
    '이탈리안 브레인로트', 'Instagram', 'https://www.instagram.com/reel/DJh0DEzqXpC/',
    'DJh0DEzqXpC', 'Final: Lirili Larila🐘 VS Tung Tung Sahur 🪵 #brainrot #fishyai #aianimation #fypppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppp #tungtungtungsahur #lirililarila', 'fishy.ai.animation'
  ),
(
    '이탈리안 브레인로트', 'Instagram', 'https://www.instagram.com/reel/DH9V3RloEas/',
    'DH9V3RloEas', 'Italian Brainrot THE Tournament 😳💥 Part 1 #brainrot #italianbrainrot #aianimation #tungtungtungsahur #fishyai', 'fishy.ai.animation'
  ),
(
    '럭키비키', 'Instagram', 'https://www.instagram.com/p/C6LbwyyLCRq/',
    'C6LbwyyLCRq', '원영적사고로 일주일만 기다리면 갓 나온 미니핑계고를 볼수잇으니 정말럭키계원이잔앙🤭 ⬇️계주 팬싸 실황 공개⬇️ 2024.05.02(Thu) 12PM KST', 'ddeun._.ddeun'
  ),
(
    '럭키비키', 'Instagram', 'https://www.instagram.com/p/C6Pg1X_y-_N/',
    'C6Pg1X_y-_N', '벌써 4월 끝나.. 하지만 원영적 사고를 하면 아직 2024년이 8개월이나 남은거잖아? 진짜 몇개월만 줘도 더 알차게 살 수 있다고 생각했는데 완전 럭키잖아🍀! ‘원영적 사고’의 시작, 원영( @for_everyoung10 )이 빵집에 갔을때 마침 구매하려던 빵이 매진됐는데요. 🥖 그때 기다리는 걸 슬퍼하기 보다 ''럭키하게 갓 나온 빵을 받게 되었다’며 좋아하는 모습이 퍼지게 된거죠. 🩷🍒 장원영은 평상시에도 긍정적인 태도와 언행으로 유명했답니다(이미지 ② ③). 이런 긍정적인 사고는 아모레퍼시픽 리브랜딩 세미나에도 등장했죠! (이미지 ④)👩‍🏫 오전 8시에 토요밈을 올리는 저라면요 ▪️ 긍정적 사고: 토요일에 일찍 토요밈을 올리면 생산적이잖아! ▪️ 부정적 사고: 주말에 일찍 일어나서 토요밈을? ▪️ 원영적 사고: 오늘 조조 영화를 보려고 했는데 마침 토요밈을 8시에 올려야 하는거야! 혹시 못 일어나서 조조 영화를 놓치면 어떡하지 생각했는데 둘 다 할 수 있으니 완전 럭', 'harpersbazaarkorea'
  ),
(
    '럭키비키', 'Instagram', 'https://www.instagram.com/p/C6dfHxzP864/',
    'C6dfHxzP864', '오늘 너무 무난하게 입고 나와서 포인트가 있으면 좋겠다고 생각했는데 코끝이랑 입 밑에 여드름 포인트가 두개나 생긴거야! 😄😄😄완전 럭키비키잖앙🍀', 'dbqudwo333'
  ),
(
    '럭키비키', 'Instagram', 'https://www.instagram.com/reel/C8whtAzSWHO/',
    'C8whtAzSWHO', '3이닝만에 너무 크게 기운 경기🥲 ═════════════ 프로야구가 너무 길면 #크보짤 ⚾ @KBZ_baseball ═════════════ #야구 #야구짤 #야구스타그램 #kbo #크보 #프로야구 #⚾ #기아타이거즈 #키움히어로즈 #기아팬 #기아타이거즈팬 #갸팬 #원영적사고 #럭키비키 #긍정 #긍정적인생각 #야구팬 #공감 #공감스타그램 #야구관람 #야구직관 #웃긴짤 #웃긴영상', 'kbz_baseball'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 11 then
    raise exception 'limited promotion target count expected 11, matched %', matched;
  end if;
end $$;

insert into meme_contents (
  meme_id, type, platform, content_id, url, caption,
  is_representative, availability, moderation_status
)
select
  meme.id, 'embed', batch.source_platform, batch.content_id, batch.source_url,
  batch.title, false, 'live', 'approved'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1 from meme_contents existing where existing.url = batch.source_url
);

insert into meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status
)
select
  meme.id, batch.source_platform, batch.source_url, batch.title,
  batch.creator_name, 'embeddable'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1 from meme_sources existing where existing.source_url = batch.source_url
);
commit;
