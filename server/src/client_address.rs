//! The address of the client behind production's proxies, for limits keyed
//! by address (PLAN.md B6-3). A deliberate difference from better-auth's
//! `getIP` and from `getClientIp` of lib/rate-limit.ts: both read an address
//! a client can choose.
//!
//! The chain is Cloudflare, then Caddy (`deploy/Caddyfile`:
//! `trusted_proxies static {$CLOUDFLARE_TRUSTED_PROXIES}`), then this server.
//! Cloudflare appends the address it saw to any `X-Forwarded-For` the client
//! sent and sets `CF-Connecting-IP`; Caddy appends the Cloudflare edge it saw
//! when that edge is a trusted proxy, and replaces the header with the peer
//! it saw otherwise. Caddy forwards neither its own `client_ip` nor a
//! rewritten `CF-Connecting-IP`. So, read from the right, every entry up to
//! the first address that is not Cloudflare's was written by a proxy, and
//! that address is the client:
//!
//! | Request | `X-Forwarded-For` here | Client |
//! | --- | --- | --- |
//! | through Cloudflare | `client, edge` | `client` |
//! | through Cloudflare, header forged | `forged, client, edge` | `client` |
//! | straight to the origin, header forged | `peer` (Caddy replaced it) | `peer` |
//! | a front Caddy that does not trust Cloudflare | `edge` | `CF-Connecting-IP` |
//!
//! The last row is `deploy/Caddyfile.site` on a host Caddy without the
//! Cloudflare ranges: the only entry is the edge, so the request did come
//! through Cloudflare, which overwrites `CF-Connecting-IP`. Nothing at all,
//! or an entry that is not an address before a client was found, gives
//! `None`; the caller then shares one bucket among such requests.

use std::net::IpAddr;
use std::sync::LazyLock;

use axum::http::HeaderMap;

/// `deploy/cloudflare-proxies.txt`, which the server image does not contain
/// (`Dockerfile.server` copies `server/` only). A test holds the two equal.
const CLOUDFLARE_RANGES: &str = "173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22 2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32";

/// A network: its first address and prefix length.
struct Range(IpAddr, u32);

impl Range {
    fn parse(text: &str) -> Option<Self> {
        let (address, prefix) = text.split_once('/')?;
        Some(Self(address.parse().ok()?, prefix.parse().ok()?))
    }

    fn contains(&self, ip: IpAddr) -> bool {
        match (self.0, ip) {
            (IpAddr::V4(network), IpAddr::V4(ip)) => {
                let mask = u32::MAX.checked_shl(32 - self.1).unwrap_or(0);
                u32::from(network) & mask == u32::from(ip) & mask
            }
            (IpAddr::V6(network), IpAddr::V6(ip)) => {
                let mask = u128::MAX.checked_shl(128 - self.1).unwrap_or(0);
                u128::from(network) & mask == u128::from(ip) & mask
            }
            _ => false,
        }
    }
}

static CLOUDFLARE: LazyLock<Vec<Range>> = LazyLock::new(|| {
    CLOUDFLARE_RANGES
        .split_whitespace()
        .filter_map(Range::parse)
        .collect()
});

/// An IPv4-mapped IPv6 address as its IPv4 address.
fn canonical(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map_or(ip, IpAddr::V4),
        IpAddr::V4(_) => ip,
    }
}

fn is_cloudflare(ip: IpAddr) -> bool {
    CLOUDFLARE.iter().any(|range| range.contains(ip))
}

