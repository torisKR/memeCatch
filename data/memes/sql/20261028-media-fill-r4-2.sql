begin;
create temporary table w_new (meme_id uuid primary key, vid text not null, title text not null, channel text, channel_id text, dur int, pub timestamptz, role text not null) on commit drop;
insert into w_new values
('e90e6d86-fe24-4353-92ee-cc95f8efc378'::uuid,'xqFvYsy4wE4','비 RAIN - 깡 GANG Official M/V','GENIE MUSIC','UCd-OrgPLrnQiQBcq19j5oEQ',201,'2017-12-01T09:00:04Z'::timestamptz,'original'),
('ecd8bfa2-d86b-4382-bcb7-3626c4de6bd8'::uuid,'moSFlvxnbgk','Disney''s Frozen "Let It Go" Sequence Performed by Idina Menzel','Walt Disney Animation Studios','UC_976xMxPgzIa290Hqtk-9g',219,'2013-12-06T17:00:01Z'::timestamptz,'original'),
('7209c741-76e3-4866-9179-2e92e829199f'::uuid,'3N5g9BgM1To','박군-한잔해','OGAM Entertainment','UCkN6oIPrS-ovf5AU9BD7KCg',121,'2019-09-17T03:00:01Z'::timestamptz,'original'),
('be639eae-85ae-4f5e-8824-77d5bdf40554'::uuid,'sHstA_eS7Ck','[MV] Park Hyun Bin(박현빈) _ Just trust me(오빠만 믿어)','1theK (원더케이)','UCweOkPb1wVVH0Q0Tlj4a5Pw',213,'2022-11-08T20:00:30Z'::timestamptz,'original'),
('85436040-fd82-493a-9bd6-279aabaa6630'::uuid,'ZsDlobuBQsg','【풀버전】 임영웅 - 어느 60대 노부부 이야기 🔥미스터트롯 기부금 팀미션 뽕다발🔥','미스&미스터트롯','UCskIKQGpjI5sG2ZLtWLYSmw',306,'2020-02-20T15:49:22Z'::timestamptz,'official_reupload'),
('186fcc90-787d-4af6-9a82-87719e20b193'::uuid,'hznH0u-g0vA','태진아 - 사랑은 아무나 하나 (가요베스트 2013)','여수MBC Music+(Kpop&Trot)','UCwIiyFphTd-eTeLBvh8riNw',193,'2019-03-13T09:26:39Z'::timestamptz,'official_reupload'),
('ab3f2787-000b-4c00-88b7-9c220420dd20'::uuid,'XyUGtgfvRjI','The Shark Dance | Sing Along with Baby Shark | Pinkfong Songs for Children','Baby Shark - Pinkfong Kids’ Songs & Stories','UCcdwLMPsaU2ezNSJU1nFoBQ',108,'2019-01-12T23:00:01Z'::timestamptz,'original'),
('5fcb16cd-525d-4e6c-ab21-3a06fdaf4cbe'::uuid,'Ek9LHfsDfL4','콜드플레이(Coldplay): Viva la vida - 20170416 떼창의 끝','사브레 Sable','UCYHmeTv7hdYJgfh4l3XnmyQ',234,'2017-04-19T09:45:34Z'::timestamptz,'usage_example'),
('ed9458d2-a5b5-44fb-ad1c-5c378eba9965'::uuid,'lkQ6uHr0TQE','Megan Thee Stallion - Savage [Animated Video]','Megan Thee Stallion','UCKrdjiuS66yXOdEZ_cOD_TA',161,'2020-05-21T18:57:33Z'::timestamptz,'original');

do $$
declare n int;
begin
  select count(*) into n from w_new b join public.memes m on m.id=b.meme_id
   where m.origin_kind <> 'house_original' and m.moderation_status in ('approved','limited') and m.published_at is not null
     and not exists (select 1 from public.meme_contents c where c.meme_id=b.meme_id and c.content_id=b.vid)
     and not exists (select 1 from public.media_sources s join public.meme_media l on l.source_id=s.id where s.external_id=b.vid and l.meme_id=b.meme_id);
  if n <> 9 then raise exception 'W r4-2 preflight expected 9, matched %', n; end if;
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
  if n <> 9 then raise exception 'W r4-2 source resolve expected 9, got %', n; end if;
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
  if n <> 9 then raise exception 'W r4-2 content insert expected 9, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', meme_id::text||':'||source_id::text,
  jsonb_build_object('source_role', role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-r4-2')
from w_src;
commit;
