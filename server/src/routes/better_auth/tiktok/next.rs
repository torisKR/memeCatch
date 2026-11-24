//! What Next does around the two TikTok route handlers: `safeNext`
//! (lib/safe-redirect.ts), `request.cookies` (`RequestCookies` of
//! @edge-runtime/cookies), the redirect targets the handlers build, and the
//! `Set-Cookie` lines Next writes (`ResponseCookies`, and
//! `appendMutableCookies` merging what better-auth's `nextCookies` put in
//! `cookies()` into the handler's own response).

use axum::http::HeaderMap;
use url::{Position, Url};

use crate::auth::{cookie_header, try_decode};
use crate::routes::public::js;
use crate::routes::public::js_date::to_utc_string;
use crate::routes::request::decode_uri_component;

/// `APP_ORIGIN` of lib/safe-redirect.ts.
const APP_ORIGIN: &str = "https://catchmeme.com";
const AUTH_ROUTES: [&str; 4] = ["/login", "/auth", "/forgot-password", "/reset-password"];
const MAX_NEXT: usize = 2048;

/// `safeNext(raw)`: a same-origin path, query and fragment, or `/`.
pub fn safe_next(raw: Option<&str>) -> String {
    let candidate = raw.unwrap_or("/");
    if js::utf16_len(candidate) > MAX_NEXT
        || candidate.chars().any(|c| c <= '\u{1f}' || c == '\u{7f}')
    {
        return "/".to_owned();
    }
    let mut decoded = candidate.to_owned();
    for _ in 0..3 {
        let Some(next) = decode_uri_component(&decoded) else {
            return "/".to_owned();
        };
        if next == decoded {
            break;
        }
        decoded = next;
    }
    if !decoded.starts_with('/') || decoded.starts_with("//") || decoded.contains('\\') {
        return "/".to_owned();
    }
    let Ok(resolved) = Url::parse(APP_ORIGIN).and_then(|base| base.join(candidate)) else {
        return "/".to_owned();
    };
    let path = resolved.path();
    if resolved.origin().ascii_serialization() != APP_ORIGIN
        || path.starts_with("//")
        || path.contains('\\')
        || AUTH_ROUTES
            .iter()
            .any(|route| path == *route || path.starts_with(&format!("{route}/")))
    {
        return "/".to_owned();
    }
    // `search` and `hash` are "" for an empty query or fragment.
    let mut out = path.to_owned();
    if let Some(query) = resolved.query().filter(|query| !query.is_empty()) {
        out.push('?');
        out.push_str(query);
    }
    if let Some(fragment) = resolved.fragment().filter(|fragment| !fragment.is_empty()) {
        out.push('#');
        out.push_str(fragment);
    }
    out
}

/// `request.cookies.get(name)?.value`: `parseCookie` of the `Cookie` header
/// (split at `/; */`, a pair without `=` reads as `"true"`, the value
/// `decodeURIComponent`d, a pair that does not decode skipped), the last
/// value of a name winning.
pub fn request_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let header = cookie_header(headers)?;
    let mut found = None;
    for (index, pair) in header.split(';').enumerate() {
        let pair = if index == 0 {
            pair
        } else {
            pair.trim_start_matches(' ')
        };
        if pair.is_empty() {
            continue;
        }
        match pair.find('=') {
            None if pair == name => found = Some("true".to_owned()),
            None => {}
            Some(at) if &pair[..at] == name => {
                if let Some(value) = decode_uri_component(&pair[at + 1..]) {
                    found = Some(value);
                }
            }
            Some(_) => {}
        }
    }
    found
}

/// A root-relative URL resolved as `new URL(path, request.url)` resolves it.
fn resolve(path: &str) -> Option<Url> {
    Url::parse("http://localhost").ok()?.join(path).ok()
}

/// The path, query and fragment of `url`: what Rust sends as `Location`.
/// Next sends the absolute URL on its own listen address (PLAN.md A4-2).
fn relative(url: &Url) -> String {
    url[Position::BeforePath..].to_owned()
}

/// `new URL(`/login?error=auth&next=${encodeURIComponent(next)}`, request.url)`.
pub fn login_error(next: &str) -> String {
    let target = format!("/login?error=auth&next={}", js::encode_uri_component(next));
    resolve(&target).map_or(target, |url| relative(&url))
}

