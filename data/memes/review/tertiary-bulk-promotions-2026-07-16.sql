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
    '이탈리안 브레인롯', 'TikTok', 'https://www.tiktok.com/@privat.pribat/video/7483500935264718085',
    '7483500935264718085', 'bye bye tung tung tung sahur😭#fyp #foryou #foryoupage #viral #tiktok #tung #sahur #ramadhan', 'Privat Pribat'
  ),
(
    '이탈리안 브레인롯', 'TikTok', 'https://www.tiktok.com/@gof_history_no1/video/7484560212570000645',
    '7484560212570000645', 'Berita Duka: "Tung Tung Tung Sahur" Kembali ke Planetnya 🚀💔 Kabar duka datang dari dunia Ramadan. Sosok yang telah setia menemani umat Muslim setiap dini hari dengan suara khasnya, "Tung Tung Tung Sahur", dikabarkan telah kembali ke planet asalnya. 🌙😢 Selama bertahun-tahun, ia telah menjadi bagian tak terpisahkan dari kehidupan masyarakat, membangunkan mereka dengan penuh semangat agar tidak melewatkan waktu sahur. Namun kini, tanpa ada tanda-tanda sebelumnya, ia meninggalkan kita semua. 💔', 'GOF HISTORY'
  ),
(
    '트랄라레로 트랄랄라', 'TikTok', 'https://www.tiktok.com/@duck.editsxzz/video/7469860358937677061',
    '7469860358937677061', 'tralalero tralala 🦈#isagi #tralalerotralala #edit #anime #bluelock #animeedit #bluelockedit #viral', '𝑼𝒏𝒊𝒗𝒆𝒓𝒔𝒂𝒍 𝑫𝒖𝒄𝒌 ネ'
  ),
(
    '트랄라레로 트랄랄라', 'TikTok', 'https://www.tiktok.com/@kintaro.ae/video/7471967149796625687',
    '7471967149796625687', 'Tralalero tralala kono diavolo daaaa #jojosbizarreadventure #jojo #jjba #mangaedit #viral #diavolo #goldenwind @xsalada 愛', 'ᴋɪɴᴛᴀʀᴏ⭑'
  ),
(
    '트랄라레로 트랄랄라', 'TikTok', 'https://www.tiktok.com/@matias_v77/video/7459109987680390405',
    '7459109987680390405', 'Tralalero tralala: pt 2 #tralalerotralala #عربي #memes #pinchitiktokponmeenparati', 'Matías†'
  );

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> 5 then
    raise exception 'limited promotion target count expected 5, matched %', matched;
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
