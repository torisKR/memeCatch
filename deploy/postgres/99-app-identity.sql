-- Re-assert app-owned identity after the migrated function bodies. Supabase JWT
-- helpers are gone; these functions only see what the application set.

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    jsonb_build_object(
      'role', COALESCE(NULLIF(current_setting('app.db_role', true), ''), 'anon'),
      'sub', NULLIF(current_setting('app.user_id', true), ''),
      'is_anonymous', COALESCE(NULLIF(current_setting('app.is_anonymous', true), ''), 'false')
    )
  );
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
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('app.user_id', true), ''),
      auth.jwt() ->> 'sub'
    ),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO anon, authenticated, service_role;

-- The login role is not the table owner, so RLS applies when it SET ROLE
-- authenticated or anon. service_role bypasses RLS and is used only by the
-- server admin client after an operator/service check in the app.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'memecatch') THEN
    RAISE EXCEPTION 'memecatch login role was not created';
  END IF;
END $$;

-- NOINHERIT so a request only has the privileges of the role it SET ROLE to.
-- BYPASSRLS is not inherited anyway; this also keeps anon and authenticated
-- policies from both applying to the same session.
ALTER ROLE memecatch NOINHERIT;
GRANT anon, authenticated, service_role TO memecatch;
GRANT USAGE, CREATE ON SCHEMA public TO memecatch;
GRANT USAGE ON SCHEMA auth, extensions, storage TO memecatch;
GRANT SELECT, INSERT, UPDATE ON auth.users TO memecatch;
