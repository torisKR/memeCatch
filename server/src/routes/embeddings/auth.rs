//! `verifyEmbeddingAuth` of lib/meme-embedding-auth.server.ts: the caller
//! signs one exact input with `CRON_SECRET` (untrimmed, refused when blank):
//! `x-memecatch-embedding-time` is a millisecond timestamp within 30 seconds
//! of now, `x-memecatch-embedding-signature` the hex HMAC-SHA256 of
//! `JSON.stringify([timestamp, "multilingual-e5-small-v1", input])`.

use axum::http::{HeaderMap, HeaderName};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

use super::PROFILE;
use crate::embedder::tokenizer::is_js_space;
use crate::routes::request::header_text;

const TIME_HEADER: HeaderName = HeaderName::from_static("x-memecatch-embedding-time");
const SIGNATURE_HEADER: HeaderName = HeaderName::from_static("x-memecatch-embedding-signature");
const CLOCK_TOLERANCE_MS: i64 = 30_000;
const MAX_SAFE_INTEGER: i64 = (1 << 53) - 1;

pub fn verify(headers: &HeaderMap, input: &str, secret: Option<&str>, now_ms: i64) -> bool {
    let secret = secret.filter(|secret| !secret.trim_matches(is_js_space).is_empty());
    let (Some(secret), Some(time), Some(signature)) = (
        secret,
        header_text(headers, &TIME_HEADER, ", "),
        header_text(headers, &SIGNATURE_HEADER, ", "),
    ) else {
        return false;
    };
    if !is_timestamp(&time) || !is_hex_signature(&signature) {
        return false;
    }
    // At most 16 digits: it parses, but may be beyond 2^53.
    let Ok(timestamp) = time.parse::<i64>() else {
        return false;
    };
    if timestamp > MAX_SAFE_INTEGER || (now_ms - timestamp).abs() > CLOCK_TOLERANCE_MS {
        return false;
    }
    let given = hex::decode(&signature).expect("checked to be hex");
    given.ct_eq(&sign(secret, timestamp, input)).into()
}

/// `createHmac("sha256", secret).update(JSON.stringify([timestamp, profile,
/// input]), "utf8")`. `serde_json` escapes a string as `JSON.stringify` does
/// for any text a Rust string can hold.
fn sign(secret: &str, timestamp: i64, input: &str) -> Vec<u8> {
    let input = serde_json::to_string(input).expect("a string serializes");
    let message = format!("[{timestamp},\"{PROFILE}\",{input}]");
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("any key length");
    mac.update(message.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

/// `/^(0|[1-9]\d{0,15})$/`.
fn is_timestamp(text: &str) -> bool {
    let bytes = text.as_bytes();
    text == "0"
        || (matches!(bytes.first(), Some(b'1'..=b'9'))
            && bytes.len() <= 16
            && bytes.iter().all(u8::is_ascii_digit))
}

/// `/^[a-f0-9]{64}$/`.
fn is_hex_signature(text: &str) -> bool {
    text.len() == 64
        && text
            .bytes()
            .all(|byte| matches!(byte, b'a'..=b'f' | b'0'..=b'9'))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "embedding-test-secret";
    const NOW: i64 = 1_790_000_000_000;

    fn signed(time: i64, input: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(TIME_HEADER, time.to_string().parse().expect("header"));
        let signature = hex::encode(sign(SECRET, time, input));
        headers.insert(SIGNATURE_HEADER, signature.parse().expect("header"));
        headers
    }

    #[test]
    fn a_fresh_signature_of_the_same_input_passes() {
        let headers = signed(NOW - 30_000, "query: 무야호");
        assert!(verify(&headers, "query: 무야호", Some(SECRET), NOW));
        assert!(!verify(&headers, "query: 무야호!", Some(SECRET), NOW));
        assert!(!verify(&headers, "query: 무야호", Some("other"), NOW));
        assert!(!verify(&headers, "query: 무야호", Some("  "), NOW));
        assert!(!verify(&headers, "query: 무야호", None, NOW));
        assert!(!verify(&signed(NOW - 30_001, "q"), "q", Some(SECRET), NOW));
    }

    // The value createEmbeddingAuthHeaders gives for these arguments
    // (node: createHmac over JSON.stringify([1790000000000,
    // "multilingual-e5-small-v1", "query: \"따옴표\"\n"])).
    #[test]
    fn the_message_is_the_json_text_of_the_triple() {
        let input = "query: \"따옴표\"\n";
        let message = format!(
            "[{NOW},\"{PROFILE}\",{}]",
            serde_json::to_string(input).expect("json")
        );
        assert_eq!(
            message,
            "[1790000000000,\"multilingual-e5-small-v1\",\"query: \\\"따옴표\\\"\\n\"]"
        );
    }

    #[test]
    fn malformed_headers_fail() {
        assert!(is_timestamp("0") && is_timestamp("1234567890123456"));
        assert!(!is_timestamp("01") && !is_timestamp("12345678901234567") && !is_timestamp(""));
        assert!(!is_hex_signature(&"A".repeat(64)) && is_hex_signature(&"a".repeat(64)));
        let mut headers = signed(NOW, "q");
        headers.append(TIME_HEADER, NOW.to_string().parse().expect("header"));
        // A repeated header reads as "t, t", which is not a timestamp.
        assert!(!verify(&headers, "q", Some(SECRET), NOW));
    }
}
