begin;
create temporary table w_batch (meme_id uuid, source_id uuid, content_row_id uuid, vid text, title text, channel text, channel_id text, dur int, pub timestamptz, role text) on commit drop;
insert into w_batch values
('3079361a-a04c-4735-98dd-fbc73de361c6'::uuid,'4ae83790-3f6b-426c-bd8f-46d0f1235ab1'::uuid,'f7bd466a-801d-462c-ba1a-2c379e4758d2'::uuid,'FwQy8Da2u00','[공익광고협의회] 2010 모습은 비슷해도 결과는 정반대','KOBACO공익광고협의회','UCye2hHMAa227XlXM3So4_Og',33,'2019-08-09T02:13:50Z'::timestamptz,'original'),
('367762b0-f5ed-47f1-8999-72cf8b2b9d29'::uuid,'b1543e88-6593-4172-b10b-b322eb9e1508'::uuid,'745bb7ef-9a6a-4012-babb-c4d3a1aad169'::uuid,'0GUS2pLDnQk','버억~ 치킨먹다 인생작 찍었습니다 버억먹방대결 《기훈X햄벅》 | 후라이드 참 잘하는 집 허니버터 치킨먹방','도아TV','UCOqeF8PL2vH0vsRD_tnzY8Q',120,'2018-12-19T13:00:00Z'::timestamptz,'usage_example');

do $$
declare n int;
begin
  select count(*) into n from w_batch b
    join public.memes m on m.id=b.meme_id and m.origin_kind <> 'house_original'
    join public.meme_contents c on c.id=b.content_row_id and c.meme_id=b.meme_id and c.content_id=b.vid and c.platform='YouTube' and c.type='embed' and c.availability='dead' and c.moderation_status='approved'
    join public.media_sources s on s.id=b.source_id and s.external_id=b.vid and s.platform='youtube' and s.canonical_url='https://www.youtube.com/watch?v='||b.vid
    join public.meme_media l on l.meme_id=b.meme_id and l.source_id=b.source_id and l.review_state='approved';
  if n <> 2 then raise exception 'W existing preflight expected 2, matched %', n; end if;
end $$;

update public.media_sources s set
  public_status='public', embeddable=true, removed_at=null,
  title=b.title, channel_name=b.channel, channel_id=b.channel_id, duration_seconds=b.dur, platform_published_at=b.pub,
  thumbnail_url='https://i.ytimg.com/vi/'||b.vid||'/hqdefault.jpg',
  last_checked_at=now(), metadata_refreshed_at=now(), metadata_expires_at=now()+interval '30 days'
from w_batch b where s.id=b.source_id;

update public.meme_media l set source_role=b.role, rights_basis='official_embed', reviewed_at=now()
from w_batch b where l.meme_id=b.meme_id and l.source_id=b.source_id;

update public.meme_sources ms set platform='YouTube', title=b.title, creator_name=b.channel, captured_at=now(),
  copyright_status='embeddable', source_role=b.role, rights_basis='official_embed'
from w_batch b where ms.meme_id=b.meme_id and ms.source_url='https://www.youtube.com/watch?v='||b.vid;

do $$
declare n int;
begin
  update public.meme_contents c set availability='live', caption=b.title,
    url='https://www.youtube.com/watch?v='||b.vid, thumbnail_url='https://i.ytimg.com/vi/'||b.vid||'/hqdefault.jpg', is_representative=true
  from w_batch b where c.id=b.content_row_id and c.availability='dead';
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'W existing content update expected 2, affected %', n; end if;
end $$;

insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'source.approve', 'meme_media', b.meme_id::text||':'||b.source_id::text,
  jsonb_build_object('source_role', b.role, 'rights_basis','official_embed','link_only',false,'batch','20261028-media-fill-w-existing-1','check','youtube videos.list public embeddable processed KR allowed')
from w_batch b;
commit;
