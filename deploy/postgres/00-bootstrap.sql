-- Vanilla Postgres 16 stand-ins for the Supabase catalog this schema was written against.
-- Identity is NOT a Supabase JWT. auth.uid() reads the app.user_id GUC that the
-- app sets inside the transaction after it has checked the session cookie.
-- RLS policies stay as row filters over that app-set identity. They do not trust
-- a client-supplied role. anon / authenticated / service_role are NOLOGIN.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS private;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

ALTER ROLE service_role BYPASSRLS;

GRANT anon TO postgres;
GRANT authenticated TO postgres;
GRANT service_role TO postgres;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_anonymous boolean NOT NULL DEFAULT false,
  banned_until timestamptz,
  deleted_at timestamptz,
  instance_id uuid,
  aud character varying(255),
  role character varying(255),
  invited_at timestamptz,
  confirmation_token character varying(255),
  confirmation_sent_at timestamptz,
  recovery_token character varying(255),
  recovery_sent_at timestamptz,
  email_change_token_new character varying(255),
  email_change character varying(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  is_super_admin boolean,
  phone text,
  phone_confirmed_at timestamptz,
  phone_change text,
  phone_change_token character varying(255),
  phone_change_sent_at timestamptz,
  email_change_token_current character varying(255),
  email_change_confirm_status smallint,
  reauthentication_token character varying(255),
  reauthentication_sent_at timestamptz,
  is_sso_user boolean
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_lower_idx
  ON auth.users (lower(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN session_user::text = 'memecatch' THEN COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
      jsonb_build_object(
        'role', COALESCE(NULLIF(current_setting('app.db_role', true), ''), 'anon'),
        'sub', NULLIF(current_setting('app.user_id', true), ''),
        'is_anonymous', COALESCE(NULLIF(current_setting('app.is_anonymous', true), ''), 'false')
      )
    )
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', 'anon');
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN session_user::text = 'memecatch' THEN NULLIF(
      COALESCE(
        NULLIF(current_setting('app.user_id', true), ''),
        auth.jwt() ->> 'sub'
      ),
      ''
    )::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  owner uuid
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  UNIQUE (bucket_id, name)
);

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN name IS NULL THEN NULL
    ELSE string_to_array(regexp_replace(name, '/$', ''), '/')
  END;
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT ON storage.buckets, storage.objects TO anon, authenticated;
GRANT ALL ON storage.buckets, storage.objects TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO service_role;

CREATE TABLE IF NOT EXISTS vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE,
  secret text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW vault.decrypted_secrets AS
  SELECT id, name, secret AS decrypted_secret, description, created_at
  FROM vault.secrets;

CREATE OR REPLACE FUNCTION vault.create_secret(p_secret text, p_name text, p_description text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (p_name, p_secret, p_description)
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, description = EXCLUDED.description
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- pg_net is not installed. The MCP retry cron is replaced by the compose scheduler.
CREATE OR REPLACE FUNCTION net.http_get(
  url text,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
)
RETURNS bigint
LANGUAGE sql
AS $$
  SELECT 0::bigint;
$$;

CREATE TABLE IF NOT EXISTS cron.job (
  jobid bigserial PRIMARY KEY,
  jobname text UNIQUE,
  schedule text,
  command text,
  active boolean NOT NULL DEFAULT true
);

CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO cron.job (jobname, schedule, command)
  VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE
    SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(jobid bigint)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM cron.job WHERE cron.job.jobid = unschedule.jobid;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION cron.alter_job(jobid bigint, active boolean DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE cron.job
     SET active = COALESCE(alter_job.active, cron.job.active)
   WHERE cron.job.jobid = alter_job.jobid;
END;
$$;
