//! `signInWithTikTokCode` and `importTikTokVideosAsSubmissions`
//! (lib/tiktok-auth.server.ts) with what they call: the identity rows
//! (`tiktok_provider_identities`, as `service_role` through the plan client),
//! the "magic link" of lib/auth/magic-link.ts, which is better-auth's own
//! `signUpEmail` and `signInEmail` with a password derived from the
//! address, and the `getSession` and `signOut` that `createClient()` and the
//! binding's failure run. Every cookie those better-auth calls set goes into
//! Next's `cookies()` (`CookieStore`), as `nextCookies` puts it there.
//!
//! `Err(())` is where the TypeScript throws: the callback then sends the
//! browser to `/login?error=auth`, with whatever the store holds.

use axum::http::HeaderMap;
use axum::http::header::USER_AGENT;
use hmac::{Hmac, KeyInit, Mac};
use sha2::{Digest, Sha256};

use super::super::accounts::{self, NewSession};
use super::super::cookies::{self, SESSION_MAX_AGE_SECS, SetCookies};
use super::super::passwords::{self, Verdict};
use super::super::sign_in::session_cookies;
use super::super::sign_up::{self, Created};
use super::super::{BetterAuth, forms, random_id, rate_limit, session, store};
use super::next::CookieStore;
use super::provider::{Video, slice_utf16};
use crate::AppState;
use crate::auth::{cookie_header, cookie_value, verify_signed_value};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::js;
use crate::routes::request::header_text;

const INTERNAL_DOMAIN: &str = "@auth.memecatch.internal";

/// What `signInWithTikTokCode` returns.
pub struct SignedIn {
    pub access_token: String,
    pub user_id: String,
    pub scopes: Vec<String>,
}

pub async fn sign_in_with_code(
    state: &AppState,
    auth: &BetterAuth,
    headers: &HeaderMap,
    code: &str,
    redirect_uri: &str,
    store: &mut CookieStore,
    now_ms: i64,
) -> Result<SignedIn, ()> {
    let grant = auth.tiktok.exchange(code, redirect_uri).await?;
    let display_name = auth
        .tiktok
        .display_name(&grant.access_token, &grant.open_id)
        .await?;
    let subject = hex::encode(Sha256::digest(grant.open_id.as_bytes()));
    // `display_name?.trim().slice(0, 20) || `틱톡러_${subject.slice(0, 6)}``
    let nickname = display_name
        .map(|name| slice_utf16(&name, 20))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| format!("틱톡러_{}", &subject[..6]));
    let email = reserve(&state.db, &subject).await?;
    let password = magic_password(auth, &email)?;
    generate_link(state, auth, &email, &nickname, &password, now_ms).await?;
    // `createClient()` reads the request's session first: better-auth's
    // `getSession`, whose refresh or expiry writes rows and cookies; its
    // failure is swallowed (`currentSession().catch(() => null)`).
    let header = cookie_header(headers);
    let mut set = SetCookies::default();
    let _ = session::respond(state, auth, header.as_deref(), &mut set).await;
    store.take(set.into_lines());
    let user_id = verify(state, auth, headers, &email, &password, store, now_ms).await?;
    if bind(&state.db, &subject, &user_id, now_ms).await.is_err() {
        sign_out(state, auth, headers, store).await;
        return Err(());
    }
    Ok(SignedIn {
        access_token: grant.access_token,
        user_id,
        scopes: grant.scopes,
    })
}

async fn as_service<T, F>(db: &Db, run: F) -> Result<T, sqlx::Error>
where
    F: for<'c> FnOnce(
            &'c mut sqlx::PgConnection,
        ) -> futures_util::future::BoxFuture<'c, Result<T, sqlx::Error>>
        + Send,
    T: Send,
{
    db.with_identity(&DbIdentity::service_role(), IdentityOptions::default(), run)
        .await
}

