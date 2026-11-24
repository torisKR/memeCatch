//! better-auth's rate limiter as this app runs it: on in production, kept in
//! memory, 100 requests per 10 s per client address and path
//! (dist/api/rate-limiter/index.mjs; dist/context/create-context.mjs:170-175).
//! The counts are this process's own; Next keeps its own for the paths it
//! answers.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv6Addr};
use std::sync::Mutex;

use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;

const WINDOW_MS: i64 = 10_000;
const MAX: u32 = 100;
/// `MEMORY_STORE_MAX_ENTRIES`.
const MAX_ENTRIES: usize = 100_000;
/// `NO_TRUSTED_IP_KEY`: every request without one usable address shares it.
const NO_TRUSTED_IP: &str = "no-trusted-ip";

struct Entry {
    count: u32,
    last_request: i64,
    expires_at: i64,
    /// Insertion order, for evicting the oldest as `Map` iteration does.
    order: u64,
}

pub struct AuthRateLimiter(Mutex<(HashMap<String, Entry>, u64)>);

impl AuthRateLimiter {
    pub fn new() -> Self {
        Self(Mutex::new((HashMap::new(), 0)))
    }

    /// `onRequestRateLimit`: `Some` is the 429 to answer with. `path` is the
    /// path below `/api/auth` (`normalizePathname`).
    pub fn check(&self, headers: &HeaderMap, path: &str, now: i64) -> Option<Response> {
        let key = format!(
            "{}|{path}",
            client_ip(headers).unwrap_or_else(|| NO_TRUSTED_IP.into())
        );
        let mut guard = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let (entries, next_order) = &mut *guard;
        // `pruneMemoryStore`.
        entries.retain(|_, entry| now < entry.expires_at);
        if entries.len() > MAX_ENTRIES {
            let mut orders: Vec<u64> = entries.values().map(|entry| entry.order).collect();
            orders.sort_unstable();
            let cutoff = orders[entries.len() - MAX_ENTRIES - 1];
            entries.retain(|_, entry| entry.order > cutoff);
        }
        // `decideConsume`.
        let (count, allowed, retry_after) = match entries.get(&key) {
            None => (1, true, None),
            Some(entry) if now - entry.last_request >= WINDOW_MS => (1, true, None),
            Some(entry) if entry.count >= MAX => {
                let retry = (entry.last_request + WINDOW_MS - now + 999).div_euclid(1000);
                (entry.count, false, Some(retry))
            }
            Some(entry) => (entry.count + 1, true, None),
        };
        if !allowed {
            return Some(limited(retry_after.unwrap_or(WINDOW_MS / 1000)));
        }
        let order = entries
            .get(&key)
            .map(|entry| entry.order)
            .unwrap_or_else(|| {
                *next_order += 1;
                *next_order
            });
        entries.insert(
            key,
            Entry {
                count,
                last_request: now,
                expires_at: now + WINDOW_MS,
                order,
            },
        );
        None
    }
}

/// `rateLimitResponse(retryAfter)`.
fn limited(retry_after: i64) -> Response {
    let mut response = super::answer(
        StatusCode::TOO_MANY_REQUESTS,
        b"Too Many Requests",
        r#"{"message":"Too many requests. Please try again later."}"#.to_owned(),
        Vec::new(),
        false,
    );
    response
        .headers_mut()
        .insert("x-retry-after", retry_after.into());
    response
}

/// `getIP` with the default options (core dist/utils/ip.mjs:174-219): the
/// `x-forwarded-for` header, which must hold exactly one valid address,
/// normalized. Production has no localhost fallback.
fn client_ip(headers: &HeaderMap) -> Option<String> {
    let values: Vec<&str> = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .collect();
    if values.is_empty() {
        return None;
    }
    // `Headers.get` joins repeated values with ", ".
    let joined = values.join(", ");
    let addresses: Vec<&str> = joined
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect();
    let [address] = addresses[..] else {
        return None;
    };
    normalize(address)
}

/// `normalizeIP(ip, { ipv6Subnet: 64 })`: IPv4 as written, an IPv4-mapped
/// IPv6 address as its IPv4, other IPv6 as eight four-digit groups with the
/// last four zeroed.
fn normalize(address: &str) -> Option<String> {
    match address.parse::<IpAddr>().ok()? {
        IpAddr::V4(_) => Some(address.to_ascii_lowercase()),
        IpAddr::V6(ip) => {
            if let Some(mapped) = mapped_ipv4(address, &ip) {
                return Some(mapped);
            }
            let groups: Vec<String> = ip
                .segments()
                .iter()
                .enumerate()
                .map(|(index, group)| {
                    if index < 4 {
                        format!("{group:04x}")
                    } else {
                        "0000".into()
                    }
                })
                .collect();
            Some(groups.join(":"))
        }
    }
}

/// `extractIPv4FromMapped`: `::ffff:a.b.c.d`, seven groups whose sixth is
/// `ffff` and whose last is an IPv4 address, or `::ffff:0:0/96`.
fn mapped_ipv4(address: &str, ip: &Ipv6Addr) -> Option<String> {
    let lower = address.to_ascii_lowercase();
    if let Some(rest) = lower.strip_prefix("::ffff:")
        && rest.parse::<std::net::Ipv4Addr>().is_ok()
    {
        return Some(rest.to_owned());
    }
    let parts: Vec<&str> = address.split(':').collect();
    if parts.len() == 7
        && parts[5].eq_ignore_ascii_case("ffff")
        && parts[6].parse::<std::net::Ipv4Addr>().is_ok()
    {
        return Some(parts[6].to_owned());
    }
    ip.to_ipv4_mapped().map(|v4| v4.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn xff(value: &'static str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", value.parse().unwrap());
        headers
    }

    #[test]
    fn the_address_is_the_one_forwarded_address_normalized() {
        assert_eq!(
            client_ip(&xff("203.0.113.5")).as_deref(),
            Some("203.0.113.5")
        );
        assert_eq!(
            client_ip(&xff(" 203.0.113.5 ")).as_deref(),
            Some("203.0.113.5")
        );
        assert_eq!(client_ip(&xff("203.0.113.5, 10.0.0.1")), None);
        assert_eq!(client_ip(&xff("not an address")), None);
        assert_eq!(client_ip(&HeaderMap::new()), None);
        assert_eq!(
            client_ip(&xff("::ffff:192.0.2.1")).as_deref(),
            Some("192.0.2.1")
        );
        assert_eq!(
            client_ip(&xff("2001:DB8::1")).as_deref(),
            Some("2001:0db8:0000:0000:0000:0000:0000:0000")
        );
    }

    #[test]
    fn a_hundred_requests_pass_in_ten_seconds_and_the_next_waits() {
        let limiter = AuthRateLimiter::new();
        let headers = xff("198.51.100.7");
        for at in 0..100 {
            assert!(
                limiter
                    .check(&headers, "/get-session", 1_000 + at)
                    .is_none()
            );
        }
        let refused = limiter
            .check(&headers, "/get-session", 1_100)
            .expect("the 101st waits");
        assert_eq!(refused.status(), StatusCode::TOO_MANY_REQUESTS);
        // retryAfter counts from the last allowed request (1_099).
        assert_eq!(refused.headers()["x-retry-after"], "10");
        assert!(limiter.check(&headers, "/sign-out", 1_100).is_none());
        assert!(limiter.check(&headers, "/get-session", 11_099).is_none());
    }
}
