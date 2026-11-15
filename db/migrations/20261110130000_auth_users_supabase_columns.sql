-- Columns present on Supabase auth.users (Postgres 17) that the self-hosted
-- table did not have. Data-only restore fails without them.
begin;
alter table auth.users add column if not exists instance_id uuid;
alter table auth.users add column if not exists aud character varying(255);
alter table auth.users add column if not exists role character varying(255);
alter table auth.users add column if not exists invited_at timestamp with time zone;
alter table auth.users add column if not exists confirmation_token character varying(255);
alter table auth.users add column if not exists confirmation_sent_at timestamp with time zone;
alter table auth.users add column if not exists recovery_token character varying(255);
alter table auth.users add column if not exists recovery_sent_at timestamp with time zone;
alter table auth.users add column if not exists email_change_token_new character varying(255);
alter table auth.users add column if not exists email_change character varying(255);
alter table auth.users add column if not exists email_change_sent_at timestamp with time zone;
alter table auth.users add column if not exists last_sign_in_at timestamp with time zone;
alter table auth.users add column if not exists is_super_admin boolean;
alter table auth.users add column if not exists phone text;
alter table auth.users add column if not exists phone_confirmed_at timestamp with time zone;
alter table auth.users add column if not exists phone_change text;
alter table auth.users add column if not exists phone_change_token character varying(255);
alter table auth.users add column if not exists phone_change_sent_at timestamp with time zone;
alter table auth.users add column if not exists email_change_token_current character varying(255);
alter table auth.users add column if not exists email_change_confirm_status smallint;
alter table auth.users add column if not exists reauthentication_token character varying(255);
alter table auth.users add column if not exists reauthentication_sent_at timestamp with time zone;
alter table auth.users add column if not exists is_sso_user boolean;
commit;
