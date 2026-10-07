-- Run only in a disposable/local test database. All fixtures roll back.
begin;

insert into auth.users(id) values
  ('ca000100-0000-4000-8000-00000000ca01'),
  ('ca000200-0000-4000-8000-00000000ca02');

insert into public.memes(id,title,slug,moderation_status,safety_level,published_at) values
  ('00000000-0000-4000-8000-00000000cb01','Card SQL A','card-sql-a','approved','green',now()),
  ('00000000-0000-4000-8000-00000000cb02','Pending secret','card-sql-b','pending','green',now()),
  ('00000000-0000-4000-8000-00000000cb03','Limited secret','card-sql-c','limited','green',now()),
  ('00000000-0000-4000-8000-00000000cb04','Yellow secret','card-sql-d','approved','yellow',now()),
  ('00000000-0000-4000-8000-00000000cb05','Unpublished secret','card-sql-e','approved','green',null),
  ('00000000-0000-4000-8000-00000000cb06','Inactive secret','card-sql-f','approved','green',now()),
  ('00000000-0000-4000-8000-00000000cb07','Card SQL B','card-sql-g','approved','green',now());
-- Production's publication trigger may populate this timestamp; explicitly clear it.
update public.memes set published_at = null where id = '00000000-0000-4000-8000-00000000cb05';

insert into public.meme_collectible_cards(id,card_no,meme_id,art_seed,active) values
  ('mc-0001',1,'00000000-0000-4000-8000-00000000cb01',1,true),
  ('mc-0002',2,'00000000-0000-4000-8000-00000000cb02',2,true),
  ('mc-0003',3,'00000000-0000-4000-8000-00000000cb03',3,true),
  ('mc-0004',4,'00000000-0000-4000-8000-00000000cb04',4,true),
  ('mc-0005',5,'00000000-0000-4000-8000-00000000cb05',5,true),
  ('mc-0006',6,'00000000-0000-4000-8000-00000000cb06',6,false),
  ('mc-0007',7,'00000000-0000-4000-8000-00000000cb07',7,true);

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.user_meme_cards'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.meme_collectible_cards'::regclass) then
    raise exception 'Both exposed tables require RLS';
  end if;
  if has_table_privilege('anon','public.user_meme_cards','select')
    or has_table_privilege('anon','public.user_meme_cards','insert')
    or has_table_privilege('authenticated','public.user_meme_cards','update')
    or has_table_privilege('authenticated','public.user_meme_cards','delete')
    or has_table_privilege('authenticated','public.meme_collectible_cards','insert')
    or has_column_privilege('authenticated','public.user_meme_cards','created_at','insert') then
    raise exception 'Broad inherited grants remain';
  end if;
end $$;

set local role anon;
do $$
begin
  if (select count(*) from public.meme_collectible_cards where card_no between 1 and 7) <> 2 then
    raise exception 'Anonymous catalog leaked inactive, unsafe, unpublished, or hidden cards';
  end if;
  begin
    perform 1 from public.user_meme_cards;
    raise exception 'Anonymous ownership select was permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.user_meme_cards(user_id,card_id) values ('ca000100-0000-4000-8000-00000000ca01','mc-0001');
    raise exception 'Anonymous ownership insert was permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"ca000100-0000-4000-8000-00000000ca01","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
insert into public.user_meme_cards(user_id,card_id)
  values ('ca000100-0000-4000-8000-00000000ca01','mc-0001')
  on conflict (user_id,card_id) do nothing;
insert into public.user_meme_cards(user_id,card_id)
  values ('ca000100-0000-4000-8000-00000000ca01','mc-0001')
  on conflict (user_id,card_id) do nothing;
do $$
declare hidden_id text;
begin
  if (select count(*) from public.user_meme_cards) <> 1 then raise exception 'Double claim changed ownership count'; end if;
  foreach hidden_id in array array['mc-0002','mc-0003','mc-0004','mc-0005','mc-0006'] loop
    begin
      insert into public.user_meme_cards(user_id,card_id) values ('ca000100-0000-4000-8000-00000000ca01',hidden_id);
      raise exception 'Ineligible claim permitted: %',hidden_id;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    insert into public.user_meme_cards(user_id,card_id,created_at)
      values ('ca000100-0000-4000-8000-00000000ca01','mc-0007','1999-01-01');
    raise exception 'Client-supplied ownership timestamp was permitted';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_meme_cards set user_id = 'ca000200-0000-4000-8000-00000000ca02';
    raise exception 'Client ownership reassignment was permitted';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.user_meme_cards;
    raise exception 'Client ownership deletion was permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims','{"sub":"ca000200-0000-4000-8000-00000000ca02","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.user_meme_cards) then raise exception 'Second user read first user ownership'; end if;
  begin
    insert into public.user_meme_cards(user_id,card_id) values ('ca000100-0000-4000-8000-00000000ca01','mc-0007');
    raise exception 'Second user claimed on behalf of first user';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.user_meme_cards(user_id,card_id) values ('ca000200-0000-4000-8000-00000000ca02','mc-0001');
do $$ begin
  if (select count(*) from public.user_meme_cards) <> 1 then raise exception 'Second user owns incorrect number of rows'; end if;
end $$;
reset role;

-- An anonymous Supabase sign-in carries the authenticated role but is not a login.
select set_config('request.jwt.claims','{"sub":"ca000100-0000-4000-8000-00000000ca01","role":"authenticated","is_anonymous":true}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.user_meme_cards) then raise exception 'Anonymous auth session read ownership'; end if;
  begin
    insert into public.user_meme_cards(user_id,card_id) values ('ca000100-0000-4000-8000-00000000ca01','mc-0007');
    raise exception 'Anonymous auth session claimed a card';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

update public.memes set moderation_status = 'fact_checking' where id = '00000000-0000-4000-8000-00000000cb01';
select set_config('request.jwt.claims','{"sub":"ca000100-0000-4000-8000-00000000ca01","role":"authenticated","is_anonymous":false}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.meme_collectible_cards where id = 'mc-0001') then raise exception 'Withdrawn content remained public'; end if;
  if (select count(*) from public.user_meme_cards where card_id = 'mc-0001') <> 1 then raise exception 'Withdrawal erased private ownership'; end if;
  begin
    insert into public.user_meme_cards(user_id,card_id) values ('ca000100-0000-4000-8000-00000000ca01','mc-0001') on conflict do nothing;
    raise exception 'Repeat claim accepted after publication withdrawal';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

delete from public.memes where id = '00000000-0000-4000-8000-00000000cb01';
do $$ begin
  if (select meme_id from public.meme_collectible_cards where id = 'mc-0001') is not null then raise exception 'Deleted meme retained a reference'; end if;
  if (select count(*) from public.user_meme_cards where card_id = 'mc-0001') <> 2 then raise exception 'Meme deletion erased owned cards'; end if;
end $$;

rollback;