/// The callback's destination after a sign-in: `new URL(next, request.url)`,
/// with `tiktokImport` and `imported` set as `searchParams.set` sets them
/// when videos were to be imported.
pub fn signed_in(next: &str, import: Option<(bool, Option<usize>)>) -> String {
    let Some(mut url) = resolve(next) else {
        return login_error(next);
    };
    if let Some((failed, imported)) = import {
        let mut pairs: Vec<(String, String)> = url.query_pairs().into_owned().collect();
        set_param(
            &mut pairs,
            "tiktokImport",
            if failed { "failed" } else { "done" },
        );
        if let Some(count) = imported {
            set_param(&mut pairs, "imported", &count.to_string());
        }
        let query = url::form_urlencoded::Serializer::new(String::new())
            .extend_pairs(&pairs)
            .finish();
        url.set_query(Some(&query));
    }
    relative(&url)
}

/// `URLSearchParams.set`: the first pair of that name takes the value and
/// the others go; a new name is appended.
fn set_param(pairs: &mut Vec<(String, String)>, name: &str, value: &str) {
    match pairs.iter().position(|(key, _)| key == name) {
        Some(first) => {
            pairs[first].1 = value.to_owned();
            let mut index = 0;
            pairs.retain(|(key, _)| {
                index += 1;
                index - 1 == first || key != name
            });
        }
        None => pairs.push((name.to_owned(), value.to_owned())),
    }
}

/// The three cookies of the flow, each `{ path: "/auth/tiktok" }`.
pub const FLOW_COOKIES: [&str; 3] = [
    "tiktok_oauth_state",
    "tiktok_oauth_next",
    "tiktok_oauth_import",
];
const FLOW_PATH: &str = "/auth/tiktok";
const FLOW_MAX_AGE_SECS: i64 = 600;

/// `stringifyCookie` of a cookie `ResponseCookies` normalized.
struct Cookie {
    name: String,
    value: String,
    path: String,
    max_age: Option<i64>,
    secure: bool,
    http_only: bool,
    same_site: Option<String>,
}

impl Cookie {
    fn line(&self, now_ms: i64) -> String {
        let mut line = format!("{}={}", self.name, js::encode_uri_component(&self.value));
        line.push_str(&format!("; Path={}", self.path));
        // `normalizeCookie`: a truthy `maxAge` sets `expires` from now.
        if let Some(max_age) = self.max_age.filter(|max_age| *max_age != 0)
            && let Some(expires) = to_utc_string(now_ms + max_age * 1000)
        {
            line.push_str(&format!("; Expires={expires}"));
        }
        if let Some(max_age) = self.max_age {
            line.push_str(&format!("; Max-Age={max_age}"));
        }
        if self.secure {
            line.push_str("; Secure");
        }
        if self.http_only {
            line.push_str("; HttpOnly");
        }
        if let Some(same_site) = &self.same_site {
            line.push_str(&format!("; SameSite={same_site}"));
        }
        line
    }
}

/// The start's `response.cookies.set(name, value, { httpOnly, secure,
/// sameSite: "lax", path: "/auth/tiktok", maxAge: 600 })`.
pub fn flow_cookie(name: &str, value: &str, secure: bool, now_ms: i64) -> String {
    Cookie {
        name: name.to_owned(),
        value: value.to_owned(),
        path: FLOW_PATH.to_owned(),
        max_age: Some(FLOW_MAX_AGE_SECS),
        secure,
        http_only: true,
        same_site: Some("lax".to_owned()),
    }
    .line(now_ms)
}

/// Next's `cookies()` for one request, as better-auth's `nextCookies` fills
/// it: one entry per name, in the order first set, holding the last value.
#[derive(Default)]
pub struct CookieStore(Vec<Cookie>);