/// The client's address, or `None` when the headers do not say.
pub fn trusted_client(headers: &HeaderMap) -> Option<IpAddr> {
    let values: Vec<&str> = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .collect();
    let joined = values.join(",");
    let mut saw_proxy = false;
    for entry in joined
        .rsplit(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
    {
        let ip = canonical(entry.parse().ok()?);
        if !is_cloudflare(ip) {
            return Some(ip);
        }
        saw_proxy = true;
    }
    if !saw_proxy {
        return None;
    }
    let connecting = headers.get("cf-connecting-ip")?.to_str().ok()?.trim();
    connecting.parse().ok().map(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EDGE: &str = "172.70.1.2";
    const EDGE_V6: &str = "2a06:98c1:3120::3";

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut headers = HeaderMap::new();
        for (name, value) in pairs {
            headers.append(*name, value.parse().unwrap());
        }
        headers
    }

    fn client(pairs: &[(&'static str, &str)]) -> Option<String> {
        trusted_client(&headers(pairs)).map(|ip| ip.to_string())
    }

    #[test]
    fn the_ranges_are_the_ones_caddy_trusts() {
        let file = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../deploy/cloudflare-proxies.txt"
        ))
        .expect("deploy/cloudflare-proxies.txt");
        assert_eq!(
            file.split_whitespace().collect::<Vec<_>>(),
            CLOUDFLARE_RANGES.split_whitespace().collect::<Vec<_>>()
        );
        assert_eq!(CLOUDFLARE.len(), 22);
    }

    #[test]
    fn cloudflare_addresses_are_recognised() {
        for ip in [
            EDGE,
            "173.245.63.255",
            "104.16.0.1",
            EDGE_V6,
            "::ffff:162.158.1.1",
        ] {
            assert!(is_cloudflare(canonical(ip.parse().unwrap())), "{ip}");
        }
        for ip in [
            "173.245.64.0",
            "203.0.113.5",
            "2a06:98c8::1",
            "10.0.0.1",
            "127.0.0.1",
        ] {
            assert!(!is_cloudflare(canonical(ip.parse().unwrap())), "{ip}");
        }
    }

    #[test]
    fn the_chains_cloudflare_and_caddy_produce() {
        // Through Cloudflare: Cloudflare appends the client, Caddy the edge.
        let through = format!("203.0.113.5, {EDGE}");
        assert_eq!(
            client(&[("x-forwarded-for", &through)]).as_deref(),
            Some("203.0.113.5")
        );
        // A forged header in front: Cloudflare keeps it and appends.
        let forged = format!("198.51.100.1, 10.0.0.1, 203.0.113.5, {EDGE}");
        assert_eq!(
            client(&[
                ("x-forwarded-for", &forged),
                ("cf-connecting-ip", "203.0.113.5")
            ])
            .as_deref(),
            Some("203.0.113.5")
        );
        // Garbage a client wrote to the left of its own address is never read.
        let garbage = format!("not an address, 203.0.113.5, {EDGE}");
        assert_eq!(
            client(&[("x-forwarded-for", &garbage)]).as_deref(),
            Some("203.0.113.5")
        );
        // IPv6 client through an IPv6 edge, and the header repeated.
        assert_eq!(
            client(&[
                ("x-forwarded-for", "2001:db8::7"),
                ("x-forwarded-for", EDGE_V6)
            ])
            .as_deref(),
            Some("2001:db8::7")
        );
        // Straight to the origin: Caddy replaced the header with the peer;
        // a forged CF-Connecting-IP is not read.
        assert_eq!(
            client(&[
                ("x-forwarded-for", "198.51.100.9"),
                ("cf-connecting-ip", "1.1.1.1")
            ])
            .as_deref(),
            Some("198.51.100.9")
        );
        // A front Caddy that does not trust Cloudflare: only the edge.
        assert_eq!(
            client(&[
                ("x-forwarded-for", EDGE),
                ("cf-connecting-ip", " 203.0.113.5 ")
            ])
            .as_deref(),
            Some("203.0.113.5")
        );
        assert_eq!(
            client(&[
                ("x-forwarded-for", EDGE),
                ("cf-connecting-ip", "::ffff:203.0.113.6")
            ])
            .as_deref(),
            Some("203.0.113.6")
        );
        assert_eq!(client(&[("x-forwarded-for", EDGE)]), None);
        assert_eq!(
            client(&[("x-forwarded-for", EDGE), ("cf-connecting-ip", "nope")]),
            None
        );
        // Nothing to go on.
        assert_eq!(client(&[]), None);
        assert_eq!(client(&[("cf-connecting-ip", "203.0.113.5")]), None);
        assert_eq!(client(&[("x-forwarded-for", " , ")]), None);
        // An entry that is not an address where the client should be.
        let bad = format!("203.0.113.5, junk, {EDGE}");
        assert_eq!(client(&[("x-forwarded-for", &bad)]), None);
        // A mapped IPv4 address is its IPv4 address.
        assert_eq!(
            client(&[("x-forwarded-for", "::ffff:203.0.113.5")]).as_deref(),
            Some("203.0.113.5")
        );
    }
}
