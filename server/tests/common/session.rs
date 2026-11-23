//! Signed-in users for tests: the better-auth tables, a user with a session
//! row, and the cookie better-auth would have set for it. Written
//! independently of `src/auth.rs`.

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use memecatch_server::auth::SessionUser;
use sha2::Sha256;
use sqlx::PgPool;

/// The cookie name a server reads when `NODE_ENV` is `development`.
pub const PLAIN: &str = "better-auth.session_token";

/// The tables better-auth 1.7.20 creates for lib/auth/server.ts
/// (`ensureAuthSchema`), copied from `\d "user"` and `\d session` on a
/// database the app had set up, with the grant from `grantServiceRole`.
/// `if not exists` leaves tables the app created (the ignored test) alone.
/// The advisory lock keeps parallel tests from creating them twice.
pub const AUTH_TABLES: &str = r#"
select pg_advisory_xact_lock(72031120);
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
grant select on public."user", public.session to service_role;
"#;

/// A better-auth user the way the app leaves one: the `"user"` row, and the
/// `auth.users` row `syncAuthUser` adds (lib/auth/sync-user.ts), whose trigger
/// creates the profile with role `user`.
pub async fn create_user(pool: &PgPool) -> SessionUser {
    let (id, email): (String, String) = sqlx::query_as(
        r#"insert into public."user" (name, email, "emailVerified")
           values ('axum auth test', 'axum-auth-' || gen_random_uuid() || '@example.com', true)
           returning id::text, email"#,
    )
    .fetch_one(pool)
    .await
    .expect("insert user");
    sqlx::query(
        "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         values ($1::uuid, $2, now(),
                 jsonb_build_object('nickname', 'ax' || substr(replace($1, '-', ''), 1, 12)))",
    )
    .bind(&id)
    .bind(&email)
    .execute(pool)
    .await
    .expect("insert auth.users");
    SessionUser { id, email }
}

/// A session row for `user` that expires `expires_in_secs` from now. Returns
/// its token.
pub async fn create_session(pool: &PgPool, user: &SessionUser, expires_in_secs: f64) -> String {
    sqlx::query_scalar(
        r#"insert into public.session (token, "expiresAt", "updatedAt", "userId")
           values (replace(gen_random_uuid()::text, '-', ''),
                   now() + make_interval(secs => $1), now(), $2::uuid)
           returning token"#,
    )
    .bind(expires_in_secs)
    .bind(&user.id)
    .fetch_one(pool)
    .await
    .expect("insert session")
}

/// The signature better-call's `makeSignature` produces (dist/crypto.mjs:21-25),
/// written independently of `src/auth.rs`.
pub fn signature(token: &str, secret: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("hmac key");
    mac.update(token.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

/// `name=encodeURIComponent("<token>.<signature>")`, as `signCookieValue`
/// leaves it (dist/crypto.mjs:26-31). Tokens are alphanumeric.
pub fn cookie(name: &str, token: &str, signature: &str) -> String {
    let value = format!("{token}.{signature}")
        .replace('+', "%2B")
        .replace('/', "%2F")
        .replace('=', "%3D");
    format!("{name}={value}")
}

pub fn signed_cookie(name: &str, token: &str, secret: &str) -> String {
    cookie(name, token, &signature(token, secret))
}