impl CookieStore {
    /// `cookieHelper.set(key, value.value, toCookieOptions(value))` for each
    /// line of `parseSetCookieHeader(set-cookie)`: the value `tryDecode`d,
    /// `Max-Age`, `Path`, `Secure`, `HttpOnly` and `SameSite` (lowercased).
    pub fn take(&mut self, lines: Vec<String>) {
        for line in lines {
            let mut parts = line.split(';').map(str::trim);
            let Some((name, value)) = parts.next().and_then(|first| first.split_once('=')) else {
                continue;
            };
            let mut cookie = Cookie {
                name: name.to_owned(),
                value: try_decode(value),
                path: "/".to_owned(),
                max_age: None,
                secure: false,
                http_only: false,
                same_site: None,
            };
            for attribute in parts {
                let (key, value) = attribute.split_once('=').unwrap_or((attribute, ""));
                match key.trim().to_ascii_lowercase().as_str() {
                    "max-age" => cookie.max_age = value.trim().parse().ok(),
                    "path" if !value.is_empty() => value.trim().clone_into(&mut cookie.path),
                    "secure" => cookie.secure = true,
                    "httponly" => cookie.http_only = true,
                    "samesite" if !value.is_empty() => {
                        cookie.same_site = Some(value.trim().to_ascii_lowercase());
                    }
                    _ => {}
                }
            }
            match self.0.iter_mut().find(|held| held.name == cookie.name) {
                Some(held) => *held = cookie,
                None => self.0.push(cookie),
            }
        }
    }

