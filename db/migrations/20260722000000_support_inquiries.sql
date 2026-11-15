-- 고객센터 문의(support_inquiries) — 사용자 → 운영자 1:1 문의.
-- RLS: 본인 작성/조회, 운영자 전체 조회·답변. 남용 방지: 사용자당 24시간 10건(P0429).

create table if not exists public.support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('bug','content','account','billing','suggestion','other')),
  subject text not null check (char_length(subject) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open','answered','closed')),
  admin_reply text check (char_length(admin_reply) <= 4000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_inquiries_user_idx
  on public.support_inquiries (user_id, created_at desc);
create index if not exists support_inquiries_status_idx
  on public.support_inquiries (status, created_at desc);

alter table public.support_inquiries enable row level security;

-- 본인 문의 + 운영자 전체 조회
drop policy if exists support_inquiries_select on public.support_inquiries;
create policy support_inquiries_select on public.support_inquiries
  for select using (user_id = (select auth.uid()) or is_operator());

-- 본인 명의로만 작성
drop policy if exists support_inquiries_insert on public.support_inquiries;
create policy support_inquiries_insert on public.support_inquiries
  for insert with check (user_id = (select auth.uid()));

-- 답변/상태 변경은 운영자만
drop policy if exists support_inquiries_operator_update on public.support_inquiries;
create policy support_inquiries_operator_update on public.support_inquiries
  for update using (is_operator()) with check (is_operator());

grant select, insert, update on public.support_inquiries to authenticated;

-- 도배 방지 — 사용자당 24시간 10건 (community 컨벤션과 동일한 P0429 에러코드)
create or replace function public.support_inquiries_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from support_inquiries
      where user_id = new.user_id
        and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  return new;
end $$;

drop trigger if exists support_inquiries_rate_limit on public.support_inquiries;
create trigger support_inquiries_rate_limit
  before insert on public.support_inquiries
  for each row execute function public.support_inquiries_rate_limit();
