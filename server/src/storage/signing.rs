//! Signed URLs: `signedObjectUrl` and `verifySignedObject` of
//! `lib/object-storage.ts`.

use std::time::{SystemTime, UNIX_EPOCH};

use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;

use super::{Storage, StorageError, form_encode_key, object_key};

impl Storage {
    /// `<site>/api/media/signed?key=..&exp=..&sig=..`, valid for
    /// `expires_in_secs` seconds from now.
    pub fn signed_object_url(
        &self,
        bucket: &str,
        path: &str,
        expires_in_secs: u64,
    ) -> Result<String, StorageError> {
        self.signed_object_url_at(bucket, path, expires_in_secs, now_ms())
    }

    /// [`Self::signed_object_url`] with the clock as an argument
    /// (`now_ms`: milliseconds since the Unix epoch).
    pub fn signed_object_url_at(
        &self,
        bucket: &str,
        path: &str,
        expires_in_secs: u64,
        now_ms: u64,
    ) -> Result<String, StorageError> {
        let exp = now_ms.saturating_add(expires_in_secs.saturating_mul(1000));
        let key = object_key(bucket, path)?;
        let sig = hex::encode(self.mac(&key, &exp.to_string()).finalize().into_bytes());
        Ok(format!(
            "{}/api/media/signed?key={}&exp={exp}&sig={sig}",
            self.0.site_url,
            form_encode_key(&key)
        ))
    }

    /// Whether `sig` signs `key` until `exp`, and `exp` has not passed. The
    /// arguments are the decoded query values of a signed URL.
    pub fn verify_signed_object(&self, key: &str, exp: &str, sig: &str) -> bool {
        self.verify_signed_object_at(key, exp, sig, now_ms())
    }

    /// [`Self::verify_signed_object`] with the clock as an argument.
    pub fn verify_signed_object_at(&self, key: &str, exp: &str, sig: &str, now_ms: u64) -> bool {
        // The TypeScript reads `exp` with `Number(exp)` and signs the number
        // printed back, so `" 1764000000000 "` and `1.764e12` name the same
        // expiry as `1764000000000`.
        let expires = match js_number(exp) {
            Some(expires) if expires.is_finite() && expires >= now_ms as f64 => expires,
            _ => return false,
        };
        // The TypeScript compares the hex text, so only 64 lowercase hex digits
        // can match. The format check does not depend on the secret; the
        // comparison of the decoded bytes is constant-time.
        let is_lower_hex = |byte: u8| matches!(byte, b'0'..=b'9' | b'a'..=b'f');
        if sig.len() != 64 || !sig.bytes().all(is_lower_hex) {
            return false;
        }
        let Ok(sig) = hex::decode(sig) else {
            return false;
        };
        self.mac(key, &js_number_to_string(expires))
            .verify_slice(&sig)
            .is_ok()
    }

    /// HMAC-SHA256 over `"<key>:<exp>"`.
    fn mac(&self, key: &str, exp: &str) -> Hmac<Sha256> {
        let mut mac = Hmac::<Sha256>::new_from_slice(self.0.signing_secret.expose().as_bytes())
            .expect("HMAC accepts a key of any length");
        mac.update(format!("{key}:{exp}").as_bytes());
        mac
    }
}

fn now_ms() -> u64 {
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    u64::try_from(since_epoch.as_millis()).unwrap_or(u64::MAX)
}

/// JavaScript `Number(text)`. `None` is `NaN`.
fn js_number(text: &str) -> Option<f64> {
    // JavaScript trims U+FEFF and does not trim U+0085; Rust has it the other
    // way round.
    let is_js_whitespace = |c: char| (c.is_whitespace() && c != '\u{85}') || c == '\u{feff}';
    let text = text.trim_matches(is_js_whitespace);
    if text.is_empty() {
        return Some(0.0);
    }
    let radix = match text.get(..2) {
        Some("0x" | "0X") => Some(16),
        Some("0o" | "0O") => Some(8),
        Some("0b" | "0B") => Some(2),
        _ => None,
    };
    if let Some(radix) = radix {
        let digits = &text[2..];
        // `from_str_radix` alone would also take a leading `+`.
        if digits.is_empty() || !digits.chars().all(|c| c.is_digit(radix)) {
            return None;
        }
        // A literal above 2^128 is a number in JavaScript and NaN here. As a
        // millisecond timestamp, 2^128 is not a date.
        return u128::from_str_radix(digits, radix)
            .ok()
            .map(|value| value as f64);
    }
    // Rust and JavaScript read the same decimal literals. They spell infinity
    // and NaN differently, and the caller rejects both.
    text.parse().ok()
}

/// JavaScript `String(value)` for a finite value that is at least the current
/// time in milliseconds. (Below 1e-6 JavaScript switches to exponent notation
/// and this does not.)
fn js_number_to_string(value: f64) -> String {
    if value >= 1e21 {
        format!("{value:e}").replace('e', "e+")
    } else {
        format!("{value}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_number_reads_what_number_reads() {
        for (text, expected) in [
            ("1764000000000", Some(1764000000000.0)),
            (" \t1764000000000\n", Some(1764000000000.0)),
            ("\u{feff}12\u{a0}", Some(12.0)),
            ("1.764e12", Some(1764000000000.0)),
            ("+.5", Some(0.5)),
            ("5.", Some(5.0)),
            ("", Some(0.0)),
            ("   ", Some(0.0)),
            ("0x1F", Some(31.0)),
            ("0o17", Some(15.0)),
            ("0B11", Some(3.0)),
            ("0x", None),
            ("0x+1F", None),
            ("-0x1F", None),
            ("12abc", None),
            ("1_000", None),
            ("\u{85}12", None),
            (".", None),
            ("e5", None),
        ] {
            assert_eq!(js_number(text), expected, "{text:?}");
        }
        // Spelled differently in the two languages; never finite in either.
        for text in ["Infinity", "-Infinity", "inf", "nan", "NaN", "1e400"] {
            assert!(!js_number(text).is_some_and(f64::is_finite), "{text:?}");
        }
    }

    #[test]
    fn js_number_to_string_prints_what_string_prints() {
        for (value, expected) in [
            (1764000000000.0, "1764000000000"),
            (1764000000000.5, "1764000000000.5"),
            (12345678901234567890.0, "12345678901234567000"),
            (1e21, "1e+21"),
            (1.5e21, "1.5e+21"),
            (1.2345e300, "1.2345e+300"),
        ] {
            assert_eq!(js_number_to_string(value), expected);
        }
    }
}
