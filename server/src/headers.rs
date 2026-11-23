//! The headers Next puts on every route handler response, for responses Axum
//! generates itself: the ones `next.config.ts` `headers()` adds to `/(.*)`, and
//! the `Vary` the app router adds. Proxied responses already carry them from
//! Next and must not pass through here.
//!
//! Next evaluates `headers()` at build time and stores the result in
//! `.next/routes-manifest.json`. A running standalone server ignores later
//! changes to `RELEASE_SHA`, `NEXT_PUBLIC_SITE_URL`, `CSP_ENFORCE` and
//! `CSP_REPORT_URI`. To stay byte-identical, give Axum the values the Next
//! image was built with.

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{HeaderMap, HeaderName, HeaderValue, InvalidHeaderValue, VARY};
use axum::middleware::Next;
use axum::response::Response;

use crate::AppState;
use crate::config::Config;
use crate::proxy::FromUpstream;

// Mirrors CSP_DIRECTIVES in next.config.ts, production branch (no
// 'unsafe-eval'). Keep the order and spacing: the value must match byte for byte.
const CSP_DIRECTIVES: [&str; 14] = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://www.googleadservices.com https://*.google-analytics.com https://*.adtrafficquality.google",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com https://*.tiktokcdn.com https://*.googlesyndication.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googleadservices.com https://*.g.doubleclick.net https://*.gstatic.com https://*.google.com https://*.google.co.kr https://*.adtrafficquality.google",
    "font-src 'self' data:",
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://www.tiktok.com https://www.instagram.com https://www.facebook.com https://*.googlesyndication.com https://*.g.doubleclick.net https://www.google.com https://*.adtrafficquality.google",
    "connect-src 'self' https://i.ytimg.com https://*.tiktokcdn.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://www.google.com https://www.googletagmanager.com https://*.googlesyndication.com https://*.googleadservices.com https://*.g.doubleclick.net https://*.adtrafficquality.google",
    "media-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
];

// The app router adds this to every route handler response, whatever the
// handler returns (seen on /api/health, /robots.txt, /sitemap.xml and others).
const APP_ROUTER_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";

/// Marks an answer `proxy.ts` gives before Next's router runs, such as the
/// canonical redirect of a meme URL. Next puts the `next.config.ts` headers
/// on those too, but no `Vary`: that one comes from the app router.
#[derive(Clone, Copy)]
pub struct AnsweredBeforeRouting;

/// The header set, built once at startup.
#[derive(Clone, Debug)]
pub struct NativeRouteHeaders(Vec<(HeaderName, HeaderValue)>);

impl NativeRouteHeaders {
    pub fn new(config: &Config) -> Result<Self, InvalidHeaderValue> {
        let mut headers = Vec::new();
        let mut push = |name: &'static str, value: &str| {
            HeaderValue::from_str(value)
                .map(|value| headers.push((HeaderName::from_static(name), value)))
        };

        push("vary", APP_ROUTER_VARY)?;
        if let Some(sha) = &config.release_sha {
            push("x-memecatch-release-sha", sha)?;
        }
        push(
            "strict-transport-security",
            "max-age=63072000; includeSubDomains; preload",
        )?;
        push("x-content-type-options", "nosniff")?;
        push("x-frame-options", "SAMEORIGIN")?;
        push("referrer-policy", "strict-origin-when-cross-origin")?;
        push(
            "permissions-policy",
            "camera=(), microphone=(), geolocation=(), tools=(self)",
        )?;
        push("origin-agent-cluster", "?1")?;
        push(
            if config.csp_enforce {
                "content-security-policy"
            } else {
                "content-security-policy-report-only"
            },
            &csp_value(config.csp_report_uri.as_deref()),
        )?;
        if let Some(uri) = &config.csp_report_uri {
            push("reporting-endpoints", &format!("csp-endpoint=\"{uri}\""))?;
        }
        Ok(Self(headers))
    }

    /// Adds each header the response does not already carry. In Next a route
    /// handler's own header wins over the `next.config.ts` one in the same way.
    pub fn apply(&self, headers: &mut HeaderMap) {
        for (name, value) in &self.0 {
            if !headers.contains_key(name) {
                headers.insert(name.clone(), value.clone());
            }
        }
    }
}

fn csp_value(report_uri: Option<&str>) -> String {
    let mut directives: Vec<String> = CSP_DIRECTIVES.iter().map(|d| (*d).to_owned()).collect();
    if let Some(uri) = report_uri {
        directives.push(format!("report-uri {uri}"));
        directives.push("report-to csp-endpoint".to_owned());
    }
    directives.join("; ")
}

