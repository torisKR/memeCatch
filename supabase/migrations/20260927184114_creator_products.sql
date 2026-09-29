-- Creator promotions are independently moderated and never enter affiliate_products.
create or replace function public.creator_product_url_is_safe(p_url text)
returns boolean language plpgsql immutable set search_path = public as $$
declare host text;
begin
  if p_url is null or length(p_url) > 2048 or p_url !~ '^https://' or p_url ~ '[[:cntrl:]]' or position(chr(92) in p_url) > 0 then return false; end if;
  host := lower(split_part(split_part(split_part(p_url, '://', 2), '/', 1), '?', 1));
  if host = '' or host ~ '@' or (host ~ ':[0-9]+$' and host !~ ':443$') then return false; end if;
  if host ~ '^[a-z0-9.-]+:443$' then host := split_part(host, ':', 1); end if;
  host := regexp_replace(host, '\.$', '');
  if host = 'localhost' or host like '%.localhost' or host like '%.local' or host like '%.internal'
     or host like '%.test' or host like '%.invalid' or host like '%.example' or host like '%.home.arpa' then return false; end if;
  if host ~ '^[0-9]+(\.[0-9]+){3}$' then
    if split_part(host,'.',1)::integer > 255 or split_part(host,'.',2)::integer > 255
       or split_part(host,'.',3)::integer > 255 or split_part(host,'.',4)::integer > 255
       or split_part(host,'.',1) <> split_part(host,'.',1)::integer::text
       or split_part(host,'.',2) <> split_part(host,'.',2)::integer::text
       or split_part(host,'.',3) <> split_part(host,'.',3)::integer::text
       or split_part(host,'.',4) <> split_part(host,'.',4)::integer::text then return false; end if;
    if host ~ '^(0|10|127|22[4-9]|23[0-9]|24[0-9]|25[0-5])\.'
       or host ~ '^169\.254\.' or host ~ '^192\.168\.'
       or host ~ '^172\.(1[6-9]|2[0-9]|3[01])\.'
       or host ~ '^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.' then return false; end if;
    return true;
  end if;
  if host ~ '^[0-9.]+$' or host ~ '^(0x[0-9a-f]+|[0-9]+)(\.(0x[0-9a-f]+|[0-9]+))*$' then return false; end if;
  if host ~ '^(0|10|127|22[4-9]|23[0-9]|24[0-9]|25[0-5])\.'
     or host ~ '^169\.254\.' or host ~ '^192\.168\.'
     or host ~ '^172\.(1[6-9]|2[0-9]|3[01])\.'
     or host ~ '^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.'
     or host = '[::1]' or host = '[::]' or host ~ '^\[(::ffff:|fc|fd|fe[0-9a-f])' then return false; end if;
  return host ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$'
    or host ~ '^\[[0-9a-f:]+\]$';
end $$;
revoke all on function public.creator_product_url_is_safe(text) from public, anon, authenticated;

create table public.creator_products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null check (char_length(btrim(description)) between 5 and 2000),
  external_url text not null check (public.creator_product_url_is_safe(external_url)),
  image_path text not null,
  price integer check (price is null or price between 1 and 100000000),
  category text not null check (category in ('apparel','accessories','prints','digital','other')),
  relationship_disclosure text not null check (relationship_disclosure in ('creator','affiliate','gifted','other')),
  rights_attested_at timestamptz not null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) between 3 and 500),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_product_image_owner_path check (
    image_path ~ ('^creator-products/' || owner_id::text || '/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$')
  ),
  constraint creator_product_review_state check (
    (moderation_status = 'pending' and reviewed_at is null and reviewed_by is null and rejection_reason is null)
    or (moderation_status = 'approved' and reviewed_at is not null and reviewed_by is not null and rejection_reason is null)
    or (moderation_status = 'rejected' and reviewed_at is not null and reviewed_by is not null and rejection_reason is not null)
  )
);
create index creator_products_public_created_idx on public.creator_products (created_at desc) where moderation_status = 'approved';
create index creator_products_owner_created_idx on public.creator_products (owner_id, created_at desc);

alter table public.creator_products enable row level security;
revoke all on public.creator_products from public, anon, authenticated;
grant select (id,title,description,external_url,image_path,price,category,relationship_disclosure,moderation_status,created_at)
  on public.creator_products to anon;
grant select (id,owner_id,title,description,external_url,image_path,price,category,relationship_disclosure,moderation_status,rejection_reason,created_at,updated_at)
  on public.creator_products to authenticated;
create policy creator_products_public_approved_read on public.creator_products
  for select to anon, authenticated using (moderation_status = 'approved');
create policy creator_products_owner_read on public.creator_products
  for select to authenticated using (owner_id = auth.uid());