/// `reserveTikTokIdentity`: a fresh internal address for a new subject
/// (a unique violation is a subject already reserved), then the address the
/// subject has.
async fn reserve(db: &Db, subject: &str) -> Result<String, ()> {
    let mut random = [0u8; 32];
    rand::Rng::fill_bytes(&mut rand::rng(), &mut random);
    let candidate = format!("{}{INTERNAL_DOMAIN}", hex::encode(random));
    let subject_for_insert = subject.to_owned();
    let inserted = as_service(db, |tx| {
        Box::pin(async move {
            sqlx::query(
                "insert into public.tiktok_provider_identities (provider_subject, internal_email)
                 values ($1, $2)",
            )
            .bind(subject_for_insert)
            .bind(candidate)
            .execute(tx)
            .await
            .map(drop)
        })
    })
    .await;
    if let Err(error) = inserted {
        let unique = error
            .as_database_error()
            .and_then(|error| error.code())
            .is_some_and(|code| code == "23505");
        if !unique {
            tracing::error!(%error, "TikTok identity reservation failed");
            return Err(());
        }
    }
    let subject = subject.to_owned();
    let found: Option<String> = as_service(db, |tx| {
        Box::pin(async move {
            sqlx::query_scalar(
                "select internal_email from public.tiktok_provider_identities
                  where provider_subject = $1",
            )
            .bind(subject)
            .fetch_optional(tx)
            .await
        })
    })
    .await
    .map_err(|error| tracing::error!(%error, "TikTok identity reservation failed"))?;
    found.ok_or(())
}

/// `magicPassword(email)`: HMAC-SHA256 of `magic:<address>` under the
/// trimmed `BETTER_AUTH_SECRET`, as hex. No secret throws.
fn magic_password(auth: &BetterAuth, email: &str) -> Result<String, ()> {
    let secret = js::trim(&auth.secret);
    if secret.is_empty() {
        return Err(());
    }
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).map_err(drop)?;
    mac.update(format!("magic:{}", email.to_lowercase()).as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

/// `generateMagicLink(email, nickname)`: `signUpEmail` with the internal
/// sign-up open; when it throws, the magic password is stored on the
/// address's credential account instead. The token it returns only carries
/// the address, which the caller already has.
async fn generate_link(
    state: &AppState,
    auth: &BetterAuth,
    email: &str,
    nickname: &str,
    password: &str,
    now_ms: i64,
) -> Result<(), ()> {
    let name = Some(slice_utf16(nickname, 20))
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "틱톡러".to_owned());
    if sign_up_internal(state, auth, &name, email, password, now_ms)
        .await
        .is_ok()
    {
        return Ok(());
    }
    store_magic_password(&state.db, email, password).await
}

/// better-auth's `signUpEmail` as `auth.api` runs it here: no origin check,
/// the reserved domain let through (`allowInternalSignup`), an address that
/// exists answered as a new one without a write.
async fn sign_up_internal(
    state: &AppState,
    auth: &BetterAuth,
    name: &str,
    email: &str,
    password: &str,
    now_ms: i64,
) -> Result<(), ()> {
    let hash = passwords::hash(password).await.map_err(drop)?;
    let created = sign_up::create(
        state,
        name.to_owned(),
        email.to_lowercase(),
        hash,
        now_ms,
        true,
    )
    .await;
    match created {
        Ok(Created::User(user)) => {
            sign_up::send_verification(auth, &user, now_ms).await;
            accounts::sync_auth_user(&state.db, &user, false)
                .await
                .map_err(|_| tracing::error!("syncAuthUser failed after a TikTok sign-up"))
        }
        Ok(Created::Taken) => Ok(()),
        Err(_) => Err(()),
    }
}

/// `storeMagicPassword(email)`. Like the TypeScript, an address outside the
/// reserved domains is left alone (and counts as done), so no caller can
/// reset a real user's password to the magic one.
async fn store_magic_password(db: &Db, email: &str, password: &str) -> Result<(), ()> {
    if !sign_up::blocked_public_email(email) {
        return Ok(());
    }
    let hash = passwords::hash(password).await.map_err(drop)?;
    let email = email.to_owned();
    db.with_identity(
        &DbIdentity::better_auth(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"update public.account set password = $1, "updatedAt" = now()
                        where "userId" = (select id from public."user" where lower(email) = lower($2))
                          and "providerId" = 'credential'"#,
                )
                .bind(hash)
                .bind(email)
                .execute(tx)
                .await
                .map(drop)
            })
        },
    )
    .await
    .map_err(|error: sqlx::Error| tracing::error!(%error, "storeMagicPassword failed"))
}

