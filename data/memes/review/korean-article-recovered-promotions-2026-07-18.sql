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
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C8tpuSRPQPY/',
    'C8tpuSRPQPY', 'やれやれ~ 못 말리는 구마유씨~ やれやれ~ No one can stop ‘Gumayusi’~ #T1WIN #T1Fighting', 't1lol'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C5ViEzOPHqo/',
    'C5ViEzOPHqo', '잘자요 ‧₊˚ ☁️⋅♡🪐༘⋆ your girl Dasha loves making dance videos lol', 'taaarannn'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C6axDLpP9Ki/',
    'C6axDLpP9Ki', '어때???우리 #못말리는아가씨 들~~~😎😅✌🏻 #moonbyul', 'mo_onbyul'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C5ih-xnyALY/',
    'C5ih-xnyALY', '#잘자요아가씨 @needmorecash_vdbh @tanaka_oishikunare @gwana9102', 'mimi__minu'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C6x81_-LLYp/',
    'C6x81_-LLYp', '잘자요 아가씨🔔 🎈팝업스토어 장소 & 일정🎈 🌿 고양 스타필드: 5월 8일 ~ 5월 21일 🌿 안성 스타필드: 5월 23일 ~ 6월 6일 🌿 신세계사이먼 파주: 5월 주말 및 공휴일 🌿 더현대 대구: 5월 3일 ~ 5월 26일 #브레드이발소 #애니메이션 #릴스 #유행 #재밌는 #영상 #밈 #캐릭터 #브레드 #이발 #이발사 #미용 #이발 #먹스타그램 #미용 #animation #dessert #makeup #잘자요아가씨 #집사 #야레야레 #스타필드팝업스토어 #브레드이발소팝업 #가정의달', 'breadbarbershop'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C7MTq8zylP0/',
    'C7MTq8zylP0', 'It’s time to go to bed❤️', 'koi_liyuu'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C5vh8hfJQxC/',
    'C5vh8hfJQxC', 'お嬢さん, it’s time to go to bed🌙✨ #OnlyOneOf #온리원오브 #KB #Rie #규빈 #리에', 'onlyoneofofficial'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C8wPlvoo51z/',
    'C8wPlvoo51z', 'やれやれ~ No one can stop @nuclearint See you tomorrow for the return of the #LEC 내일 LEC 경기에서만나요 #lec #t1 #leagueoflegends #faker #gumayusi', 'bds_esports'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C7Th63fSVZi/',
    'C7Th63fSVZi', '야레야레, 못 말리는 모사챙 🌹 #TWICE #트와이스 #MOMO #모모 #SANA #사나 #CHAEYOUNG #채영', 'twicetagram'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/p/C6oL0KyvcMM/',
    'C6oL0KyvcMM', '잘자요아가씨 챌린지! 다나카의 도움으로 궤도와 함께 도전해봤습니다! 못말리는 아저씨(!?)가 되고 말았지만, 그래도 행복했던 시간이었네요ㅎㅎㅎ;;; 함께 해줘서 기운 실어준 궤도에게 무한 감사!! 몸치 지도해주느라 고생한 다나카! 아리가토우!!!♡.♡ #잘자요아가씨 #다나카 #궤도 #성우남도형', 'namdo8303'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C58XpjNSSH6/',
    'C58XpjNSSH6', '목 말리 아가씨 차 한잔 하세요 🫖', 'tenlee_1001'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C6EBKPOJnRn/',
    'C6EBKPOJnRn', 'やれやれ 못말리는 리오씽💗 #XODIAC #소디엑 #LEO #리오 #SING #씽', 'xodiacofficial'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/reel/C5-XPsCyWa5/',
    'C5-XPsCyWa5', 'やれやれ-, 못말리는 멍또캣...☆ 100일을 넘어 앞으로 시청자들을 더욱 제대로 모시겠습니다. 매주 목요일 저녁은 멍또캣과 함께 춤을 춰요☆ #엠카운트다운 #MCOUNTDOWN #ZEROBASEONE #성한빈 #BOYNEXTDOOR #명재현 #RIIZE #소희', 'mnet_official'
  ),
