-- The support inquiry trigger counted a user's inquiries of the last day
-- without a lock, so concurrent inserts all read the same count and passed the
-- limit of 10 together (20 concurrent inserts landed 20 rows). Serialise the
-- check per user with a transaction advisory lock, as the reservation
-- functions do; under READ COMMITTED the count that follows the lock sees the
-- rows committed by the previous holder.
--
-- Rollback (the previous body, from 20260722000000_support_inquiries.sql):
--   create or replace function public.support_inquiries_rate_limit() returns trigger
--   language plpgsql security definer set search_path = public as $$
--   begin
--     if (select count(*) from support_inquiries
--         where user_id = new.user_id
--           and created_at > now() - interval '1 day') >= 10 then
--       raise exception 'rate_limited' using errcode = 'P0429';
--     end if;
--     return new;
--   end $$;

create or replace function public.support_inquiries_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('support:' || new.user_id::text, 0));
  if (select count(*) from support_inquiries
      where user_id = new.user_id
        and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  return new;
end $$;