/// `verifyMagicLink`: better-auth's `signInEmail` with the request's headers
/// and no `rememberMe`. Its session cookie goes into the store.
async fn verify(
    state: &AppState,
    auth: &BetterAuth,
    headers: &HeaderMap,
    email: &str,
    password: &str,
    store: &mut CookieStore,
    now_ms: i64,
) -> Result<String, ()> {
    if !forms::is_email(email) {
        return Err(());
    }
    let found = accounts::find_for_sign_in(&state.db, email.to_lowercase())
        .await
        .map_err(|error| tracing::error!(%error, "TikTok sign-in failed"))?;
    let Some((user, Some(stored))) = found else {
        return Err(());
    };
    if !matches!(passwords::verify(&stored, password).await, Verdict::Match) {
        return Err(());
    }
    // `EMAIL_NOT_VERIFIED`: every address this flow made (PLAN.md A4-1).
    if !user.email_verified {
        return Err(());
    }
    let token = random_id(32);
    let session = NewSession {
        user_id: user.id.clone(),
        ip_address: rate_limit::client_ip(headers).unwrap_or_default(),
        user_agent: header_text(headers, &USER_AGENT, ", ").unwrap_or_default(),
        expires_at_ms: now_ms + 1000 * SESSION_MAX_AGE_SECS,
        now_ms,
        token: token.clone(),
    };
    accounts::create_session(&state.db, session)
        .await
        .map_err(|error| tracing::error!(%error, "TikTok session failed"))?;
    store.take(session_cookies(auth, headers, &token, false).into_lines());
    Ok(user.id)
}

/// `bindTikTokIdentity`: the subject's row takes the user unless it has
/// one, and must then name that user.
async fn bind(db: &Db, subject: &str, user_id: &str, now_ms: i64) -> Result<(), ()> {
    let (subject_for_update, user) = (subject.to_owned(), user_id.to_owned());
    as_service(db, |tx| {
        Box::pin(async move {
            sqlx::query(
                "update public.tiktok_provider_identities
                    set user_id = $1::uuid,
                        updated_at = timestamptz 'epoch' + $2 * interval '1 millisecond'
                  where provider_subject = $3 and user_id is null",
            )
            .bind(user)
            .bind(now_ms)
            .bind(subject_for_update)
            .execute(tx)
            .await
            .map(drop)
        })
    })
    .await
    .map_err(|error| tracing::error!(%error, "TikTok identity binding failed"))?;
    let subject = subject.to_owned();
    let bound: Option<Option<String>> = as_service(db, |tx| {
        Box::pin(async move {
            sqlx::query_scalar(
                "select user_id::text from public.tiktok_provider_identities
                  where provider_subject = $1",
            )
            .bind(subject)
            .fetch_optional(tx)
            .await
        })
    })
    .await
    .map_err(|error| tracing::error!(%error, "TikTok identity binding failed"))?;
    (bound.flatten().as_deref() == Some(user_id))
        .then_some(())
        .ok_or(())
}

/// `db.auth.signOut()`: better-auth's `signOut` with the request's headers.
/// It deletes the session the request carried (not the one just made) and
/// expires the session cookies; its failure is swallowed.
async fn sign_out(
    state: &AppState,
    auth: &BetterAuth,
    headers: &HeaderMap,
    store: &mut CookieStore,
) {
    let header = cookie_header(headers);
    let names = &auth.cookies;
    let token = header
        .as_deref()
        .and_then(|header| cookie_value(header, &names.session_token))
        .and_then(|value| verify_signed_value(&value, &auth.secret).map(str::to_owned))
        .filter(|token| !token.is_empty());
    if let Some(token) = token
        && let Err(error) = store::delete(&state.db, token).await
    {
        tracing::error!(%error, "sign-out after a failed TikTok binding");
    }
    let mut set = SetCookies::default();
    let chunks = cookies::existing_chunks(header.as_deref(), &names.session_data);
    set.delete_session_cookie(names, &chunks);
    store.take(set.into_lines());
}

