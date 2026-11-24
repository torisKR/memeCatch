//! `handleOAuthUserInfo` (dist/oauth2/link-account.mjs:84-338) for this app:
//! no `validateUserInfo`, no trusted providers, account linking on with its
//! defaults (`requireLocalEmailVerified`), no account cookie, no
//! `overrideUserInfo`, `sendOnSignUp` on, and the user hooks of
//! lib/auth/server.ts (the reserved domains before the insert, with the
//! Kakao callback's own address let through; `syncAuthUser` after the
//! commit).
//!
//! 1. The account key's owner (two accounts with it, or a database error:
//!    `internal_server_error` to the default error page; an account without
//!    its user: `unable_to_link_account`).
//! 2. Owned: the account's tokens are updated (`providerId`, the tokens the
//!    answer had; the scope is not), and an address the provider verified
//!    marks the user verified.
//! 3. Otherwise a user with the address: linked only when the provider
//!    verified the address and the user had verified it too
//!    (`account_not_linked`).
//! 4. Otherwise a new user and its account in one transaction, then
//!    `syncAuthUser`, then the verification mail when the provider did not
//!    verify the address.
//! 5. A session, as sign-in makes one.

use axum::http::HeaderMap;
use axum::http::header::USER_AGENT;

use super::super::accounts::{self, NewSession};
use super::super::cookies::SESSION_MAX_AGE_SECS;
use super::super::mail::Mail;
use super::super::{BetterAuth, email_token, random_id};
use super::providers::{Id, Tokens, UserInfo};
use super::store::{self, Created, NewAccount, NewUser, Owner};
use crate::db::Db;
use crate::routes::public::js;
use crate::routes::request::header_text;

/// A signed-in user.
pub struct SignedIn {
    pub session_token: String,
    /// A new user: the flow's `newUserURL` applies.
    pub is_register: bool,
}

/// How the callback ends when there is no session.
#[derive(Debug, PartialEq, Eq)]
pub enum Failed {
    /// `result.error` with spaces as underscores, to the flow's error URL.
    Redirect(&'static str),
    /// `redirectOnError(c, defaultErrorURL, "internal_server_error")`.
    Internal,
    /// The `create.before` hook's `APIError` without a code: better-auth
    /// answers it as a 400 JSON `{"message":"blocked email domain"}`.
    Blocked,
    /// Thrown out of the endpoint: an empty 500.
    Thrown,
}

/// `blockedPublicEmail` and the Kakao callback's exception
/// (lib/auth/server.ts:126-131, lib/auth/reserved-email.ts).
pub fn blocked(email: &str, provider: Id) -> bool {
    let normalized = js::trim(email).to_lowercase();
    let kakao_callback = provider == Id::Kakao && normalized.ends_with("@kakao.memecatch.internal");
    !kakao_callback
        && [
            "@auth.memecatch.internal",
            "@wallet.memecatch.internal",
            "@kakao.memecatch.internal",
        ]
        .iter()
        .any(|domain| normalized.ends_with(domain))
}

pub struct Callback<'a> {
    pub provider: Id,
    pub user: &'a UserInfo,
    /// `userInfo.email`, present and not empty.
    pub email: &'a str,
    pub tokens: &'a Tokens,
    /// The flow's `callbackURL`, for the verification link.
    pub callback_url: &'a str,
    pub headers: &'a HeaderMap,
}

