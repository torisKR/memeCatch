//! `GET /api/cron/saved-state-emails`: `app/api/cron/saved-state-emails/route.ts`,
//! `runSavedStateChangeEmails` and `runNotificationOutbox` of
//! `lib/trend/outbox.server.ts`.
//!
//! Claims up to 10 saved-state emails, sends each to the delivery provider
//! (`PLUS_DIGEST_DELIVERY_URL`), and records each outcome. The rows are sent
//! at the same time, as `Promise.all` sends them. Every database call is its
//! own transaction as `service_role`, as the admin client runs them.

use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::http::header::{AUTHORIZATION, CACHE_CONTROL, CONTENT_TYPE, HeaderName, HeaderValue};
use axum::response::Response;
use futures_util::future::join_all;
use serde_json::Value;
use url::Url;

use super::saved_state_email::{self, Email};
use crate::AppState;
use crate::auth::CronAuthorized;
use crate::config::{Config, Secret};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::js;
use crate::routes::request;

const CLAIM_LIMIT: i32 = 10;
const SEND_TIMEOUT: Duration = Duration::from_secs(8);

const CLAIM: &str = "select outbox_id::text, topic, channel, user_id::text, payload::text, \
                     claim_token::text \
                     from public.claim_saved_state_email_outbox(p_limit => $1)";
const FINISH_OK: &str = "select public.finish_notification_outbox(\
                         p_outbox_id => $1::uuid, p_claim_token => $2::uuid, p_succeeded => true)";
const FINISH_FAILED: &str = "select public.finish_notification_outbox(\
                             p_outbox_id => $1::uuid, p_claim_token => $2::uuid, \
                             p_succeeded => false, p_error => $3)";
// `auth.admin.getUserById` selects more; only the email is used.
// better-auth's ids are uuid here; node-pg's untyped parameter takes the
// column's type, so the text is cast the same way.
const RECIPIENT: &str = r#"select u.email from "user" u where u.id = $1::uuid"#;

/// The delivery settings and the site the email links to.
#[derive(Clone)]
pub struct Delivery {
    url: String,
    token: Secret,
    from: String,
    site: Url,
}

impl Delivery {
    /// `None` when `NEXT_PUBLIC_SITE_URL` is not an absolute URL: every email
    /// would then fail in `new URL`, and the route is not served.
    pub fn new(config: &Config) -> Option<Self> {
        let site = Url::parse(config.site_url.trim_end_matches('/')).ok()?;
        let email = &config.saved_state_email;
        Some(Self {
            url: email.delivery_url.clone(),
            token: email.delivery_token.clone(),
            from: email.from_email.clone(),
            site,
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Status {
    Ok,
    Partial,
    Failed,
    NotConfigured,
}

struct Outcome {
    status: Status,
    delivered: usize,
    failed: usize,
}

pub async fn run(_: CronAuthorized, State(state): State<AppState>, delivery: Delivery) -> Response {
    let outcome = send_all(&state, &delivery).await;
    let (status, name) = match outcome.status {
        Status::Ok => (StatusCode::OK, "ok"),
        Status::Partial => (StatusCode::OK, "partial"),
        Status::NotConfigured => (StatusCode::OK, "not_configured"),
        Status::Failed => (StatusCode::BAD_GATEWAY, "failed"),
    };
    let body = format!(
        r#"{{"ok":{},"status":"{name}","delivered":{},"failed":{}}}"#,
        outcome.status != Status::Failed,
        outcome.delivered,
        outcome.failed
    );
    let mut response = request::json(status, body);
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

/// `runSavedStateChangeEmails`.
async fn send_all(state: &AppState, delivery: &Delivery) -> Outcome {
    let none = |status| Outcome {
        status,
        delivered: 0,
        failed: 0,
    };
    if delivery.url.is_empty() || delivery.from.is_empty() {
        return none(Status::NotConfigured);
    }
    let Some(url) = delivery_url(&delivery.url) else {
        return none(Status::NotConfigured);
    };
    let rows = match claim(&state.db).await {
        Ok(rows) => rows,
        Err(error) => {
            tracing::warn!(%error, "claim_saved_state_email_outbox failed");
            return none(Status::Failed);
        }
    };
    let sends = rows
        .iter()
        .map(|row| deliver_and_finish(state, delivery, &url, row));
    let outcomes = join_all(sends).await;
    let delivered = outcomes.iter().filter(|delivered| **delivered).count();
    let failed = outcomes.len() - delivered;
    let status = if failed == 0 {
        Status::Ok
    } else if delivered == 0 {
        Status::Failed
    } else {
        Status::Partial
    };
    Outcome {
        status,
        delivered,
        failed,
    }
}

/// `new URL(deliveryUrl)` with `https:` and no user or password.
fn delivery_url(raw: &str) -> Option<Url> {
    let url = Url::parse(raw).ok()?;
    (url.scheme() == "https" && url.username().is_empty() && url.password().is_none())
        .then_some(url)
}

struct Row {
    outbox_id: String,
    topic: String,
    channel: String,
    user_id: Option<String>,
    payload: Option<String>,
    claim_token: String,
}

type RowColumns = (
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    String,
);

async fn claim(db: &Db) -> Result<Vec<Row>, sqlx::Error> {
    let rows: Vec<RowColumns> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move { sqlx::query_as(CLAIM).bind(CLAIM_LIMIT).fetch_all(tx).await })
            },
        )
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(outbox_id, topic, channel, user_id, payload, claim_token)| Row {
                outbox_id,
                topic,
                channel,
                user_id,
                payload,
                claim_token,
            },
        )
        .collect())
}