/// The database half of `importTikTokVideosAsSubmissions`: the videos no
/// submission or content has yet, as pending submissions. The two lookups'
/// errors read as no rows, as the TypeScript ignores them.
pub async fn import_videos(db: &Db, user_id: &str, videos: Vec<Video>) -> Result<usize, ()> {
    if videos.is_empty() {
        return Ok(0);
    }
    let urls: Vec<String> = videos
        .iter()
        .map(|video| video.source_url.clone())
        .collect();
    let lookup = |sql: &'static str| {
        let urls = urls.clone();
        as_service(db, move |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, Option<String>>(sql)
                    .bind(urls)
                    .fetch_all(tx)
                    .await
            })
        })
    };
    let (submitted, existing) = tokio::join!(
        lookup("select source_url from public.meme_submissions where source_url = any($1)"),
        lookup("select url from public.meme_contents where url = any($1)"),
    );
    let occupied: Vec<String> = [submitted, existing]
        .into_iter()
        .flat_map(Result::unwrap_or_default)
        .flatten()
        .collect();
    let rows: Vec<Video> = videos
        .into_iter()
        .filter(|video| !occupied.contains(&video.source_url))
        .collect();
    if rows.is_empty() {
        return Ok(0);
    }
    let count = rows.len();
    let names: Vec<String> = rows.iter().map(|row| row.name.clone()).collect();
    let sources: Vec<String> = rows.iter().map(|row| row.source_url.clone()).collect();
    let descriptions: Vec<String> = rows.into_iter().map(|row| row.description).collect();
    let user_id = user_id.to_owned();
    as_service(db, |tx| {
        Box::pin(async move {
            sqlx::query(
                "insert into public.meme_submissions
                   (submitter_id, name, source_url, description, guess_reason, tags, status)
                 select $1::uuid, t.name, t.source_url, t.description,
                        'TikTok video.list에서 본인 동의로 가져옴',
                        array['tiktok', 'oauth-import'], 'pending'
                   from unnest($2::text[], $3::text[], $4::text[]) with ordinality
                        as t(name, source_url, description, at)
                  order by t.at",
            )
            .bind(user_id)
            .bind(names)
            .bind(sources)
            .bind(descriptions)
            .execute(tx)
            .await
            .map(drop)
        })
    })
    .await
    .map_err(|error| tracing::error!(%error, "TikTok videos were not stored"))?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_subject_is_the_sha256_of_the_open_id() {
        // The row the Next build wrote for open id "open-1" (PLAN.md A4).
        assert_eq!(
            hex::encode(Sha256::digest(b"open-1")),
            "74980e4294d91893154ac755800514aa3ddecfec3de64f727450e3f122de72c7"
        );
    }

    /// The pool points at a port nothing listens on, so any query fails: a
    /// public address must come back `Ok` without one, a reserved address
    /// (trimmed and lowercased first) must still try the write. One reserved
    /// case only: each waits for the pool's acquire timeout.
    #[tokio::test]
    async fn the_magic_password_is_stored_only_for_reserved_addresses() {
        let db = Db::connect_lazy("postgresql://memecatch:unused@127.0.0.1:1/memecatch", 1)
            .expect("a valid URL");
        for public in [
            "victim@example.com",
            " Victim@Auth.Memecatch.Internal.example.com",
        ] {
            assert_eq!(
                store_magic_password(&db, public, "pw").await,
                Ok(()),
                "{public}"
            );
        }
        let reserved = " AB@AUTH.MEMECATCH.INTERNAL\n";
        assert_eq!(store_magic_password(&db, reserved, "pw").await, Err(()));
    }
}