pub async fn sign_in(
    db: &Db,
    auth: &BetterAuth,
    callback: &Callback<'_>,
    now_ms: i64,
) -> Result<SignedIn, Failed> {
    let provider_id = callback.provider.as_str();
    let account = NewAccount {
        provider_id,
        account_id: callback.user.account_id.clone(),
        tokens: callback.tokens.clone(),
    };
    let owner = store::find_account_owner(db, provider_id, &callback.user.account_id)
        .await
        .map_err(|error| {
            tracing::error!(?error, "Better auth was unable to query your database");
            Failed::Internal
        })?;
    let email = callback.email.to_lowercase();
    let verified = callback.user.email_verified;
    let (user_id, is_register) = match owner {
        Some(Owner::Orphaned) => {
            tracing::error!(
                "OAuth account references a missing user. Repair the account before retrying authentication."
            );
            return Err(Failed::Redirect("unable_to_link_account"));
        }
        Some(Owner::Owned { account_id, user }) => {
            let updated =
                store::update_tokens(db, &account_id, provider_id, callback.tokens, now_ms)
                    .await
                    .map_err(|_| Failed::Thrown)?;
            if !updated {
                return Err(Failed::Redirect("unable_to_update_account"));
            }
            if verified && !user.email_verified && email == user.email {
                store::mark_verified(db, &user.id, now_ms)
                    .await
                    .map_err(|_| Failed::Thrown)?;
            }
            (user.id, false)
        }
        None => match accounts::find_user_by_email(db, email.clone()).await {
            Err(error) => {
                tracing::error!(%error, "Better auth was unable to query your database");
                return Err(Failed::Internal);
            }
            // Account linking: not a trusted provider, so the provider must
            // have verified the address, and `requireLocalEmailVerified`.
            Ok(Some(user)) => {
                if !verified || !user.email_verified {
                    return Err(Failed::Redirect("account_not_linked"));
                }
                if let Err(error) = store::link_account(db, &user.id, &account, now_ms).await {
                    tracing::error!(%error, "Unable to link account");
                    return Err(Failed::Redirect("unable_to_link_account"));
                }
                (user.id, false)
            }
            Ok(None) => (
                create(db, auth, callback, &email, &account, now_ms).await?,
                true,
            ),
        },
    };
    let session_token = random_id(32);
    let session = NewSession {
        user_id,
        ip_address: super::super::rate_limit::client_ip(callback.headers).unwrap_or_default(),
        user_agent: header_text(callback.headers, &USER_AGENT, ", ").unwrap_or_default(),
        expires_at_ms: now_ms + SESSION_MAX_AGE_SECS * 1000,
        now_ms,
        token: session_token.clone(),
    };
    // `createSession` is outside better-auth's `try`: a failure throws.
    accounts::create_session(db, session)
        .await
        .map_err(|_| Failed::Thrown)?;
    Ok(SignedIn {
        session_token,
        is_register,
    })
}

/// A new user: the transaction, `syncAuthUser` after its commit (a failure
/// of either is `unable_to_create_user`), then the verification mail.
async fn create(
    db: &Db,
    auth: &BetterAuth,
    callback: &Callback<'_>,
    email: &str,
    account: &NewAccount,
    now_ms: i64,
) -> Result<String, Failed> {
    let user = NewUser {
        name: callback.user.name.clone(),
        email: email.to_owned(),
        email_verified: callback.user.email_verified,
        image: callback.user.image.clone(),
    };
    let blocked = blocked(email, callback.provider);
    let created = match store::create_user(db, user, account, blocked, now_ms).await {
        Ok(Created::User(created)) => created,
        Ok(Created::Blocked) => return Err(Failed::Blocked),
        Err(error) => {
            tracing::error!(%error, "Unable to create OAuth user");
            return Err(Failed::Redirect("unable_to_create_user"));
        }
    };
    if let Err(error) = accounts::sync_auth_user(db, &created, created.email_verified).await {
        tracing::error!(%error, "Unable to create OAuth user");
        return Err(Failed::Redirect("unable_to_create_user"));
    }
    if !created.email_verified {
        // `dispatchVerificationEmail(c, user, callbackURL)`.
        let token = email_token::sign(
            &auth.secret,
            &created.email,
            &created.id,
            now_ms.div_euclid(1000),
        );
        let callback_url = if callback.callback_url.is_empty() {
            "/"
        } else {
            callback.callback_url
        };
        auth.mailer
            .send(Mail {
                to: created.email.clone(),
                subject: "Verify your MemeCatch email",
                url: format!(
                    "{}/verify-email?token={token}&callbackURL={}",
                    auth.api_base_url,
                    js::encode_uri_component(callback_url)
                ),
                not_delivered: "verification_email_not_delivered",
            })
            .await;
    }
    Ok(created.id)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values: the `create.before` hook of lib/auth/server.ts on the
    // same address and path (lib/auth/reserved-email.test.ts).
    #[test]
    fn reserved_domains_are_refused_but_kakao_s_own_address() {
        assert!(!blocked("123@kakao.memecatch.internal", Id::Kakao));
        assert!(blocked("123@kakao.memecatch.internal", Id::Google));
        assert!(blocked("x@wallet.memecatch.internal", Id::Kakao));
        assert!(blocked("x@auth.memecatch.internal", Id::Google));
        assert!(blocked(" X@Auth.Memecatch.Internal ", Id::Google));
        assert!(!blocked("someone@example.com", Id::Google));
        assert!(!blocked(
            "someone@kakao.memecatch.internal.example",
            Id::Google
        ));
    }
}
