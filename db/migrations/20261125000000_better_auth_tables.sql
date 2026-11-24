-- The four tables of the sign-in (better-auth 1.7.20's schema for Postgres
-- with uuid ids), and the grants the app gave service_role on them.
--
-- The Next app's better-auth created them at run time (ensureAuthSchema,
-- lib/auth/server.ts) on its first sign-in request; nothing else did. With
-- Next removed, a database built from these migrations would have none and
-- every sign-in route would fail (docs/axum-migration/PLAN.md, A2-10). The
-- columns, types, defaults and indexes are the ones better-auth's
-- getMigrations makes (checked against it; server/tests/auth_tables.rs holds
-- them).
--
-- Production already has the tables (owned by the app's login role, which
-- created them): `if not exists` leaves them as they are, and the grants are
-- the ones the app repeated on every start. A fresh database gets the login
-- role's privileges from deploy/postgres/99-app-identity.sql.

create table if not exists public."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null,
  image text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);

create table if not exists public.session (
  id uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references public."user" (id) on delete cascade
);
create index if not exists "session_userId_idx" on public.session ("userId");

create table if not exists public.account (
  id uuid primary key default gen_random_uuid(),
  "accountId" text not null,
  "providerId" text not null,
  "userId" uuid not null references public."user" (id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null
);
create index if not exists "account_userId_idx" on public.account ("userId");

create table if not exists public.verification (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);
create index if not exists "verification_identifier_idx" on public.verification (identifier);

-- Only the grants production has. Created here by postgres, the tables would
-- otherwise take the schema's default privileges (20260708020000_grants.sql:
-- select for anon, writes for authenticated, all for service_role), which
-- would open password hashes and session tokens to the browser's roles.
-- Production's tables were created by the login role, which has no such
-- defaults, so this revoke changes nothing there.
revoke all on table public."user", public.session, public.account, public.verification
  from anon, authenticated, service_role;
grant select on table public."user" to service_role;
grant select on table public.session to service_role;
grant select, update on table public.account to service_role;
grant select on table public.verification to service_role;
