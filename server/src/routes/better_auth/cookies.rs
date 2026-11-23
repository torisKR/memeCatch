//! better-auth's cookies for this app: names and attributes
//! (`createCookieGetter`, dist/cookies/index.mjs:20-75), how better-call
//! writes a `Set-Cookie` line (better-call dist/cookies.mjs:44-85,
//! dist/crypto.mjs:26-31), and the chunked `session_data` store
//! (dist/cookies/session-store.mjs:30-155).

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

use crate::routes::public::js;

/// `session.expiresIn` default: 7 days, the `Max-Age` of the session cookie.
pub const SESSION_MAX_AGE_SECS: i64 = 604_800;

/// The three cookie names of `getCookies`: `better-auth.<name>`, prefixed
/// `__Secure-` when `useSecureCookies` is on (lib/auth/server.ts:120).
pub struct AuthCookies {
    secure: bool,
    pub session_token: String,
    pub session_data: String,
    pub dont_remember: String,
}

impl AuthCookies {
    pub fn new(secure: bool) -> Self {
        let name = |cookie: &str| {
            let prefix = if secure { "__Secure-" } else { "" };
            format!("{prefix}better-auth.{cookie}")
        };
        Self {
            secure,
            session_token: name("session_token"),
            session_data: name("session_data"),
            dont_remember: name("dont_remember"),
        }
    }

    /// `serializeCookieValue` with the attributes every one of these cookies
    /// has: `Path=/`, `HttpOnly`, `Secure` with the prefix, `SameSite=Lax`.
    /// `Max-Age` comes first when there is one.
    fn line(&self, name: &str, value: &str, max_age: Option<i64>) -> String {
        let mut line = format!("{name}={value}");
        if let Some(max_age) = max_age {
            line.push_str(&format!("; Max-Age={max_age}"));
        }
        line.push_str("; Path=/; HttpOnly");
        // `resolveCookie` forces `Secure` on a `__Secure-` name; `secure` is
        // set from the same prefix (`createCookie`).
        if self.secure {
            line.push_str("; Secure");
        }
        line.push_str("; SameSite=Lax");
        line
    }

    /// `ctx.setSignedCookie(name, token, secret, { maxAge })`: the value is
    /// `encodeURIComponent("<token>.<base64 HMAC-SHA256>")`.
    pub fn signed(&self, name: &str, token: &str, secret: &str, max_age: i64) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("any key length");
        mac.update(token.as_bytes());
        let signature = STANDARD.encode(mac.finalize().into_bytes());
        let value = js::encode_uri_component(&format!("{token}.{signature}"));
        self.line(name, &value, Some(max_age))
    }

    /// `ctx.setCookie(name, "", { ...attributes, maxAge: 0 })`.
    pub fn expired(&self, name: &str) -> String {
        self.line(name, "", Some(0))
    }
}

/// The `Set-Cookie` lines an endpoint sets, in order. `expire` first drops
/// lines already set for the name or its chunks (`removeSetCookieEntries`,
/// dist/cookies/index.mjs:204-219); the answer carries one line per name,
/// where it first appeared, with the last value (measured on Next: a chunk
/// expired twice is sent once).
#[derive(Default)]
pub struct SetCookies(Vec<(String, String)>);

impl SetCookies {
    pub fn set(&mut self, name: &str, line: String) {
        self.0.push((name.to_owned(), line));
    }

    /// `expireCookie(ctx, cookie)`.
    pub fn expire(&mut self, cookies: &AuthCookies, name: &str) {
        let chunk = format!("{name}.");
        self.0
            .retain(|(set, _)| set != name && !set.starts_with(&chunk));
        self.set(name, cookies.expired(name));
    }

    /// `sessionStore.setCookies(sessionStore.clean())`: each `session_data`
    /// cookie or chunk the request carries, expired.
    pub fn clean_chunks(&mut self, cookies: &AuthCookies, chunks: &[String]) {
        for name in chunks {
            self.set(name, cookies.expired(name));
        }
    }

    /// `deleteSessionCookie(ctx)` (dist/cookies/index.mjs:244-258) for this
    /// app: no account cookie, OAuth state kept in the database.
    pub fn delete_session_cookie(&mut self, cookies: &AuthCookies, chunks: &[String]) {
        self.expire(cookies, &cookies.session_token);
        self.expire(cookies, &cookies.session_data);
        self.clean_chunks(cookies, chunks);
        self.expire(cookies, &cookies.dont_remember);
    }

    pub fn into_lines(self) -> Vec<String> {
        let mut lines: Vec<(String, String)> = Vec::new();
        for (name, line) in self.0 {
            match lines.iter_mut().find(|(seen, _)| *seen == name) {
                Some(entry) => entry.1 = line,
                None => lines.push((name, line)),
            }
        }
        lines.into_iter().map(|(_, line)| line).collect()
    }
}

/// `readExistingChunks(cookieName, ctx)` (dist/cookies/session-store.mjs:41-49)
/// over better-auth's own `parseCookies` (dist/cookies/cookie-utils.mjs:155-166):
/// the names equal to `base` or `base.<n>`, in the order they first appear.
pub fn existing_chunks(cookie_header: Option<&str>, base: &str) -> Vec<String> {
    parse_cookies(cookie_header.unwrap_or_default())
        .into_iter()
        .map(|(name, _)| name)
        .filter(|name| name == base || chunk_index(base, name).is_some())
        .collect()
}