(
    '잘자요 아가씨', 'Instagram', 'https://www.instagram.com/p/DP3kynAEuUp/',
    'DP3kynAEuUp', '제가 작곡한 “잘자요 아가씨” 음원이 인스타그램에서 없어졌습니다 중국에서 편곡해 신규등록해서 원곡 소유권이 강제로 이전되었다네요 얼마전에 제 채널에서 “곡 빼앗겼다”는 농담으로 어그로를 끌었었는데 벌받은건지... 이번에는 진짜 입니다. 싸울 힘도 없고 방법도 몰라서 어떻게 해야할지 모르겠네요 일단은 소리쳐 봅니다 슬픕니다 (피드에 쓰인 음원은 중국업체의 음원입니다)', 'gwana9102'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8zLIj1hMmx/',
    'C8zLIj1hMmx', '사라진 TIRAMISU CAKE와 T라 미숙해😶 #KYUNGMIN #경민 #DOHOON #도훈 #TWS #투어스', 'tws_pledis'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8WewBTxVK5/',
    'C8WewBTxVK5', '동그란 티라미수 케이크 🍰 #IVE #아이브 #アイヴ #REI #레이 #レイ', 'ivestarship'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8gKbXby0KF/',
    'C8gKbXby0KF', '티라미ㅅ..슈..ㅏ랑했나봐.. 후루루루루 🔫 #방예담 #BANGYEDAM @bangyedam_0257', '_yedam_official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8ULkRSv1ft/',
    'C8ULkRSv1ft', 'TIRAMISU CAKE☕️ (🤳: #수현 ) #SIYOON #시윤 #Billlie #빌리', 'billlie.official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8Rwk7hhqEl/',
    'C8Rwk7hhqEl', '𝑡𝑖𝑟𝑎𝑚𝑖𝑠𝑢 𝑑𝑎𝑛𝑐𝑒..🍰 #THEBOYZ #더보이즈 #YOUNGHOON #영훈', 'official_theboyz'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8t3jPVSeSC/',
    'C8t3jPVSeSC', '𝑻𝒊𝒓𝒂𝒎𝒊𝒔𝒖 𝑪𝒂𝒌𝒆🎱', 'saythename_17'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8otus3v6lP/',
    'C8otus3v6lP', 'a slice of 티라미뀨 🍰 so 달콤행 #NMIXX #엔믹스 #해원 #HAEWON #규진 #KYUJIN', 'nmixx_official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8ovcS3PZHY/',
    'C8ovcS3PZHY', 'but T라미숙행 🍰 #NMIXX #엔믹스 #해원 #HAEWON #규진 #KYUJIN', 'nmixx_official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C8MyF7UvL0a/',
    'C8MyF7UvL0a', '#NCTWISH made #티라미수케익 🙂‍↕️', 'nctwish_official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C9EUbRVS5kN/',
    'C9EUbRVS5kN', '𝕋𝕚𝕣𝕒𝕞𝕚𝕤𝕦 𝕔𝕒𝕜𝕖🍰 #VIVIZ #비비지 #EUNHA #은하 #SINB #신비 #UMJI #엄지', 'viviz_official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C9xFZCBBBB5/',
    'C9xFZCBBBB5', 'Tiramisu Cake~😽 #BOYNEXTDOOR #보이넥스트도어 #BND #성호 #리우 #운학', 'boynextdoor_official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://instagram.com/p/C8ljA6up_xE/',
    'C8ljA6up_xE', 'T아니라 안 미숙해 🎂 #ZEROBASEONE #ZB1 #제로베이스원 #SUNGHANBIN #ZHANGHAO #KIMGYUVIN #성한빈 #장하오 #김규빈', 'zb1official'
  ),
(
    '티라미수 케익 챌린지', 'Instagram', 'https://www.instagram.com/reel/C9T350VvtCI/',
    'C9T350VvtCI', '#오백에삼십 #대학로 #JTN아트홀 #연극오백에삼십배우들 #티라미수케잌🎂 #릴스 #화이팅콜 댓글 모두 보기', '_seul___e'
  ),
(
    '두바이초콜릿', 'Instagram', 'https://www.instagram.com/p/DJD0T_Dpob0/',
    'DJD0T_Dpob0', '모찌쿠키 원조 몬트쿠키✨ 2세대 쫀득쿠키인 모찌쿠키의 인기가 미쳤어욤,,,🧡 특히 두바이 초콜릿...🤤 많은 분들이 요청해주시고 기다려주신 탓일까욥!? 다들 맛있게 드셔주셔서 너무 행복한 요즘이랍니당! #몬트쿠키 #쫀득쿠키 #2세대쫀득쿠키 #모찌쿠키', 'mondcookie_official'
  ),
