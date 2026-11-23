//! Port of `lib/rate-limit.ts`: an in-memory sliding-window limiter and the
//! client IP it is keyed by. The state is local to this process, as it is in
//! Next; a route answered here no longer shares its counters with Next.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;

use axum::http::HeaderMap;
use axum::http::header::HeaderName;

const SWEEP_INTERVAL_MS: i64 = 60_000;

struct Bucket {
    /// Request times in the window (ms since the epoch), oldest first.
    hits: Vec<i64>,
    window_ms: i64,
}

struct Buckets {
    by_key: HashMap<Vec<u8>, Bucket>,
    last_sweep: i64,
}

pub struct RateLimiter(Mutex<Buckets>);

#[derive(Debug, PartialEq, Eq)]
pub enum RateLimit {
    Ok,
    Limited { retry_after_sec: i64 },
}

impl RateLimiter {
    /// `now_ms` is `Date.now()`; the module records it as the last sweep when
    /// it loads.
    pub fn new(now_ms: i64) -> Self {
        Self(Mutex::new(Buckets {
            by_key: HashMap::new(),
            last_sweep: now_ms,
        }))
    }

    /// `rateLimit(key, { limit, windowMs })`.
    pub fn check(&self, key: Vec<u8>, limit: usize, window_ms: i64, now_ms: i64) -> RateLimit {
        // A panic while the lock is held cannot leave the map half-updated in
        // a way that matters here, so a poisoned lock is still usable.
        let mut buckets = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        buckets.sweep(now_ms);

        let cutoff = now_ms - window_ms;
        let mut hits = buckets
            .by_key
            .remove(&key)
            .map_or_else(Vec::new, |bucket| bucket.hits);
        hits.retain(|hit| *hit > cutoff);

        let verdict = if hits.len() >= limit {
            // Until the oldest request leaves the window:
            // Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)).
            let wait_ms = hits[0] + window_ms - now_ms;
            RateLimit::Limited {
                retry_after_sec: (wait_ms + 999).div_euclid(1000).max(1),
            }
        } else {
            hits.push(now_ms);
            RateLimit::Ok
        };
        buckets.by_key.insert(key, Bucket { hits, window_ms });
        verdict
    }
}

impl Buckets {
    /// Drops expired buckets, at most once per interval.
    fn sweep(&mut self, now_ms: i64) {
        if now_ms - self.last_sweep < SWEEP_INTERVAL_MS {
            return;
        }
        self.last_sweep = now_ms;
        self.by_key.retain(|_, bucket| {
            let cutoff = now_ms - bucket.window_ms;
            bucket.hits.retain(|hit| *hit > cutoff);
            !bucket.hits.is_empty()
        });
    }
}

/// `getClientIp` as it behaves inside the Next server: the first entry of
/// `X-Forwarded-For`, else `X-Real-IP`, else `unknown`.
///
/// Next fills in a missing `X-Forwarded-For` with the address of the TCP peer
/// before any route runs (`req.headers['x-forwarded-for'] ??=
/// socket.remoteAddress` in its base server), so `peer` stands in for an
/// absent header, and `X-Real-IP` is reached only when the header is present
/// with an empty first entry. Both servers listen on IPv4, where Node and
/// Rust write an address the same way.
///
/// Bytes, because a header value need not be UTF-8; Node reads it as Latin-1,
/// where equal bytes are equal strings.
pub fn client_ip(headers: &HeaderMap, peer: Option<IpAddr>) -> Vec<u8> {
    let name = HeaderName::from_static("x-forwarded-for");
    let forwarded = match peer {
        Some(peer) if !headers.contains_key(&name) => peer.to_string().into_bytes(),
        _ => combined(headers, &name),
    };
    let first = trim(
        forwarded
            .split(|byte| *byte == b',')
            .next()
            .unwrap_or_default(),
    );
    if !first.is_empty() {
        return first.to_vec();
    }
    let real_ip = combined(headers, &HeaderName::from_static("x-real-ip"));
    match trim(&real_ip) {
        [] => b"unknown".to_vec(),
        ip => ip.to_vec(),
    }
}

/// `Headers.get`: repeated headers joined with ", ".
fn combined(headers: &HeaderMap, name: &HeaderName) -> Vec<u8> {
    let values: Vec<&[u8]> = headers
        .get_all(name)
        .iter()
        .map(|value| value.as_bytes())
        .collect();
    values.join(&b", "[..])
}

