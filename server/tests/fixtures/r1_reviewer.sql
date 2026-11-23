-- The reviewer of the translations and market profiles in r1_seed.sql. The
-- auth.users trigger creates the profile; the nickname has the shape
-- tests/auth.rs uses, which the guard in tests/public_routes accepts.
--
-- A file of its own because only the login role may write auth.users, and
-- only service_role may write the tables r1_seed.sql fills.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values ('a1000000-0000-4000-8000-00000000ffff', 'axum-r1-reviewer@example.com',
        '2026-01-01T00:00:00+00', jsonb_build_object('nickname', 'axa1000000ffff'))
on conflict (id) do nothing;
