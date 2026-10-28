begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('902ea050-764e-4347-8631-4a2d52eb1c83'::uuid,'gxlYYkKTcU8','Jo Hang Jo (조항조) - Thank You (고맙소)','DanalEntertainment','UCpmctTnUfbeoycGhieZQAmw',234,'2017-08-31T04:08:34Z'::timestamptz,'official_reupload'),
('bd77ec8b-c952-4918-815c-4b355d5797ec'::uuid,'pKLg0YoGE5I','김흥국 -  ''호랑나비'' [가요톱10, 1989]','Again 가요톱10 : KBS KPOP Classic','UCmZ19AIj_wcpwRcqG7p9L8g',161,'2018-10-02T05:14:31Z'::timestamptz,'official_reupload'),
('ed5d85ea-ba54-4fdf-87d1-e31be80a0b05'::uuid,'Pbl1g8V04KE','김연자 - 아모르파티 [열린 음악회/Open Concert] | KBS 230507 방송','KBS 레전드 케이팝','UCR5cyf8hncN_AaQPfmvmlgA',219,'2023-05-07T12:13:12Z'::timestamptz,'official_reupload'),
('f8ae9912-e61d-422d-ba1b-edefcf563eda'::uuid,'_JtCu1-nDfc','말달리자 - 크라잉넛 [더 시즌즈-최정훈의 밤의공원] | KBS 230818 방송','KBS Kpop','UCeLPm9yH_a_QH8n6445G-Ow',221,'2023-08-18T13:48:54Z'::timestamptz,'official_reupload'),
('4b040a82-8ff5-4193-8b4d-29f0260d2a31'::uuid,'xnKsDmx4HbM','다함께 차차차 - 설운도 [가요무대] 20190506','KBS Kpop','UCeLPm9yH_a_QH8n6445G-Ow',165,'2019-05-06T14:41:48Z'::timestamptz,'official_reupload'),
('ae22e1de-8d15-4bbd-94b4-a138178b96ae'::uuid,'wGVRIqOk0yM','버스커버스커_벚꽃엔딩(Cherry Blossom Ending by BuskerBusker@Mcountdown_2012.04.12)','Mnet K-POP','UCbD8EppRX3ZwJSou-TVo90A',277,'2012-04-16T07:53:37Z'::timestamptz,'official_reupload'),
('1417d177-84fc-41af-bb48-8a9bae477782'::uuid,'EdIEZFrRlqg','이등병의 편지','Kim Kwang Seok - Topic','UCLhEkkNFkGjOUI77xhqUcTA',289,'2022-07-18T23:20:38Z'::timestamptz,'original');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid)
     and not exists (select 1 from public.media_sources s join public.meme_media l on l.source_id=s.id where s.external_id=b.vid and l.meme_id=b.meme_id);
  if n <> 7 then raise exception 'W r4-3 preflight expected 7, matched %', n; end if;
end $$;

insert into public.media_sources (platform, external_id, canonical_url, title, channel_name, channel_id, platform_published_at, duration_seconds, public_status, embeddable, license_code, thumbnail_url, metadata_refreshed_at, metadata_expires_at, last_checked_at)
select distinct on (vid) 'youtube', vid, 'https://www.youtube.com/watch?v='||vid, title, channel, channel_id, pub, dur, 'public', true, 'youtube', 'https://i.ytimg.com/vi/'||vid||'/hqdefault.jpg', now(), now()+interval '30 days', now()
from w_new b where not exists (select 1 from public.media_sources s where s.external_id=b.vid or s.canonical_url='https://www.youtube.com/watch?v='||b.vid)
order by vid;

update public.media_sources s set public_status='public', embeddable=true, removed_at=null,
  title=coalesce(s.title,b.title), channel_name=coalesce(s.channel_name,b.channel), channel_id=coalesce(s.channel_id,b.channel_id),
  thumbnail_url=coalesce(s.thumbnail_url,'https://i.ytimg.com/vi/'||b.vid||'/hqdefault.jpg'),
  last_checked_at=now(), metadata_refreshed_at=now(), metadata_expires_at=now()+interval '30 days'
from (select distinct on (vid) * from w_new order by vid) b
where s.external_id=b.vid and s.platform='youtube' and s.canonical_url='https://www.youtube.com/watch?v='||b.vid;

create temporary table w_src on commit drop as
select b.*, s.id as source_id from w_new b join public.media_sources s on s.platform='youtube' and s.external_id=b.vid;

do $$
declare n int;
begin
  select count(*) into n from w_src;
  if n <> 7 then raise exception 'W r4-3 source resolve expected 7, got %', n; end if;
end $$;

insert into public.meme_media (meme_id, source_id, source_role, rights_basis, review_state, reviewer_note, reviewed_at)
select meme_id, source_id, role, 'official_embed', 'approved', '20261028 media-fill: videos.list public/embeddable/KR ok, title+channel match', now() from w_src;

insert into public.meme_sources (meme_id, platform, source_url, title, creator_name, captured_at, copyright_status, source_role, rights_basis)
select b.meme_id, 'YouTube', 'https://www.youtube.com/watch?v='||b.vid, b.title, b.channel, now(), 'embeddable', b.role, 'official_embed'
from w_src b where not exists (select 1 from public.meme_sources s where s.meme_id=b.meme_id and s.source_url='https://www.youtube.com/watch?v='||b.vid);

update public.meme_contents c set is_representative=false
from w_src b where c.meme_id=b.meme_id and c.is_representative and c.availability <> 'live';

do $$
declare n int;
begin
  insert into public.meme_contents (meme_id, type, platform, content_id, url, thumbnail_url, caption, is_representative, availability, moderation_status)
  select b.meme_id, 'embed', 'YouTube', b.vid, 'https://www.youtube.com/watch?v='||b.vid, 'https://i.ytimg.com/vi/'||b.vid||'/hqdefault.jpg', b.title,
         not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.is_representative and c.availability='live' and c.moderation_status='approved'),
         'live', 'approved'
  from w_src b;
  get diagnostics n = row_count;
  if n <> 7 then raise exception 'W r4-3 content insert expected 7, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r4-3')
from w_src;
commit;