/// `String.prototype.trim` on a Latin-1 string: the JavaScript whitespace
/// characters below U+0100.
pub fn trim(mut bytes: &[u8]) -> &[u8] {
    const fn is_space(byte: u8) -> bool {
        matches!(byte, 0x09..=0x0d | 0x20 | 0xa0)
    }
    while let [first, rest @ ..] = bytes
        && is_space(*first)
    {
        bytes = rest;
    }
    while let [rest @ .., last] = bytes
        && is_space(*last)
    {
        bytes = rest;
    }
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    const LIMIT: usize = 60;
    const WINDOW_MS: i64 = 60_000;

    fn key(name: &str) -> Vec<u8> {
        name.as_bytes().to_vec()
    }

    #[test]
    fn the_limit_th_request_passes_and_the_next_is_refused_until_the_window_moves() {
        let limiter = RateLimiter::new(1_000_000);

        for i in 0..LIMIT as i64 {
            assert_eq!(
                limiter.check(key("a"), LIMIT, WINDOW_MS, 1_000_000 + i),
                RateLimit::Ok,
                "request {}",
                i + 1
            );
        }
        // The oldest hit (t = 1_000_000) leaves the window at t + 60_000.
        assert_eq!(
            limiter.check(key("a"), LIMIT, WINDOW_MS, 1_000_100),
            RateLimit::Limited {
                retry_after_sec: 60
            }
        );
        assert_eq!(
            limiter.check(key("a"), LIMIT, WINDOW_MS, 1_059_001),
            RateLimit::Limited { retry_after_sec: 1 }
        );
        // Exactly at the edge `t > cutoff` is false for the oldest hit.
        assert_eq!(
            limiter.check(key("a"), LIMIT, WINDOW_MS, 1_060_000),
            RateLimit::Ok
        );
        // The second-oldest hit (t = 1_000_001) is still inside.
        assert_eq!(
            limiter.check(key("a"), LIMIT, WINDOW_MS, 1_060_000),
            RateLimit::Limited { retry_after_sec: 1 }
        );
    }

    #[test]
    fn a_refused_request_is_not_counted_and_keys_are_independent() {
        let limiter = RateLimiter::new(0);
        for _ in 0..2 {
            assert_eq!(limiter.check(key("a"), 2, 1_000, 10), RateLimit::Ok);
        }

        for _ in 0..5 {
            assert_eq!(
                limiter.check(key("a"), 2, 1_000, 500),
                RateLimit::Limited { retry_after_sec: 1 }
            );
        }
        assert_eq!(limiter.check(key("b"), 2, 1_000, 500), RateLimit::Ok);
        // Refusals did not extend the window.
        assert_eq!(limiter.check(key("a"), 2, 1_000, 1_010), RateLimit::Ok);
    }

    #[test]
    fn sweep_drops_expired_buckets_once_per_interval() {
        let limiter = RateLimiter::new(0);
        limiter.check(key("old"), 5, 1_000, 10);
        limiter.check(key("fresh"), 5, 100_000, 10);

        limiter.check(key("other"), 5, 1_000, 59_999);
        let before_interval = limiter.0.lock().unwrap().by_key.len();
        limiter.check(key("other"), 5, 1_000, 60_000);
        let buckets = limiter.0.lock().unwrap();

        assert_eq!(before_interval, 3);
        assert!(!buckets.by_key.contains_key(&key("old")));
        assert!(buckets.by_key.contains_key(&key("fresh")));
        assert_eq!(buckets.last_sweep, 60_000);
    }

    type HeaderPairs = [(&'static str, &'static [u8])];

    fn headers(pairs: &HeaderPairs) -> HeaderMap {
        let mut headers = HeaderMap::new();
        for (name, value) in pairs {
            headers.append(*name, HeaderValue::from_bytes(value).unwrap());
        }
        headers
    }

    #[test]
    fn client_ip_prefers_the_first_forwarded_entry() {
        let cases: [(&HeaderPairs, &[u8]); 8] = [
            (
                &[
                    ("x-forwarded-for", b"203.0.113.7, 10.0.0.1"),
                    ("x-real-ip", b"10.9.9.9"),
                ],
                b"203.0.113.7",
            ),
            (&[("x-forwarded-for", b" \t203.0.113.7 ")], b"203.0.113.7"),
            // Two header lines read as one list.
            (
                &[
                    ("x-forwarded-for", b"198.51.100.1"),
                    ("x-forwarded-for", b"203.0.113.7"),
                ],
                b"198.51.100.1",
            ),
            // An empty first entry does not fall through to the second one.
            (
                &[
                    ("x-forwarded-for", b" , 203.0.113.7"),
                    ("x-real-ip", b" 10.9.9.9 "),
                ],
                b"10.9.9.9",
            ),
            (
                &[("x-forwarded-for", b""), ("x-real-ip", b"10.9.9.9")],
                b"10.9.9.9",
            ),
            (
                &[("x-forwarded-for", b","), ("x-real-ip", b"   ")],
                b"unknown",
            ),
            (&[("x-forwarded-for", b"")], b"unknown"),
            // U+00A0 is whitespace to JavaScript, U+0085 is not.
            (
                &[("x-forwarded-for", b"\xa0203.0.113.7\x85")],
                b"203.0.113.7\x85",
            ),
        ];
        let peer = Some(IpAddr::from([192, 0, 2, 9]));

        for (pairs, expected) in cases {
            // A header that is present wins over the peer address, even empty.
            assert_eq!(client_ip(&headers(pairs), peer), expected, "{pairs:?}");
            assert_eq!(client_ip(&headers(pairs), None), expected, "{pairs:?}");
        }
    }

    #[test]
    fn client_ip_is_the_peer_address_when_no_forwarded_header_was_sent() {
        let real_ip = headers(&[("x-real-ip", b"10.9.9.9")]);

        // What Next sees after filling the header in: X-Real-IP is not consulted.
        assert_eq!(
            client_ip(&real_ip, Some(IpAddr::from([192, 0, 2, 9]))),
            b"192.0.2.9"
        );
        assert_eq!(
            client_ip(&HeaderMap::new(), Some("::ffff:192.0.2.9".parse().unwrap())),
            b"::ffff:192.0.2.9"
        );
        // No peer address known (Node: a socket already destroyed).
        assert_eq!(client_ip(&real_ip, None), b"10.9.9.9");
        assert_eq!(client_ip(&HeaderMap::new(), None), b"unknown");
    }
}
