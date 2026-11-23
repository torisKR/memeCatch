//! The anonymous visitor identity of `lib/growth/events.server.ts`: the
//! signed `mc_growth_session` cookie, and the keyed hashes that stand in for
//! a visitor or a network in the database. Every key derives from
//! `MEMECATCH_SIGNING_SECRET`, so a cookie either server issued is accepted
//! by the other.

use axum::http::HeaderMap;
use axum::http::header::{COOKIE, HeaderName};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

use crate::routes::public::js;
use crate::routes::request;

const COOKIE_NAME: &str = "mc_growth_session";
const SIGNING_CONTEXT: &str = "memecatch:growth-session-signing:v1";
const NETWORK_HASH_CONTEXT: &str = "memecatch:growth-network-hash:v1";
const COOKIE_MAX_AGE_SECONDS: u32 = 30 * 24 * 60 * 60;
const MAC_LENGTH: usize = 32;

/// `GrowthSession`: the session id of a request and, when the request
/// carried no valid cookie, the `Set-Cookie` value that starts one.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GrowthSession {
    pub session_id: String,
    pub set_cookie: Option<String>,
}

/// The signing secret and the cookie key derived from it.
#[derive(Clone)]
pub struct GrowthKeys {
    secret: Vec<u8>,
    /// `signingKey()`: HMAC of the signing context under the secret.
    cookie_key: [u8; MAC_LENGTH],
}

impl GrowthKeys {
    /// `secret` is `signingSecret()`: trimmed and not empty.
    pub fn new(secret: &str) -> Self {
        Self {
            cookie_key: hmac_sha256(secret.as_bytes(), SIGNING_CONTEXT.as_bytes()),
            secret: secret.as_bytes().to_vec(),
        }
    }

    /// `createHmac("sha256", secret).update(message).digest("hex")`.
    pub fn keyed_hash(&self, message: &[u8]) -> String {
        hex::encode(hmac_sha256(&self.secret, message))
    }

    /// `growthNetworkHash`: what the database keeps instead of an address.
    pub fn network_hash(&self, address: &str) -> String {
        self.keyed_hash(format!("{NETWORK_HASH_CONTEXT}:{address}").as_bytes())
    }

    /// `growthSessionIdFromRequest`: the session id of a valid cookie.
    pub fn session_id(&self, headers: &HeaderMap) -> Option<String> {
        self.verified_session_id(&cookie_value(headers)?)
    }

    /// `resolveGrowthSession`: the cookie's session, or a new one to set.
    /// `secure` is whether Next would see the request as HTTPS.
    pub fn resolve_session(&self, headers: &HeaderMap, secure: bool) -> GrowthSession {
        if let Some(session_id) = self.session_id(headers) {
            return GrowthSession {
                session_id,
                set_cookie: None,
            };
        }
        let session_id = random_uuid();
        let token = format!(
            "{session_id}.{}",
            URL_SAFE_NO_PAD.encode(self.signature(&session_id))
        );
        let secure = if secure { "; Secure" } else { "" };
        GrowthSession {
            set_cookie: Some(format!(
                "{COOKIE_NAME}={token}; Path=/; Max-Age={COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax{secure}"
            )),
            session_id,
        }
    }

    fn signature(&self, session_id: &str) -> [u8; MAC_LENGTH] {
        hmac_sha256(&self.cookie_key, format!("v1:{session_id}").as_bytes())
    }

    /// `verifiedSessionId`: `<uuid>.<mac>`, where a third part must be empty
    /// and later parts are not looked at (`const [id, mac, extra] = split`).
    fn verified_session_id(&self, value: &str) -> Option<String> {
        let mut parts = value.split('.');
        let session_id = parts.next().filter(|part| !part.is_empty())?;
        let encoded_mac = parts.next().filter(|part| !part.is_empty())?;
        if parts.next().is_some_and(|extra| !extra.is_empty()) || !is_uuid(session_id) {
            return None;
        }
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.cookie_key).ok()?;
        mac.update(format!("v1:{session_id}").as_bytes());
        // Constant-time, and false for any length but 32, as in the
        // TypeScript (`timingSafeEqual` after a length check).
        mac.verify_slice(&node_base64_decode(encoded_mac)).ok()?;
        Some(session_id.to_owned())
    }
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; MAC_LENGTH] {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC takes a key of any length");
    mac.update(message);
    mac.finalize().into_bytes().into()
}

