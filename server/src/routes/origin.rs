//! `hasTrustedOrigin` of `lib/origin.ts`: the same-origin check the routes
//! that change state make before they use the session cookie.

use axum::http::header::{HeaderMap, HeaderName, ORIGIN};
use url::Url;

use super::public::labels;
use crate::AppState;

/// `Headers.get(name)`: the values joined with ", ", `None` when absent.
pub fn header(headers: &HeaderMap, name: HeaderName) -> Option<Vec<u8>> {
    let values: Vec<&[u8]> = headers
        .get_all(name)
        .iter()
        .map(|value| value.as_bytes())
        .collect();
    (!values.is_empty()).then(|| values.join(&b", "[..]))
}

/// `hasTrustedOrigin`. A request that names its origin must name the site's
/// (`NEXT_PUBLIC_SITE_URL`) or Next's own request URL; one that names none
/// must say it is same-origin.
///
/// Next's own request URL is `<protocol>://localhost:<its port>` (measured on
/// a standalone server bound to 127.0.0.1; `x-forwarded-proto` gives the
/// protocol). `next_port` is that port: this server's own (`PORT`).
pub fn has_trusted_origin(headers: &HeaderMap, site_url: &str, next_port: u16) -> bool {
    let Some(origin) = header(headers, ORIGIN).filter(|origin| !origin.is_empty()) else {
        let fetch_site = header(headers, HeaderName::from_static("sec-fetch-site"));
        return fetch_site.as_deref() == Some(b"same-origin");
    };
    // `new URL(SITE_URL)` throws on a site URL that is not one.
    let Ok(site) = Url::parse(site_url) else {
        return false;
    };
    origin == next_origin(headers, next_port).as_bytes()
        || origin == site.origin().ascii_serialization().as_bytes()
}

/// `new URL(request.url).origin` as Next builds it for `headers`: its own
/// address, `https` when `x-forwarded-proto` says so.
pub fn next_origin(headers: &HeaderMap, next_port: u16) -> String {
    let forwarded_proto = header(headers, HeaderName::from_static("x-forwarded-proto"));
    let https = forwarded_proto.is_some_and(|proto| proto.windows(5).any(|part| part == b"https"));
    match (https, next_port) {
        // `URL.origin` leaves out the default port.
        (true, 443) => "https://localhost".to_owned(),
        (false, 80) => "http://localhost".to_owned(),
        (true, port) => format!("https://localhost:{port}"),
        (false, port) => format!("http://localhost:{port}"),
    }
}

/// [`has_trusted_origin`] with this server's site URL and its own port.
pub fn request_is_trusted(state: &AppState, headers: &HeaderMap) -> bool {
    has_trusted_origin(
        headers,
        labels::site_url(&state.config.site_url),
        state.config.port,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    const SITE: &str = "https://catchmeme.com";

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut headers = HeaderMap::new();
        for (name, value) in pairs {
            headers.append(*name, HeaderValue::from_static(value));
        }
        headers
    }

    // Each verdict is what the Next route answered (403 or not) for the same
    // headers, with its own port in place of 3001 and its site URL.
    #[test]
    fn an_origin_is_trusted_when_it_is_the_sites_or_nexts_own() {
        let trusted = |pairs| has_trusted_origin(&headers(pairs), SITE, 3001);

        assert!(trusted(&[("origin", "https://catchmeme.com")]));
        assert!(trusted(&[("origin", "http://localhost:3001")]));
        assert!(trusted(&[
            ("origin", "https://localhost:3001"),
            ("x-forwarded-proto", "https"),
        ]));
        assert!(trusted(&[("sec-fetch-site", "same-origin")]));
        assert!(trusted(&[
            ("origin", ""),
            ("sec-fetch-site", "same-origin")
        ]));

        assert!(!trusted(&[]));
        assert!(!trusted(&[("sec-fetch-site", "same-site")]));
        assert!(!trusted(&[("sec-fetch-site", "Same-Origin")]));
        assert!(!trusted(&[("origin", "null")]));
        assert!(!trusted(&[("origin", "http://localhost:3000")]));
        assert!(!trusted(&[("origin", "http://LOCALHOST:3001")]));
        assert!(!trusted(&[("origin", "http://localhost:3001/")]));
        assert!(!trusted(&[("origin", "http://catchmeme.com")]));
        // The protocol of Next's own URL follows x-forwarded-proto.
        assert!(!trusted(&[
            ("origin", "http://localhost:3001"),
            ("x-forwarded-proto", "https"),
        ]));
        // A named origin is not rescued by sec-fetch-site.
        assert!(!trusted(&[
            ("origin", "https://evil.example"),
            ("sec-fetch-site", "same-origin"),
        ]));
    }

    #[test]
    fn the_sites_origin_is_the_whatwg_one_and_a_bad_site_url_trusts_no_origin() {
        let origin = &headers(&[("origin", "https://catchmeme.com")]);

        assert!(has_trusted_origin(
            origin,
            "HTTPS://CatchMeme.com:443/path",
            3001
        ));
        assert!(!has_trusted_origin(origin, "catchmeme.com", 3001));
        assert!(!has_trusted_origin(origin, "", 3001));
        // Without an origin the site URL is never parsed.
        assert!(has_trusted_origin(
            &headers(&[("sec-fetch-site", "same-origin")]),
            "",
            3001
        ));
    }
}
