//! Port of `lib/rate-limit.ts`: an in-memory sliding-window limiter and the
//! client IP it is keyed by. The state is local to this process, as it is in
//! Next; a route answered here no longer shares its counters with Next.
//!
//! Two limits the TypeScript does not have, because a client chooses the key
//! (`X-Forwarded-For`) and this process has far less memory than Next:
//!
//! - A key is an IP address or `unknown` ([`client_ip`]). Next keys by
//!   whatever text the header holds; here every value that is not an address
//!   shares the `unknown` bucket.
//! - The map holds at most [`MAX_BUCKETS`] buckets. While it is full, a client
//!   that has no bucket yet is treated as over the limit.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;

use axum::http::HeaderMap;
use axum::http::header::HeaderName;

const SWEEP_INTERVAL_MS: i64 = 60_000;
/// The most buckets kept at once. A bucket is a key of at most 56 bytes (the
/// route prefix and an address) and up to `limit` timestamps, so 10,000 of
/// them stay under 10 MB. That many clients reporting within one window is far
/// more than this site sees.
const MAX_BUCKETS: usize = 10_000;
/// How often a full map is swept for a client that has no bucket.
const FULL_SWEEP_INTERVAL_MS: i64 = 1_000;

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
        buckets.sweep(now_ms, SWEEP_INTERVAL_MS);

        let cutoff = now_ms - window_ms;
        let mut hits = match buckets.by_key.remove(&key) {
            Some(bucket) => bucket.hits,
            None => {
                if buckets.by_key.len() >= MAX_BUCKETS {
                    buckets.sweep(now_ms, FULL_SWEEP_INTERVAL_MS);
                }
                if buckets.by_key.len() >= MAX_BUCKETS {
                    // No room to count this client: refuse it for one window.
                    return RateLimit::Limited {
                        retry_after_sec: (window_ms + 999).div_euclid(1000).max(1),
                    };
                }
                Vec::new()
            }
        };
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
    /// Drops expired buckets, at most once per `interval_ms`.
    fn sweep(&mut self, now_ms: i64, interval_ms: i64) {
        if now_ms - self.last_sweep < interval_ms {
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

/// `getClientIp` as it behaves inside the Next server, for a rate limit key:
/// the first entry of `X-Forwarded-For`, else `X-Real-IP`, else `unknown`.
///
/// Unlike Next, an entry or an `X-Real-IP` that is not an IP address counts
/// as `unknown`, so a key is never longer than an address (45 bytes). An
/// address is returned as the client wrote it, as Next keys it.
pub fn client_ip(headers: &HeaderMap, peer: Option<IpAddr>) -> Vec<u8> {
    let address = client_address(headers, peer);
    if is_ip_address(&address) {
        address
    } else {
        b"unknown".to_vec()
    }
}

/// `getClientIp` with nothing changed: whatever text the header holds. For
/// code that hashes the value, where the bytes must be the ones Next hashes.
/// Never a map key: a client chooses its length ([`client_ip`] is the key).
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
pub fn client_address(headers: &HeaderMap, peer: Option<IpAddr>) -> Vec<u8> {
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
    let candidate = if first.is_empty() {
        combined(headers, &HeaderName::from_static("x-real-ip"))
    } else {
        first.to_vec()
    };
    let candidate = trim(&candidate);
    if candidate.is_empty() {
        b"unknown".to_vec()
    } else {
        candidate.to_vec()
    }
}

fn is_ip_address(bytes: &[u8]) -> bool {
    std::str::from_utf8(bytes).is_ok_and(|text| text.parse::<IpAddr>().is_ok())
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
        let cases: [(&HeaderPairs, &[u8]); 9] = [
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
            // U+00A0 is whitespace to JavaScript and is trimmed.
            (
                &[("x-forwarded-for", b"\xa0203.0.113.7\xa0")],
                b"203.0.113.7",
            ),
            (
                &[("x-forwarded-for", b"2001:db8::7, 10.0.0.1")],
                b"2001:db8::7",
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

    #[test]
    fn a_value_that_is_not_an_ip_address_is_keyed_unknown() {
        let long = vec![b'a'; 120_000];
        let cases: [&HeaderPairs; 9] = [
            &[("x-forwarded-for", b"not-an-address")],
            &[("x-forwarded-for", b"203.0.113.7:8080")],
            &[("x-forwarded-for", b"[2001:db8::7]")],
            &[("x-forwarded-for", b"203.0.113.7 203.0.113.8")],
            // U+0085 is not whitespace to JavaScript, so it stays in the entry.
            &[("x-forwarded-for", b"203.0.113.7\x85")],
            &[("x-forwarded-for", b"\xff\xfe")],
            // It does not fall through to X-Real-IP: Next would not either.
            &[
                ("x-forwarded-for", b"not-an-address"),
                ("x-real-ip", b"10.9.9.9"),
            ],
            &[("x-forwarded-for", b""), ("x-real-ip", b"not-an-address")],
            &[("x-forwarded-for", b","), ("x-real-ip", b"10.9.9.9:80")],
        ];

        for pairs in cases {
            assert_eq!(client_ip(&headers(pairs), None), b"unknown", "{pairs:?}");
        }
        let mut huge = HeaderMap::new();
        huge.insert("x-forwarded-for", HeaderValue::from_bytes(&long).unwrap());
        assert_eq!(client_ip(&huge, None), b"unknown");
    }

    #[test]
    fn client_address_keeps_the_text_next_would_hash() {
        let cases: [(&HeaderPairs, &[u8]); 6] = [
            (
                &[("x-forwarded-for", b"203.0.113.7, 10.0.0.1")],
                b"203.0.113.7",
            ),
            (
                &[("x-forwarded-for", b" not-an-address ")],
                b"not-an-address",
            ),
            (
                &[("x-forwarded-for", b"203.0.113.7:8080")],
                b"203.0.113.7:8080",
            ),
            (
                &[("x-forwarded-for", b","), ("x-real-ip", b" r\xe9al ")],
                b"r\xe9al",
            ),
            (&[("x-forwarded-for", b"")], b"unknown"),
            (
                &[("x-forwarded-for", b","), ("x-real-ip", b"  ")],
                b"unknown",
            ),
        ];

        for (pairs, expected) in cases {
            assert_eq!(client_address(&headers(pairs), None), expected, "{pairs:?}");
        }
        assert_eq!(
            client_address(&HeaderMap::new(), Some(IpAddr::from([192, 0, 2, 9]))),
            b"192.0.2.9"
        );
        assert_eq!(client_address(&HeaderMap::new(), None), b"unknown");
    }

    // The reviewer's reproduction: every request names a different 120 KB
    // "client". All of them share one small bucket.
    #[test]
    fn requests_with_different_huge_forwarded_values_share_one_bucket() {
        let limiter = RateLimiter::new(0);

        for request in 0..1_500_u32 {
            let mut value = format!("{request:08}").into_bytes();
            value.resize(120_000, b'x');
            let mut headers = HeaderMap::new();
            headers.insert("x-forwarded-for", HeaderValue::from_bytes(&value).unwrap());

            limiter.check(client_ip(&headers, None), LIMIT, WINDOW_MS, 1_000);
        }

        let buckets = limiter.0.lock().unwrap();
        assert_eq!(buckets.by_key.len(), 1);
        let stored: usize = buckets.by_key.keys().map(Vec::len).sum();
        assert_eq!(stored, b"unknown".len());
    }

    fn address(n: usize) -> Vec<u8> {
        format!("10.{}.{}.{}", n >> 16, (n >> 8) & 0xff, n & 0xff).into_bytes()
    }

    #[test]
    fn a_full_map_refuses_new_keys_until_buckets_expire() {
        let limiter = RateLimiter::new(0);
        for n in 0..MAX_BUCKETS {
            assert_eq!(
                limiter.check(address(n), LIMIT, WINDOW_MS, 1_000),
                RateLimit::Ok,
                "address {n}"
            );
        }

        // Full: a new client is treated as over the limit, a known one is not.
        let refused = limiter.check(address(MAX_BUCKETS), LIMIT, WINDOW_MS, 30_000);
        let known = limiter.check(address(7), LIMIT, WINDOW_MS, 30_000);
        let still_full = limiter.0.lock().unwrap().by_key.len();
        // Every bucket but the one touched at t = 30 s has expired by now.
        let after_expiry = limiter.check(address(MAX_BUCKETS), LIMIT, WINDOW_MS, 62_000);
        let swept = limiter.0.lock().unwrap().by_key.len();

        assert_eq!(
            refused,
            RateLimit::Limited {
                retry_after_sec: 60
            }
        );
        assert_eq!(known, RateLimit::Ok);
        assert_eq!(still_full, MAX_BUCKETS);
        assert_eq!(after_expiry, RateLimit::Ok);
        assert_eq!(swept, 2);
    }
}