create policy creator_products_operator_read on public.creator_products
  for select to authenticated using (public.is_operator());
grant all on public.creator_products to service_role;

-- Isolated durable throttles for creator-market uploads and submissions.
create table public.creator_product_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('upload','submission')),
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, action, window_start)
);
alter table public.creator_product_rate_limits enable row level security;
revoke all on public.creator_product_rate_limits from public, anon, authenticated;
grant all on public.creator_product_rate_limits to service_role;

create or replace function public.reserve_creator_product_upload()
returns void language plpgsql security definer set search_path = pg_catalog as $function$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'login_required'; end if;
  insert into public.creator_product_rate_limits as quota (user_id,action,window_start,request_count)
  values (v_user_id,'upload',v_window_start,1)
  on conflict (user_id,action,window_start) do update set request_count=quota.request_count+1
  returning request_count into v_count;
  if v_count > 5 then raise exception using errcode = 'P0429', message = 'api_rate_limited'; end if;
  delete from public.creator_product_rate_limits where user_id=v_user_id and window_start < now() - interval '30 days';
end;
$function$;
revoke all on function public.reserve_creator_product_upload() from public, anon;
grant execute on function public.reserve_creator_product_upload() to authenticated;

-- This bucket is independent from meme-uploads. Writes go through the authenticated,
-- size/type/byte-validated upload route using the server-only storage client.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-products', 'creator-products', false, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.creator_product_submit(
  p_title text, p_description text, p_external_url text, p_image_path text,
  p_price integer, p_category text, p_relationship_disclosure text, p_rights_accepted boolean
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  new_id uuid;
  v_count integer;
  v_window_start timestamptz := date_trunc('day', now());
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if p_rights_accepted is distinct from true then raise exception 'rights_required'; end if;
  if p_image_path !~ ('^creator-products/' || auth.uid()::text || '/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$') then raise exception 'invalid_image_path'; end if;
  insert into public.creator_product_rate_limits as quota (user_id,action,window_start,request_count)
  values (auth.uid(),'submission',v_window_start,1)
  on conflict (user_id,action,window_start) do update set request_count=quota.request_count+1
  returning request_count into v_count;
  if v_count > 5 then raise exception using errcode = 'P0429', message = 'api_rate_limited'; end if;
  delete from public.creator_product_rate_limits where user_id=auth.uid() and window_start < now() - interval '30 days';
  insert into public.creator_products (owner_id,title,description,external_url,image_path,price,category,relationship_disclosure,rights_attested_at)
  values (auth.uid(),p_title,p_description,p_external_url,p_image_path,p_price,p_category,p_relationship_disclosure,now()) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.creator_product_submit(text,text,text,text,integer,text,text,boolean) from public, anon;
grant execute on function public.creator_product_submit(text,text,text,text,integer,text,text,boolean) to authenticated;

create or replace function public.creator_product_update(
  p_id uuid, p_title text, p_description text, p_external_url text, p_image_path text,
  p_price integer, p_category text, p_relationship_disclosure text, p_rights_accepted boolean
) returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if p_rights_accepted is distinct from true then raise exception 'rights_required'; end if;
  if p_image_path !~ ('^creator-products/' || auth.uid()::text || '/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$') then raise exception 'invalid_image_path'; end if;
  update public.creator_products set title=p_title, description=p_description, external_url=p_external_url,
    image_path=p_image_path, price=p_price, category=p_category, relationship_disclosure=p_relationship_disclosure,
    rights_attested_at=now(), moderation_status='pending', rejection_reason=null, reviewed_by=null, reviewed_at=null, updated_at=now()
  where id=p_id and owner_id=auth.uid();
  if not found then raise exception 'creator_product_not_found'; end if;
end $$;
revoke all on function public.creator_product_update(uuid,text,text,text,text,integer,text,text,boolean) from public, anon;
grant execute on function public.creator_product_update(uuid,text,text,text,text,integer,text,text,boolean) to authenticated;

create or replace function public.creator_product_moderate(p_id uuid, p_decision text, p_rejection_reason text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not public.is_operator() then raise exception 'operator_required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  if p_decision = 'rejected' and (p_rejection_reason is null or char_length(btrim(p_rejection_reason)) not between 3 and 500) then raise exception 'invalid_rejection_reason'; end if;
  update public.creator_products set moderation_status=p_decision, rejection_reason=case when p_decision='rejected' then btrim(p_rejection_reason) else null end,
    reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
  where id=p_id and moderation_status='pending';
  if not found then raise exception 'creator_product_not_pending'; end if;
end $$;
revoke all on function public.creator_product_moderate(uuid,text,text) from public, anon;
grant execute on function public.creator_product_moderate(uuid,text,text) to authenticated;