/// One row of `runNotificationOutbox`: `true` when it was delivered and
/// recorded as delivered.
async fn deliver_and_finish(state: &AppState, delivery: &Delivery, url: &Url, row: &Row) -> bool {
    let result = match deliver(state, delivery, url, row).await {
        Ok(()) => match finish_ok(&state.db, row).await {
            Ok(Some(true)) => Ok(()),
            _ => Err("finish_failed".to_owned()),
        },
        Err(message) => Err(message),
    };
    match result {
        Ok(()) => true,
        Err(message) => {
            if let Err(error) = finish_failed(&state.db, row, message).await {
                tracing::warn!(%error, "finish_notification_outbox failed");
            }
            false
        }
    }
}

/// The `email` dispatcher. `Err` is the message the outbox records.
async fn deliver(
    state: &AppState,
    delivery: &Delivery,
    url: &Url,
    row: &Row,
) -> Result<(), String> {
    if row.channel != "email" {
        return Err("dispatcher_not_configured".to_owned());
    }
    let user_id = row
        .user_id
        .clone()
        .ok_or_else(|| "recipient_missing".to_owned())?;
    let value: Option<Value> = row
        .payload
        .as_deref()
        .and_then(|text| serde_json::from_str(text).ok());
    let payload = value
        .as_ref()
        .and_then(saved_state_email::payload)
        .ok_or_else(|| "invalid_payload".to_owned())?;
    let recipient = recipient(&state.db, user_id).await?;
    let email = saved_state_email::build(&payload, &delivery.site)?;
    send(state, delivery, url, row, &recipient, &email).await
}

/// `client.auth.admin.getUserById(userId)` and `email?.trim()`.
async fn recipient(db: &Db, user_id: String) -> Result<String, String> {
    let found: Result<Option<Option<String>>, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_scalar(RECIPIENT)
                        .bind(user_id)
                        .fetch_optional(tx)
                        .await
                })
            },
        )
        .await;
    let email = match found {
        Ok(Some(email)) => email,
        // No such user is an error of getUserById, as a failed query is.
        Ok(None) => return Err("recipient_lookup_failed".to_owned()),
        Err(error) => {
            tracing::warn!(%error, "saved-state email recipient lookup failed");
            return Err("recipient_lookup_failed".to_owned());
        }
    };
    let email = email.as_deref().map(js::trim).unwrap_or_default();
    if email.is_empty() {
        return Err("recipient_missing".to_owned());
    }
    Ok(email.to_owned())
}

async fn send(
    state: &AppState,
    delivery: &Delivery,
    url: &Url,
    row: &Row,
    recipient: &str,
    email: &Email,
) -> Result<(), String> {
    let mut headers = vec![(CONTENT_TYPE, HeaderValue::from_static("application/json"))];
    let token = delivery.token.expose();
    if !token.is_empty() {
        let value = HeaderValue::try_from(format!("Bearer {token}"))
            .map_err(|_| "fetch failed".to_owned())?;
        headers.push((AUTHORIZATION, value));
    }
    let headers: Vec<(HeaderName, HeaderValue)> = headers;
    let body = saved_state_email::request_body(
        &delivery.from,
        recipient,
        email,
        &row.outbox_id,
        &row.topic,
    );
    let status = state
        .outbound
        .post(url, &headers, body, SEND_TIMEOUT)
        .await
        .map_err(|error| error.message().to_owned())?;
    if status.is_success() {
        Ok(())
    } else {
        Err(format!("provider_http_{}", status.as_u16()))
    }
}

async fn finish_ok(db: &Db, row: &Row) -> Result<Option<bool>, sqlx::Error> {
    let (outbox_id, claim_token) = (row.outbox_id.clone(), row.claim_token.clone());
    db.with_identity(
        &DbIdentity::service_role(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query_scalar(FINISH_OK)
                    .bind(outbox_id)
                    .bind(claim_token)
                    .fetch_one(tx)
                    .await
            })
        },
    )
    .await
}

async fn finish_failed(db: &Db, row: &Row, message: String) -> Result<(), sqlx::Error> {
    let (outbox_id, claim_token) = (row.outbox_id.clone(), row.claim_token.clone());
    db.with_identity(
        &DbIdentity::service_role(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query(FINISH_FAILED)
                    .bind(outbox_id)
                    .bind(claim_token)
                    .bind(message)
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_delivery_url_must_be_https_without_credentials() {
        assert!(delivery_url("https://mail.example/send").is_some());
        assert!(delivery_url("https://mail.example:8443/send?x=1").is_some());
        for bad in [
            "http://mail.example/send",
            "https://user@mail.example/send",
            "https://:pw@mail.example/send",
            "mail.example/send",
            "https://",
        ] {
            assert!(delivery_url(bad).is_none(), "{bad}");
        }
    }
}