/// `cookieValue`: the first cookie named `mc_growth_session`, percent-decoded.
/// `None` when it is missing, empty, or not valid percent-encoding.
fn cookie_value(headers: &HeaderMap) -> Option<String> {
    let cookies = request::header_text(headers, &COOKIE, "; ")?;
    let prefix = format!("{COOKIE_NAME}=");
    let raw = cookies
        .split(';')
        .map(js::trim)
        .find_map(|part| part.strip_prefix(prefix.as_str()))
        .filter(|raw| !raw.is_empty())?;
    request::decode_uri_component(raw)
}

/// Whether Next reads the request as HTTPS: `new URL(request.url).protocol`,
/// which Next takes from `X-Forwarded-Proto` (`includes('https')` on the
/// header text) and not from the connection.
pub fn is_https(headers: &HeaderMap) -> bool {
    let name = HeaderName::from_static("x-forwarded-proto");
    request::header_text(headers, &name, ", ").is_some_and(|proto| proto.contains("https"))
}

/// The UUID pattern of the TypeScript (`UUID_RE`): versions 1 to 8, the RFC
/// variant, either case.
pub fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => *byte == b'-',
            14 => matches!(byte, b'1'..=b'8'),
            19 => matches!(byte.to_ascii_lowercase(), b'8' | b'9' | b'a' | b'b'),
            _ => byte.is_ascii_hexdigit(),
        })
}

/// `randomUUID()`: a version 4 UUID in lowercase.
pub(crate) fn random_uuid() -> String {
    let mut bytes: [u8; 16] = rand::random();
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex = hex::encode(bytes);
    format!(
        "{}-{}-{}-{}-{}",
        &hex[..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..]
    )
}

