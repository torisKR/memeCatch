//! What the account pages and `/auth/callback` share around a handler:
//! `safeNext` (lib/safe-redirect.ts) and the `Set-Cookie` lines for the
//! cookies better-auth's calls set (`ResponseCookies` of
//! @edge-runtime/cookies). `routes/better_auth/tiktok/next.rs` holds a copy;
//! the two should become one (PLAN.md B6-2).

use url::Url;

use crate::auth::try_decode;
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

/// The cookies one request sets, as better-auth's `nextCookies` keeps them:
/// one entry per name, in the order first set, holding the last value.
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

    /// The `Set-Cookie` lines of a handler's response.
    pub fn lines(&self, now_ms: i64) -> Vec<String> {
        self.0.iter().map(|cookie| cookie.line(now_ms)).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values: `safeNext` of lib/safe-redirect.ts under Node 24 on
    // the same inputs (A4's test).
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

    // Expected values: what the TypeScript wrote (A4's test).
    #[test]
    fn set_cookie_lines_are_the_ones_next_writes() {
        let now = 1_795_481_493_000;
        let mut store = CookieStore::default();
        assert!(store.lines(now).is_empty());
        store.take(vec![
            "__Secure-better-auth.session_token=old.sig%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax".to_owned(),
            "__Secure-better-auth.dont_remember=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax".to_owned(),
        ]);
        store.take(vec![
            "__Secure-better-auth.session_token=new.sig%2F%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax".to_owned(),
        ]);
        assert_eq!(
            store.lines(now),
            [
                "__Secure-better-auth.session_token=new.sig%2F%3D; Path=/; \
                 Expires=Tue, 01 Dec 2026 00:51:33 GMT; Max-Age=604800; Secure; HttpOnly; SameSite=lax",
                "__Secure-better-auth.dont_remember=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax",
            ]
        );
    }
}