/// Whether `getChunkedCookie(ctx, base)` (dist/cookies/session-store.mjs:137-155)
/// is truthy: better-call's value for `base`, or the chunks joined in index
/// order, is not empty.
pub fn has_chunked_cookie(cookie_header: Option<&str>, base: &str) -> bool {
    let Some(header) = cookie_header else {
        return false;
    };
    if crate::auth::cookie_value(header, base).is_some_and(|value| !value.is_empty()) {
        return true;
    }
    parse_cookies(header)
        .into_iter()
        .any(|(name, value)| chunk_index(base, &name).is_some() && !value.is_empty())
}

/// `parseCookieChunkIndex`: `base.<n>` where `<n>` is a safe integer
/// written canonically.
fn chunk_index(base: &str, name: &str) -> Option<u64> {
    let suffix = name.strip_prefix(base)?.strip_prefix('.')?;
    let index: u64 = suffix.parse().ok()?;
    (index <= 9_007_199_254_740_991 && index.to_string() == suffix).then_some(index)
}

/// better-auth's `parseCookies`: split on `;`, names and values trimmed of
/// spaces and tabs, quotes dropped, only RFC 6265 names and values kept. A
/// repeated name keeps its first place and takes the last value (`Map.set`).
fn parse_cookies(header: &str) -> Vec<(String, String)> {
    let mut cookies: Vec<(String, String)> = Vec::new();
    if header.chars().count() < 2 {
        return cookies;
    }
    let trim_ows = |text: &str| text.trim_matches([' ', '\t']).to_owned();
    for chunk in header.split(';') {
        let Some(eq) = chunk.find('=') else { continue };
        let key = trim_ows(&chunk[..eq]);
        let mut value = trim_ows(&chunk[eq + 1..]);
        if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
            value = value[1..value.len() - 1].to_owned();
        }
        if !is_cookie_name(&key) || !is_cookie_value(&value) {
            continue;
        }
        let value = decode(&value);
        match cookies.iter_mut().find(|(seen, _)| *seen == key) {
            Some(entry) => entry.1 = value,
            None => cookies.push((key, value)),
        }
    }
    cookies
}

/// `cookieNameRegex`.
fn is_cookie_name(name: &str) -> bool {
    !name.is_empty()
        && name.bytes().all(|byte| {
            matches!(byte, 0x21 | 0x23..=0x27 | 0x2a | 0x2b | 0x2d | 0x2e | 0x30..=0x39
                | 0x41..=0x5a | 0x5e..=0x7a | 0x7c | 0x7e)
        })
}

/// `cookieValueRegex`: RFC 6265 cookie octets plus space and comma.
fn is_cookie_value(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| matches!(byte, 0x20 | 0x21 | 0x23..=0x3a | 0x3c..=0x5b | 0x5d..=0x7e))
}

/// better-auth's `tryDecode`: undecoded when it holds no `%`.
fn decode(value: &str) -> String {
    if value.contains('%') {
        crate::auth::try_decode(value)
    } else {
        value.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DATA: &str = "__Secure-better-auth.session_data";

    // Expected lines are what Next sent for the same requests.
    #[test]
    fn writes_the_lines_better_call_writes() {
        let cookies = AuthCookies::new(true);
        assert_eq!(
            cookies.expired(&cookies.session_token),
            "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        assert_eq!(
            cookies.signed(
                &cookies.session_token,
                "aBBIIM2fx6h1p2Dc92WGjKbAOcc74lOK",
                "a1-test-auth-secret-0123456789abcdef",
                SESSION_MAX_AGE_SECS
            ),
            "__Secure-better-auth.session_token=aBBIIM2fx6h1p2Dc92WGjKbAOcc74lOK.tuFg6Yrgm1%2B2mtJfJQjgBlJphk%2F%2F9ExTjaZQ1yPgc3U%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        let plain = AuthCookies::new(false);
        assert_eq!(
            plain.expired(&plain.dont_remember),
            "better-auth.dont_remember=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"
        );
    }

    #[test]
    fn delete_session_cookie_replaces_and_deduplicates_as_next_did() {
        let cookies = AuthCookies::new(true);
        let header = format!("{DATA}=x; {DATA}.0=y; other=z");
        let chunks = existing_chunks(Some(&header), DATA);
        assert_eq!(chunks, [DATA.to_owned(), format!("{DATA}.0")]);
        let mut set = SetCookies::default();
        set.clean_chunks(&cookies, &chunks);
        set.delete_session_cookie(&cookies, &chunks);
        let names: Vec<String> = set
            .into_lines()
            .iter()
            .map(|line| line.split('=').next().unwrap_or_default().to_owned())
            .collect();
        assert_eq!(
            names,
            [
                "__Secure-better-auth.session_token".to_owned(),
                DATA.to_owned(),
                format!("{DATA}.0"),
                "__Secure-better-auth.dont_remember".to_owned()
            ]
        );
    }

    #[test]
    fn chunks_are_canonical_integers_and_need_a_value() {
        assert_eq!(chunk_index(DATA, &format!("{DATA}.12")), Some(12));
        for name in [
            format!("{DATA}.01"),
            format!("{DATA}.-1"),
            format!("{DATA}.x"),
            format!("{DATA}x"),
        ] {
            assert_eq!(chunk_index(DATA, &name), None, "{name}");
        }
        assert!(!has_chunked_cookie(Some(&format!("{DATA}=")), DATA));
        assert!(has_chunked_cookie(Some(&format!("{DATA}.1=v")), DATA));
        assert!(has_chunked_cookie(Some(&format!("{DATA}=v")), DATA));
        assert!(!has_chunked_cookie(None, DATA));
    }
}
