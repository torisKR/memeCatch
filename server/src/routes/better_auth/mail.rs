//! The verification and reset mail of lib/auth/server.ts
//! (`sendVerificationEmail`, `sendResetPassword`): a POST of
//! `{"to","subject","url"}` to `AUTH_EMAIL_WEBHOOK`, or, with the webhook
//! unset, one log line `{"event":"…_not_delivered","email":…}`.
//!
//! better-auth runs both through `runInBackgroundOrAwait`: the request waits
//! for the webhook, and a failure is logged ("Failed to run background
//! task") without changing the answer. The webhook's own status is not read.

use std::time::Duration;

use axum::body::Body;
use axum::http::{Method, Request, header::CONTENT_TYPE};
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use serde_json::Value;

/// Node's `fetch` has no overall limit; this one keeps a stuck webhook from
/// holding the sign-up transaction for good.
const WEBHOOK_TIMEOUT: Duration = Duration::from_secs(30);

pub struct Mail {
    pub to: String,
    pub subject: &'static str,
    pub url: String,
    /// The event of the log line when there is no webhook.
    pub not_delivered: &'static str,
}

pub struct Mailer {
    webhook: Option<String>,
    client: Client<HttpsConnector<HttpConnector>, Body>,
}

impl Mailer {
    pub fn new(webhook: Option<String>) -> Self {
        let mut http = HttpConnector::new();
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .expect("ring's default provider has protocol versions")
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Self {
            webhook,
            client: Client::builder(TokioExecutor::new()).build(connector),
        }
    }

    pub async fn send(&self, mail: Mail) {
        let text = |value: &str| Value::from(value).to_string();
        let Some(webhook) = &self.webhook else {
            // `console.info(JSON.stringify({ event, email }))`.
            tracing::info!(
                "{}",
                format!(
                    r#"{{"event":{},"email":{}}}"#,
                    text(mail.not_delivered),
                    text(&mail.to)
                )
            );
            return;
        };
        let body = format!(
            r#"{{"to":{},"subject":{},"url":{}}}"#,
            text(&mail.to),
            text(mail.subject),
            text(&mail.url)
        );
        let request = Request::builder()
            .method(Method::POST)
            .uri(webhook.as_str())
            .header(CONTENT_TYPE, "application/json")
            .body(Body::from(body));
        let sent = match request {
            Ok(request) => tokio::time::timeout(WEBHOOK_TIMEOUT, self.client.request(request))
                .await
                .map_err(|_| "timed out".to_owned())
                .and_then(|answer| answer.map(drop).map_err(|error| error.to_string())),
            Err(error) => Err(error.to_string()),
        };
        if let Err(error) = sent {
            tracing::error!(%error, "Failed to run background task: the mail webhook");
        }
    }
}