    /// The callback's lines: its three `{ path: "/auth/tiktok", maxAge: 0 }`
    /// cookies, then what the store holds. With anything in the store,
    /// `appendMutableCookies` parses the handler's lines again and drops the
    /// falsy `maxAge` (`compact`), so they lose `Max-Age=0`.
    pub fn callback_lines(&self, now_ms: i64) -> Vec<String> {
        let merged = !self.0.is_empty();
        let own = FLOW_COOKIES.iter().map(|name| {
            if merged {
                format!("{name}=; Path={FLOW_PATH}")
            } else {
                format!("{name}=; Path={FLOW_PATH}; Max-Age=0")
            }
        });
        own.chain(self.0.iter().map(|cookie| cookie.line(now_ms)))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    // Expected values: `safeNext` of lib/safe-redirect.ts under Node 24 on
    // the same inputs (node --experimental-strip-types, PLAN.md A4).
    #[test]
    fn next_is_made_safe_as_safe_next_makes_it() {
        let long = format!("/{}", "x".repeat(2048));
        let at_limit = format!("/{}", "x".repeat(2047));
        for (input, expected) in [
            (None, "/"),
            (Some(""), "/"),
            (Some("/"), "/"),
            (Some("/memes/x?a=1 b'c#h"), "/memes/x?a=1%20b%27c#h"),
            (Some("/my?x=%20y"), "/my?x=%20y"),
            (Some("//evil.example"), "/"),
            (Some("/\\evil"), "/"),
            (Some("/%2F%2Fevil"), "/"),
            (Some("/%5Cevil"), "/"),
            (Some("https://evil.example/"), "/"),
            (Some("/a/..//evil.example"), "/"),
            (Some("/..//evil.example"), "/"),
            (Some("/x/%2e%2e//evil"), "/"),
            (Some("/login"), "/"),
            (Some("/login/x"), "/"),
            (Some("/loginx"), "/loginx"),
            (Some("/auth/tiktok"), "/"),
            (Some("/AUTH"), "/AUTH"),
            (Some("/%E0%A4%A"), "/"),
            (Some("/%25252F%25252Fevil"), "/"),
            (Some("/%2525252F"), "/%2525252F"),
            (
                Some("/밈/검색?q=밈#해시"),
                "/%EB%B0%88/%EA%B2%80%EC%83%89?q=%EB%B0%88#%ED%95%B4%EC%8B%9C",
            ),
            (
                Some("/a^b`c{d}e|f'g\"h<i>j"),
                "/a%5Eb%60c%7Bd%7De|f'g%22h%3Ci%3Ej",
            ),
            (Some("/?q='\"<>`"), "/?q=%27%22%3C%3E`"),
            (Some("/#'\"<> `{}"), "/#'%22%3C%3E%20%60{}"),
            (Some("/a b"), "/a%20b"),
            (Some("/a\u{e9}"), "/a%C3%A9"),
            (Some("/a\u{85}b"), "/a%C2%85b"),
            (Some("/a\tb"), "/"),
            (Some(long.as_str()), "/"),
            (Some(at_limit.as_str()), at_limit.as_str()),
            (Some("/./a/../b"), "/b"),
            (Some("/a/%2e%2e/b"), "/b"),
            (Some("/?"), "/"),
            (Some("/#"), "/"),
            (Some("/?#"), "/"),
            (
                Some("/caf\u{e9}?\u{e9}=\u{e9}#\u{e9}"),
                "/caf%C3%A9?%C3%A9=%C3%A9#%C3%A9",
            ),
            (Some("/a?b=c&d"), "/a?b=c&d"),
            (Some("@evil"), "/"),
            (Some("/@evil"), "/@evil"),
            (Some("/ok%"), "/"),
        ] {
            assert_eq!(safe_next(input), expected, "{input:?}");
        }
    }

    #[test]
    fn cookies_are_read_as_request_cookies_reads_them() {
        let headers = |values: &[&'static str]| {
            let mut headers = HeaderMap::new();
            for value in values {
                headers.append("cookie", HeaderValue::from_static(value));
            }
            headers
        };
        let get = |values: &[&'static str], name| request_cookie(&headers(values), name);
        assert_eq!(get(&["a=1; b=%2Fx"], "b").as_deref(), Some("/x"));
        assert_eq!(get(&["a=1;b=2"], "b").as_deref(), Some("2"));
        assert_eq!(get(&["a=1", "a=2"], "a").as_deref(), Some("2"));
        assert_eq!(get(&["a=1; a=%E0"], "a").as_deref(), Some("1"));
        assert_eq!(get(&["flag"], "flag").as_deref(), Some("true"));
        assert_eq!(get(&[" a=1"], "a"), None);
        assert_eq!(get(&["a=1 "], "a").as_deref(), Some("1 "));
        assert_eq!(get(&[], "a"), None);
    }

    // Expected values: what the Next build answered (PLAN.md A4), without
    // its origin.
    #[test]
    fn destinations_are_built_as_the_handlers_build_them() {
        assert_eq!(login_error("/"), "/login?error=auth&next=%2F");
        assert_eq!(
            login_error("/memes/x?a=1%20b%27c#h"),
            "/login?error=auth&next=%2Fmemes%2Fx%3Fa%3D1%2520b%2527c%23h"
        );
        assert_eq!(login_error("/it's"), "/login?error=auth&next=%2Fit%27s");
        assert_eq!(signed_in("/my?a=1%20b", None), "/my?a=1%20b");
        assert_eq!(
            signed_in("/my?a=1%20b", Some((false, Some(2)))),
            "/my?a=1+b&tiktokImport=done&imported=2"
        );
        assert_eq!(
            signed_in("/?tiktokImport=x&b=1&tiktokImport=y#h", Some((true, None))),
            "/?tiktokImport=failed&b=1#h"
        );
    }

    #[test]
    fn set_cookie_lines_are_the_ones_next_writes() {
        let now = 1_795_481_493_000;
        assert_eq!(
            flow_cookie("tiktok_oauth_next", "/memes/x?a=1", true, now),
            "tiktok_oauth_next=%2Fmemes%2Fx%3Fa%3D1; Path=/auth/tiktok; \
             Expires=Tue, 24 Nov 2026 01:01:33 GMT; Max-Age=600; Secure; HttpOnly; SameSite=lax"
        );
        assert_eq!(
            flow_cookie("tiktok_oauth_import", "", false, now),
            "tiktok_oauth_import=; Path=/auth/tiktok; \
             Expires=Tue, 24 Nov 2026 01:01:33 GMT; Max-Age=600; HttpOnly; SameSite=lax"
        );
        let mut store = CookieStore::default();
        assert_eq!(
            store.callback_lines(now)[0],
            "tiktok_oauth_state=; Path=/auth/tiktok; Max-Age=0"
        );
        store.take(vec![
            "__Secure-better-auth.session_token=old.sig%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax".to_owned(),
            "__Secure-better-auth.dont_remember=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax".to_owned(),
        ]);
        store.take(vec![
            "__Secure-better-auth.session_token=new.sig%2F%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax".to_owned(),
        ]);
        assert_eq!(
            store.callback_lines(now),
            [
                "tiktok_oauth_state=; Path=/auth/tiktok",
                "tiktok_oauth_next=; Path=/auth/tiktok",
                "tiktok_oauth_import=; Path=/auth/tiktok",
                "__Secure-better-auth.session_token=new.sig%2F%3D; Path=/; \
                 Expires=Tue, 01 Dec 2026 00:51:33 GMT; Max-Age=604800; Secure; HttpOnly; SameSite=lax",
                "__Secure-better-auth.dont_remember=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax",
            ]
        );
    }
}
