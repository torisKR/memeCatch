//! The email verification token: not a `verification` row but a JWT
//! (`createEmailVerificationToken`, dist/api/routes/email-verification.mjs:14-20;
//! `signJWT`, dist/crypto/jwt.mjs:5-7): HS256 over the secret's bytes, the
//! header `{"alg":"HS256"}`, the payload `{email, userId, iat, exp}` in that
//! order, valid for an hour (`emailVerification.expiresIn` default 3600 s).
//! It can be used again until it expires; a second use finds the address
//! already verified.
//!
//! `verify` follows `jwtVerify(token, secret, { algorithms: ["HS256"] })`
//! (jose) for the tokens this app makes. A token that is well formed and
//! correctly signed but not of that shape (another header, other claims) is
//! `Unusual`, an invalid token here.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use serde_json::Value;
use sha2::Sha256;

pub const EXPIRES_IN_SECS: i64 = 3600;
const HEADER: &str = r#"{"alg":"HS256"}"#;

/// `createEmailVerificationToken(secret, email, undefined, 3600, { userId })`.
pub fn sign(secret: &str, email: &str, user_id: &str, now_secs: i64) -> String {
    let text = |value: &str| Value::from(value).to_string();
    let payload = format!(
        r#"{{"email":{},"userId":{},"iat":{now_secs},"exp":{}}}"#,
        text(&email.to_lowercase()),
        text(user_id),
        now_secs + EXPIRES_IN_SECS
    );
    let signing_input = format!(
        "{}.{}",
        URL_SAFE_NO_PAD.encode(HEADER),
        URL_SAFE_NO_PAD.encode(payload)
    );
    let signature = URL_SAFE_NO_PAD.encode(mac(secret, &signing_input));
    format!("{signing_input}.{signature}")
}

/// The claims `verifyEmail` reads.
#[derive(Debug, PartialEq, Eq)]
pub struct Claims {
    pub email: String,
    pub user_id: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Rejected {
    /// `JWTExpired`: `TOKEN_EXPIRED`.
    Expired,
    /// Any other jose error: `INVALID_TOKEN`.
    Invalid,
    /// Not a token of this app's shape.
    Unusual,
}

pub fn verify(token: &str, secret: &str, now_secs: i64) -> Result<Claims, Rejected> {
    let mut parts = token.split('.');
    let (Some(header), Some(payload), Some(signature), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(Rejected::Invalid);
    };
    // jose's decoder is not this one; anything it might read differently
    // is `Unusual`.
    let decode = |segment: &str| {
        URL_SAFE_NO_PAD
            .decode(segment)
            .map_err(|_| Rejected::Unusual)
    };
    let header_bytes = decode(header)?;
    if header_bytes != HEADER.as_bytes() {
        return Err(Rejected::Unusual);
    }
    let signature = decode(signature)?;
    let expected = mac(secret, &format!("{header}.{payload}"));
    if !bool::from(subtle::ConstantTimeEq::ct_eq(&expected[..], &signature[..])) {
        return Err(Rejected::Invalid);
    }
    let claims: serde_json::Map<String, Value> =
        serde_json::from_slice(&decode(payload)?).map_err(|_| Rejected::Unusual)?;
    claims_of(&claims, now_secs)
}

/// jose's claim checks for these claims, then `verifyEmail`'s schema
/// (`email` an address; no `updateTo` or `requestType`, which only the
/// change-email flow makes).
fn claims_of(claims: &serde_json::Map<String, Value>, now_secs: i64) -> Result<Claims, Rejected> {
    const KNOWN: [&str; 4] = ["email", "userId", "iat", "exp"];
    if claims.keys().any(|key| !KNOWN.contains(&key.as_str())) {
        return Err(Rejected::Unusual);
    }
    let (Some(Value::Number(exp)), Some(Value::Number(_))) = (claims.get("exp"), claims.get("iat"))
    else {
        return Err(Rejected::Unusual);
    };
    let exp = exp.as_i64().ok_or(Rejected::Unusual)?;
    if exp <= now_secs {
        return Err(Rejected::Expired);
    }
    let Some(Value::String(email)) = claims.get("email") else {
        return Err(Rejected::Unusual);
    };
    if !super::forms::is_email(email) {
        return Err(Rejected::Unusual);
    }
    let user_id = match claims.get("userId") {
        None => None,
        Some(Value::String(id)) => Some(id.clone()),
        Some(_) => return Err(Rejected::Unusual),
    };
    Ok(Claims {
        email: email.clone(),
        user_id,
    })
}

fn mac(secret: &str, input: &str) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("any key length");
    mac.update(input.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The throwaway secret of the test servers.
    const SECRET: &str = "a1fix-throwaway-secret-0123456789abcdef";
    /// The token the app's better-auth mailed on a sign-up with that secret
    /// (the verification URL sent to the webhook), at iat 1795470639.
    const BETTER_AUTH_TOKEN: &str = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InByb2JlMUBleGFtcGxlLmNvbSIsInVzZXJJZCI6IjRmM2JlYTVlLWI1NWQtNGJjMi1iNDZhLWI3ZmVkYTZhYzUwMiIsImlhdCI6MTc5NTQ3MDYzOSwiZXhwIjoxNzk1NDc0MjM5fQ.UwzmkTr0oix1A0r5RVsUrPqzNsQ_1unhyYeloW6_Llc";
    const IAT: i64 = 1_795_470_639;
    const USER: &str = "4f3bea5e-b55d-4bc2-b46a-b7feda6ac502";

    #[test]
    fn signs_byte_for_byte_as_better_auth_does() {
        assert_eq!(
            sign(SECRET, "Probe1@Example.com", USER, IAT),
            BETTER_AUTH_TOKEN
        );
    }

    #[test]
    fn verifies_like_jose_up_to_the_second_it_expires() {
        let claims = Claims {
            email: "probe1@example.com".into(),
            user_id: Some(USER.into()),
        };
        assert_eq!(verify(BETTER_AUTH_TOKEN, SECRET, IAT), Ok(claims));
        assert!(verify(BETTER_AUTH_TOKEN, SECRET, IAT + 3599).is_ok());
        assert_eq!(
            verify(BETTER_AUTH_TOKEN, SECRET, IAT + 3600),
            Err(Rejected::Expired)
        );
        assert_eq!(
            verify(BETTER_AUTH_TOKEN, "other", IAT),
            Err(Rejected::Invalid)
        );
        assert_eq!(verify("abc", SECRET, IAT), Err(Rejected::Invalid));
        let tampered = BETTER_AUTH_TOKEN.replace(".Uwzm", ".Vwzm");
        assert_eq!(verify(&tampered, SECRET, IAT), Err(Rejected::Invalid));
        assert_eq!(verify("e30.e30.e30", SECRET, IAT), Err(Rejected::Unusual));
    }
}