/// Middleware for native routes. `routes::Routes::add` installs it; route
/// modules do not add it themselves.
///
/// Besides the headers, it hands the body on with no declared size. Next
/// sends a route handler's body chunked and puts no length on the `HEAD`
/// answer (checked on every native route). Given a body of known size, axum
/// adds a `Content-Length` to both. A `Content-Length` the handler set itself
/// is kept.
///
/// An answer the handler fetched from the upstream (`proxy::forward`) is
/// Next's own and goes back untouched.
pub async fn apply(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let response = next.run(request).await;
    if response.extensions().get::<FromUpstream>().is_some() {
        return response;
    }
    let (mut parts, body) = response.into_parts();
    state.native_headers.apply(&mut parts.headers);
    if parts.extensions.get::<AnsweredBeforeRouting>().is_some() {
        parts.headers.remove(VARY);
    }
    Response::from_parts(parts, Body::from_stream(body.into_data_stream()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(extra: &[(&str, &str)]) -> Config {
        Config::from_lookup(|name| {
            [
                ("DATABASE_URL", "postgresql://u:p@127.0.0.1/db"),
                ("BETTER_AUTH_SECRET", "s"),
            ]
            .iter()
            .chain(extra)
            .find(|(key, _)| *key == name)
            .map(|(_, value)| (*value).to_owned())
        })
        .expect("valid config")
    }

    fn header_map(config: &Config) -> HeaderMap {
        let mut headers = HeaderMap::new();
        NativeRouteHeaders::new(config)
            .expect("valid headers")
            .apply(&mut headers);
        headers
    }

    // Copied from the `/(.*)` entry of `.next/routes-manifest.json` produced by
    // `next build` with no CSP_* variables set, which is how the production
    // image is built.
    const PRODUCTION_CSP: &str = "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://www.googleadservices.com https://*.google-analytics.com https://*.adtrafficquality.google; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com https://*.tiktokcdn.com https://*.googlesyndication.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googleadservices.com https://*.g.doubleclick.net https://*.gstatic.com https://*.google.com https://*.google.co.kr https://*.adtrafficquality.google; font-src 'self' data:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://www.tiktok.com https://www.instagram.com https://www.facebook.com https://*.googlesyndication.com https://*.g.doubleclick.net https://www.google.com https://*.adtrafficquality.google; connect-src 'self' https://i.ytimg.com https://*.tiktokcdn.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://www.google.com https://www.googletagmanager.com https://*.googlesyndication.com https://*.googleadservices.com https://*.g.doubleclick.net https://*.adtrafficquality.google; media-src 'self' https:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; report-uri https://catchmeme.com/api/csp-report; report-to csp-endpoint";

    #[test]
    fn default_headers_match_the_production_next_build() {
        let headers = header_map(&config(&[]));

        let expected = [
            (
                "vary",
                "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch",
            ),
            (
                "strict-transport-security",
                "max-age=63072000; includeSubDomains; preload",
            ),
            ("x-content-type-options", "nosniff"),
            ("x-frame-options", "SAMEORIGIN"),
            ("referrer-policy", "strict-origin-when-cross-origin"),
            (
                "permissions-policy",
                "camera=(), microphone=(), geolocation=(), tools=(self)",
            ),
            ("origin-agent-cluster", "?1"),
            ("content-security-policy", PRODUCTION_CSP),
            (
                "reporting-endpoints",
                "csp-endpoint=\"https://catchmeme.com/api/csp-report\"",
            ),
        ];
        assert_eq!(headers.len(), expected.len());
        for (name, value) in expected {
            assert_eq!(headers.get(name).expect(name), value, "{name}");
        }
    }

    #[test]
    fn release_sha_header_is_sent_only_when_set() {
        let with_sha = header_map(&config(&[("RELEASE_SHA", " abc123 ")]));
        let without_sha = header_map(&config(&[]));

        assert_eq!(with_sha.get("x-memecatch-release-sha").unwrap(), "abc123");
        assert!(!without_sha.contains_key("x-memecatch-release-sha"));
    }

    #[test]
    fn csp_enforce_false_switches_to_report_only() {
        let headers = header_map(&config(&[("CSP_ENFORCE", "false")]));

        assert!(!headers.contains_key("content-security-policy"));
        assert_eq!(
            headers.get("content-security-policy-report-only").unwrap(),
            PRODUCTION_CSP
        );
    }

    #[test]
    fn empty_report_uri_drops_the_report_directives_and_endpoint_header() {
        let headers = header_map(&config(&[("CSP_REPORT_URI", "")]));

        let csp = headers
            .get("content-security-policy")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(csp.ends_with("frame-ancestors 'self'"), "{csp}");
        assert!(!headers.contains_key("reporting-endpoints"));
    }

    #[test]
    fn report_uri_follows_the_site_url() {
        let headers = header_map(&config(&[(
            "NEXT_PUBLIC_SITE_URL",
            "http://127.0.0.1:3001",
        )]));

        let csp = headers
            .get("content-security-policy")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(
            csp.ends_with(
                "; report-uri http://127.0.0.1:3001/api/csp-report; report-to csp-endpoint"
            ),
            "{csp}"
        );
    }

    #[test]
    fn a_header_the_handler_already_set_is_kept() {
        let mut headers = HeaderMap::new();
        headers.insert("x-frame-options", HeaderValue::from_static("DENY"));

        NativeRouteHeaders::new(&config(&[]))
            .unwrap()
            .apply(&mut headers);

        assert_eq!(headers.get_all("x-frame-options").iter().count(), 1);
        assert_eq!(headers.get("x-frame-options").unwrap(), "DENY");
    }
}