(
    '두바이초콜릿', 'Instagram', 'https://www.instagram.com/p/DIOsHXuh9NX/',
    'DIOsHXuh9NX', '달팀이 작년부터 생각해오던 두바이 쫀득 쿠키 ..,, 드디어 출시했습니다!!! 달라또 팀원분들이 여러번 신메뉴 테스트 끝에 탄생되었습니다 😍🥹💛 그래서 더 소중한 신메뉴! 두바이 손 많이 가는 거 아시죠,,? 😔 제조하는 데 반나절 걸리지만.. 그만큼 행복한 맛 🤤 #달라또 #달라또쫀득쿠키 #쫀득쿠키 #달라또팝업 #마시멜로우쿠키 #두바이초콜릿', 'dallatto.ee'
  ),
(
    '두바이초콜릿', 'Instagram', 'https://www.instagram.com/reel/DHubjNHhBCv/',
    'DHubjNHhBCv', '두바이초코 아직도 좋아해주시는 분들 많으시죠 😊 요즘 대세인 쫀득쿠키와 두바이 맛을 한 번에 !!! 두바이쫀득쿠키는 아직 제가 못 본 것 같은데요 …🫢 나무네에 가득 준비해 두었으니 어서 오세요 🫶 댓글 모두 보기', 'namune_bam'
  ),
(
    '두바이초콜릿', 'Instagram', 'https://www.instagram.com/reel/DJ9b0IJvAhm/',
    'DJ9b0IJvAhm', '두바이쫀득쿠키 신상왔자나요💥 요청이 얼마나 많았는지 몰라요!!! 이게 모찌야 쫀득쿠키야... 이거 한입먹으면 에? 모찌아닌가 헷갈려요 진짜 세상쫀득ㅋㅋㅋㅋㅋ 카다이프 한가득 뭉쳐서 딱 때려넣어서 아주 옹골찬녀석🤎 출시기념으로 매장에서 5만원이상 구매시 두바이쫀득쿠키 묻지도 따지지도 않고 드립니다잉🫢 잡솨보세요 재구매하실거라는 자신이 있움 ✌🏻 쟁이실 분덜 낼 팔레트루 모이세요오??? 🖤 5월23일(금)매장 라인업 👉🏻 두바이시리즈 New 두바이쫀득쿠키 ,두바이초콜렛,두바이쿠키 두바이수건케이크,두바이떠먹케,두바이초코마카롱 macaron New두바이초코, 생딸기요거트,생딸기초코,해피히포,코코넛돌체,소금바닐라,지구젤리,콜비잭치즈,쑥,밀크티,초코바나나,레몬,고메앙버터,레밍턴,돼지바,순수우유,피스타치오,꼬숩흑임자 크렘브륄레,말차가나슈,레드벨벳,고구마치즈케이크,복숭아요거트♥️,황치즈,얼그레이가나슈,콘스프,생초코녹차,맛있구마 cake 생딸기수건케이크 두바이수건케이크 생망고수건케이크', 'palette_dessert_'
  ),
(
    '아무노래 챌린지', 'Instagram', 'https://www.instagram.com/p/B7ae-Q2BUwC/',
    'B7ae-Q2BUwC', '지코님이 이걸 보신다면 우리언니 금지도 알아주셨으면 좋겠다. 금지는 지코를 좋아해.. #지코 #양팡 #아무노래챌린지 #anysongchallenge #내가젤씹어먹은듯', '_eunz1nara_'
  ),
(
    '너 T야?', 'Instagram', 'https://www.instagram.com/reel/C-cDaNEyYAU/',
    'C-cDaNEyYAU', '삑! 너 T야? ep.5 모바일 기후동행카드 단기권 편 서울여행을 계획 중이라면?🧳 모바일티머니로 교통비 부담을 덜어 보세요! 지금 모티 앱에선 모바일 기후동행카드 관광객용 단기권 반값 할인 중!🤗 모티에선 단기권 반값이니까 대중교통 하루 2번만 타도 완전 이득👍 #EVENT 모바일 기후동행카드 단기권 이벤트 📍이벤트 기간: 2024년 8월 1일 ~ 8월 31일 📍이벤트 대상: 이벤트 기간 내 모바일 기후동행카드 단기권 발급 후 대중교통 1회 이상 이용한 회원 🎈서울여행 필수템 기후동행카드 단기권🎫 모바일티머니에서 모바일카드 발급 받고 반값으로 서울 여행해요 삑!🤳 삑은 티머니야!🐰🤍 #티머니 #Tmoney #삑 #모바일티머니 #mobiletmoney #기후동행카드 #기후동행카드관광객용단기권 #기후동행카드단기권 #모바일기후동행카드단기권 #서울여행 #교통비할인', 'tmoney_insta'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 33 then
    raise exception 'limited promotion target count expected 33, matched %', matched;
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