/// `Buffer.from(text, "base64url")`. Node's decoder is lenient, and a cookie
/// that Next accepts must be accepted here: each UTF-16 unit counts by its
/// low byte, decoding stops at the first `=`, characters outside both base64
/// alphabets are skipped, and a last group of one character is dropped.
/// (Observed on Node 26; the production image runs Node 22.)
fn node_base64_decode(text: &str) -> Vec<u8> {
    let sextets: Vec<u8> = text
        .encode_utf16()
        .map(|unit| unit as u8)
        .take_while(|byte| *byte != b'=')
        .filter_map(|byte| match byte {
            b'A'..=b'Z' => Some(byte - b'A'),
            b'a'..=b'z' => Some(byte - b'a' + 26),
            b'0'..=b'9' => Some(byte - b'0' + 52),
            b'+' | b'-' => Some(62),
            b'/' | b'_' => Some(63),
            _ => None,
        })
        .collect();
    let mut decoded = Vec::with_capacity(sextets.len() * 3 / 4);
    for group in sextets.chunks(4) {
        let bits = group
            .iter()
            .fold(0_u32, |bits, sextet| (bits << 6) | u32::from(*sextet))
            << (6 * (4 - group.len()));
        let bytes = [(bits >> 16) as u8, (bits >> 8) as u8, bits as u8];
        decoded.extend_from_slice(&bytes[..group.len().saturating_sub(1)]);
    }
    decoded
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    // Issued by the real Next server (lib/growth/events.server.ts) running
    // with this throwaway secret, for a request that carried no cookie.
    const SECRET: &str = "r2-parity-throwaway-signing-secret";
    const SESSION_ID: &str = "d5e11666-1ae9-4084-96f6-4c37f5e577b5";
    const TOKEN: &str =
        "d5e11666-1ae9-4084-96f6-4c37f5e577b5.CwUtrPGd70j_TVLcq0dV0pVDbwkLLH-b3-j2TVxIrq8";

    fn keys() -> GrowthKeys {
        GrowthKeys::new(SECRET)
    }

    fn cookie(value: &[u8]) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, HeaderValue::from_bytes(value).unwrap());
        headers
    }

    fn session_of(cookie_header: &str) -> Option<String> {
        keys().session_id(&cookie(cookie_header.as_bytes()))
    }

    #[test]
    fn a_cookie_next_issued_is_accepted() {
        assert_eq!(
            session_of(&format!("mc_growth_session={TOKEN}")).as_deref(),
            Some(SESSION_ID)
        );
        assert_eq!(
            session_of(&format!("theme=dark;  mc_growth_session={TOKEN} ; x=1")).as_deref(),
            Some(SESSION_ID)
        );
        // Percent-encoded, as a client may store it.
        assert_eq!(
            session_of(&format!(
                "mc_growth_session={}",
                TOKEN.replace('.', "%2E").replace('-', "%2D")
            ))
            .as_deref(),
            Some(SESSION_ID)
        );
        // Two Cookie headers read as one list.
        let mut split = cookie(b"a=1");
        split.append(
            COOKIE,
            HeaderValue::from_str(&format!("mc_growth_session={TOKEN}")).unwrap(),
        );
        assert_eq!(keys().session_id(&split).as_deref(), Some(SESSION_ID));
    }

    #[test]
    fn a_forged_or_malformed_cookie_is_not_a_session() {
        let (id, mac) = TOKEN.split_once('.').unwrap();
        let other_id = id.replace("d5e1", "d5e2");
        let other_mac = mac.replace("CwUt", "CwUu");

        for value in [
            format!("{other_id}.{mac}"),
            format!("{id}.{other_mac}"),
            format!("{}.{mac}", id.to_uppercase()),
            format!("{id}."),
            format!(".{mac}"),
            format!("{id}.{mac}.x"),
            format!("{id}.{}", &mac[..42]),
            format!("{id}.{mac}A"),
            id.to_owned(),
            mac.to_owned(),
            "%zz".to_owned(),
            String::new(),
        ] {
            assert_eq!(
                session_of(&format!("mc_growth_session={value}")),
                None,
                "{value}"
            );
        }
        assert_eq!(session_of("other=1"), None);
        assert_eq!(keys().session_id(&HeaderMap::new()), None);
        // The first cookie of that name is the one read.
        assert_eq!(
            session_of(&format!("mc_growth_session=x; mc_growth_session={TOKEN}")),
            None
        );
        // Signed with another secret.
        let other = GrowthKeys::new("another-secret");
        assert_eq!(
            other.session_id(&cookie(format!("mc_growth_session={TOKEN}").as_bytes())),
            None
        );
    }

    // Each of these is accepted by verifiedSessionId under Node.
    #[test]
    fn the_spellings_of_a_valid_mac_that_node_accepts_are_accepted() {
        let (id, mac) = TOKEN.split_once('.').unwrap();
        let standard = mac.replace('-', "+").replace('_', "/");

        for value in [
            format!("{id}.{mac}="),
            format!("{id}.{mac}=="),
            format!("{id}.{standard}="),
            format!("{id}.{mac}=ignored"),
            format!("{id}.{}%20{}", &mac[..10], &mac[10..]),
            format!("{id}.{}${}", &mac[..10], &mac[10..]),
            // An empty third part, and anything after it.
            format!("{id}.{mac}."),
            format!("{id}.{mac}..x"),
        ] {
            assert_eq!(
                session_of(&format!("mc_growth_session={value}")).as_deref(),
                Some(id),
                "{value}"
            );
        }
    }

    // Expected bytes are what Buffer.from(text, "base64url") gives under Node.
    #[test]
    fn base64_decoding_follows_node() {
        assert_eq!(node_base64_decode("AwoRGB8m"), [3, 10, 17, 24, 31, 38]);
        assert_eq!(node_base64_decode("Awo"), [3, 10]);
        assert_eq!(node_base64_decode("Aw"), [3]);
        assert_eq!(node_base64_decode("A"), Vec::<u8>::new());
        assert_eq!(node_base64_decode("AwoR=GB8m"), [3, 10, 17]);
        assert_eq!(node_base64_decode(" A w\no$R"), [3, 10, 17]);
        assert_eq!(node_base64_decode("-_+/"), [0xfb, 0xff, 0xbf]);
        // U+0141 counts as its low byte, `A`.
        assert_eq!(node_base64_decode("\u{141}woR"), [3, 10, 17]);
    }

    #[test]
    fn a_request_without_a_valid_cookie_starts_a_session_the_cookie_proves() {
        let keys = keys();

        let plain = keys.resolve_session(&HeaderMap::new(), false);
        let secure = keys.resolve_session(&cookie(b"mc_growth_session=forged.x"), true);
        let existing = keys.resolve_session(
            &cookie(format!("mc_growth_session={TOKEN}").as_bytes()),
            true,
        );

        let set_cookie = plain.set_cookie.expect("a new session sets a cookie");
        let token = set_cookie
            .strip_prefix("mc_growth_session=")
            .and_then(|rest| rest.strip_suffix("; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax"))
            .expect("the attributes of the TypeScript cookie");
        assert!(is_uuid(&plain.session_id));
        assert_eq!(plain.session_id.as_bytes()[14], b'4');
        assert_eq!(plain.session_id, plain.session_id.to_lowercase());
        // The cookie it sets is one it accepts.
        assert_eq!(
            session_of(&format!("mc_growth_session={token}")),
            Some(plain.session_id)
        );
        assert!(
            secure
                .set_cookie
                .expect("a forged cookie is replaced")
                .ends_with("; HttpOnly; SameSite=Lax; Secure")
        );
        assert_eq!(
            existing,
            GrowthSession {
                session_id: SESSION_ID.to_owned(),
                set_cookie: None
            }
        );
    }

    #[test]
    fn https_is_read_from_x_forwarded_proto_alone() {
        let proto = |values: &[&'static str]| {
            let mut headers = HeaderMap::new();
            for value in values {
                headers.append("x-forwarded-proto", HeaderValue::from_static(value));
            }
            is_https(&headers)
        };

        assert!(proto(&["https"]));
        assert!(proto(&["http", "https"]));
        assert!(proto(&["http,https"]));
        assert!(!proto(&["http"]));
        assert!(!proto(&["HTTPS"]));
        assert!(!proto(&[""]));
        assert!(!proto(&[]));
    }

    #[test]
    fn uuid_pattern_is_the_one_of_the_typescript() {
        for valid in [
            "d5e11666-1ae9-4084-96f6-4c37f5e577b5",
            "D5E11666-1AE9-1084-B6F6-4C37F5E577B5",
            "00000000-0000-8000-a000-000000000000",
        ] {
            assert!(is_uuid(valid), "{valid}");
        }
        for invalid in [
            "",
            "d5e11666-1ae9-0084-96f6-4c37f5e577b5",
            "d5e11666-1ae9-9084-96f6-4c37f5e577b5",
            "d5e11666-1ae9-4084-76f6-4c37f5e577b5",
            "d5e11666-1ae9-4084-c6f6-4c37f5e577b5",
            "d5e116661ae9-4084-96f6-4c37f5e577b5",
            "d5e11666-1ae9-4084-96f6-4c37f5e577b",
            "d5e11666-1ae9-4084-96f6-4c37f5e577b5 ",
            "g5e11666-1ae9-4084-96f6-4c37f5e577b5",
            "{d5e11666-1ae9-4084-96f6-4c37f5e577b5}",
        ] {
            assert!(!is_uuid(invalid), "{invalid}");
        }
    }
}
