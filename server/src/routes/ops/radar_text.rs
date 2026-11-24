//! The text and time helpers of `lib/trend/radar.ts` that decide what the
//! radar connectors ask the providers and whether a collected signal is
//! valid: `normalizeRadarText`, `normalizeRadarHashtag`, the `seeds` of
//! `radar-platform-connectors.server.ts`, and `normalizeRadarTimestamp`.
//!
//! The URL pattern `/\b(?:https?:\/\/|www\.)[^\s<>()]+/giu` runs after NFKC
//! in both callers, which maps the two non-ASCII letters `/iu` folds into
//! `\w` (U+017F, U+212A) to ASCII, so its `\b` is the ASCII word boundary.

use serde_json::Value;
use sha2::{Digest, Sha256};
use unicode_normalization::UnicodeNormalization;

use crate::routes::public::js;
use crate::routes::public::js_date::days_from_civil;

const MS_PER_DAY: i64 = 86_400_000;
/// The largest time value a JavaScript `Date` holds.
const MAX_TIME_MS: f64 = 8.64e15;

fn is_ascii_word(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

/// The length in chars of a URL-pattern match starting at `rest[0]`.
fn url_at(rest: &[char]) -> Option<usize> {
    let starts = |prefix: &str| {
        let prefix: Vec<char> = prefix.chars().collect();
        rest.len() >= prefix.len()
            && rest
                .iter()
                .zip(&prefix)
                .all(|(c, p)| c.eq_ignore_ascii_case(p))
    };
    let prefix = ["https://", "http://", "www."]
        .into_iter()
        .find(|prefix| starts(prefix))?
        .len();
    let tail = rest[prefix..]
        .iter()
        .take_while(|c| !js::is_space(**c) && !matches!(c, '<' | '>' | '(' | ')'))
        .count();
    (tail > 0).then_some(prefix + tail)
}

/// `text.replace(URL_PATTERN, " ")`.
fn strip_urls(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut index = 0;
    while index < chars.len() {
        let boundary = index == 0 || !is_ascii_word(chars[index - 1]);
        if boundary && let Some(len) = url_at(&chars[index..]) {
            out.push(' ');
            index += len;
            continue;
        }
        out.push(chars[index]);
        index += 1;
    }
    out
}

/// `normalizeRadarText`.
pub fn normalize_text(value: &str) -> String {
    let nfkc: String = value.nfkc().collect();
    js::trim(&js::collapse_spaces(&strip_urls(&nfkc).to_lowercase())).to_owned()
}

/// `normalizeRadarHashtag`, with the leading `#`s taken after the leading
/// space (D2-12): the TypeScript's `/^#+/` ran first, so `" #짤"` (a seed
/// after `", "`) kept its `#` (PLAN.md R8-3).
pub fn normalize_hashtag(value: &str) -> String {
    normalize_text(js::trim(value).trim_start_matches('#'))
        .chars()
        .filter(|c| !js::is_space(*c))
        .collect()
}

/// `seeds(name, limit)`: the comma-separated list, each entry normalized as a
/// hashtag, blanks dropped, the first of equal entries kept.
pub fn seeds(raw: Option<&str>, limit: usize) -> Vec<String> {
    let mut seen = Vec::new();
    for seed in raw.unwrap_or_default().split(',').map(normalize_hashtag) {
        if !seed.is_empty() && !seen.contains(&seed) {
            seen.push(seed);
        }
    }
    seen.truncate(limit);
    seen
}

/// The hex SHA-256 of `normalizeRadarText(text)`.
pub fn text_hash(text: &str) -> String {
    hex::encode(Sha256::digest(normalize_text(text).as_bytes()))
}

/// `extractRadarHashtags` for a string. ponytail: `\p{L}\p{N}` is read as
/// Rust's alphanumeric. It only feeds the signal insert, which the schema
/// always refuses (`radar::persist_signals`).
pub fn hashtags(value: &str) -> Vec<String> {
    let nfkc: String = value.nfkc().collect();
    let text: Vec<char> = strip_urls(&nfkc).chars().collect();
    let mut found = Vec::new();
    for (index, c) in text.iter().enumerate() {
        if *c != '#' || (index > 0 && !js::is_space(text[index - 1])) {
            continue;
        }
        let tag: String = text[index + 1..]
            .iter()
            .take_while(|c| c.is_alphanumeric() || **c == '_')
            .collect();
        let tag = normalize_hashtag(&tag);
        if !tag.is_empty() && !found.contains(&tag) {
            found.push(tag);
        }
    }
    found
}

/// `normalizeRadarTimestamp(value)` for a value read from a provider's JSON:
/// `Ok(None)` is its `null` (not a valid time), `Err` the message of its
/// `TypeError` for a value that is neither a string nor a number.
pub fn timestamp(value: &Value) -> Result<Option<String>, String> {
    match value {
        Value::String(text) => Ok(parse_text(js::trim(text)).and_then(iso_string)),
        Value::Number(number) => Ok(number.as_f64().and_then(iso_string)),
        Value::Null => Err("Cannot read properties of null (reading 'trim')".to_owned()),
        // The bundled name of `value` (radar_connectors.rs).
        _ => Err("a.trim is not a function".to_owned()),
    }
}

/// The string branch: `Date.parse` of the text, with `Z` added to a text
/// that has a `T` and no zone.
fn parse_text(trimmed: &str) -> Option<f64> {
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.contains('T') && !ends_with_offset(trimmed.as_bytes()) {
        return parse_ms(&format!("{trimmed}Z"));
    }
    parse_ms(trimmed)
}

/// `/(?:Z|[+-]\d{2}:?\d{2})$/i`.
fn ends_with_offset(bytes: &[u8]) -> bool {
    let digits = |slice: &[u8]| slice.iter().all(u8::is_ascii_digit);
    let sign_at = |at: usize| matches!(bytes.get(at), Some(b'+' | b'-'));
    let n = bytes.len();
    let compact = n >= 5 && digits(&bytes[n - 4..]) && sign_at(n - 5);
    let colon = n >= 6
        && digits(&bytes[n - 2..])
        && bytes[n - 3] == b':'
        && digits(&bytes[n - 5..n - 3])
        && sign_at(n - 6);
    matches!(bytes.last(), Some(b'Z' | b'z')) || compact || colon
}

/// `Date.parse` for the shapes V8 accepts that a provider sends: an ISO date
/// (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or a six-digit signed year), optionally
/// with a time after `T`, `t` or a space (`HH:mm`, `:ss`, a fraction of any
/// length of which V8 keeps three digits) and a zone (`Z`, `z`, `±HH:mm`,
/// `±HHmm`). V8 rolls a day past the month's end into the next month and
/// reads `24:00` as the next midnight; so does this. Other text is `None`,
/// where V8's legacy parser accepts more (PLAN.md section 15). A time without
/// a zone is local time to V8; this reads it as UTC, the zone of the image.
fn parse_ms(text: &str) -> Option<f64> {
    let mut cursor = Cursor(text.as_bytes());
    let year = cursor.year()?;
    let (mut month, mut day) = (1, 1);
    if cursor.eat(b'-') {
        month = cursor.number(2)?;
        if cursor.eat(b'-') {
            day = cursor.number(2)?;
        }
    }
    let (mut hour, mut minute, mut second, mut millis, mut offset) = (0, 0, 0, 0, 0);
    if matches!(cursor.peek(), Some(b'T' | b't' | b' ')) {
        cursor.0 = &cursor.0[1..];
        hour = cursor.number(2)?;
        if !cursor.eat(b':') {
            return None;
        }
        minute = cursor.number(2)?;
        if cursor.eat(b':') {
            second = cursor.number(2)?;
            if cursor.eat(b'.') {
                millis = cursor.fraction_millis()?;
            }
        }
        offset = cursor.zone()?;
    }
    let time_ok = (hour < 24 && minute < 60 && second < 60)
        || (hour == 24 && minute == 0 && second == 0 && millis == 0);
    let date_ok = (1..=12).contains(&month) && (1..=31).contains(&day);
    if !cursor.0.is_empty() || !date_ok || !time_ok {
        return None;
    }
    let ms = days_from_civil(year, month, day) * MS_PER_DAY
        + ((hour * 60 + minute - offset) * 60 + second) * 1_000
        + millis;
    let ms = ms as f64;
    (ms.abs() <= MAX_TIME_MS).then_some(ms)
}

struct Cursor<'a>(&'a [u8]);

impl Cursor<'_> {
    fn peek(&self) -> Option<u8> {
        self.0.first().copied()
    }

    fn eat(&mut self, byte: u8) -> bool {
        let found = self.peek() == Some(byte);
        if found {
            self.0 = &self.0[1..];
        }
        found
    }

    fn number(&mut self, len: usize) -> Option<i64> {
        let digits = self.0.get(..len)?;
        let value = digits.iter().try_fold(0_i64, |value, byte| {
            byte.is_ascii_digit()
                .then(|| value * 10 + i64::from(byte - b'0'))
        })?;
        self.0 = &self.0[len..];
        Some(value)
    }

    fn year(&mut self) -> Option<i64> {
        match self.peek()? {
            sign @ (b'+' | b'-') => {
                self.0 = &self.0[1..];
                let year = self.number(6)?;
                // `-000000` is not a year.
                (sign == b'+' || year != 0).then_some(if sign == b'-' { -year } else { year })
            }
            _ => self.number(4),
        }
    }

    fn fraction_millis(&mut self) -> Option<i64> {
        let len = self.0.iter().take_while(|b| b.is_ascii_digit()).count();
        if len == 0 {
            return None;
        }
        let millis = (0..3).fold(0, |millis, index| {
            millis * 10 + self.0[..len].get(index).map_or(0, |b| i64::from(b - b'0'))
        });
        self.0 = &self.0[len..];
        Some(millis)
    }

    /// Minutes east of UTC; none written is UTC.
    fn zone(&mut self) -> Option<i64> {
        match self.peek() {
            None => Some(0),
            Some(b'Z' | b'z') => {
                self.0 = &self.0[1..];
                Some(0)
            }
            Some(sign @ (b'+' | b'-')) => {
                self.0 = &self.0[1..];
                let hours = self.number(2)?;
                self.eat(b':');
                let minutes = self.number(2)?;
                let total = hours * 60 + minutes;
                (hours < 24 && minutes < 60).then_some(if sign == b'-' { -total } else { total })
            }
            Some(_) => None,
        }
    }
}

/// `new Date(ms).toISOString()`, or `None` for a time a `Date` cannot hold.
/// The time is cut to whole milliseconds toward zero, as `TimeClip` does.
pub fn iso_string(ms: f64) -> Option<String> {
    if !ms.is_finite() || ms.abs() > MAX_TIME_MS {
        return None;
    }
    let ms = ms.trunc() as i64;
    let (days, of_day) = (ms.div_euclid(MS_PER_DAY), ms.rem_euclid(MS_PER_DAY));
    let (year, month, day) = civil_from_days(days);
    let year = if (0..=9999).contains(&year) {
        format!("{year:04}")
    } else {
        format!("{}{:06}", if year < 0 { '-' } else { '+' }, year.abs())
    };
    Some(format!(
        "{year}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{:03}Z",
        of_day / 3_600_000,
        of_day / 60_000 % 60,
        of_day / 1_000 % 60,
        of_day % 1_000
    ))
}

/// The proleptic Gregorian date `days` after 1970-01-01.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let mp = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// The current time as `new Date().toISOString()` writes it.
pub fn now_iso() -> String {
    let now = crate::routes::public::csp_report::now_ms();
    iso_string(now as f64).expect("the clock is within the range of a Date")
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values from Node 26 (V8): `normalizeRadarHashtag`, the seeds,
    // and `normalizeRadarTimestamp`, run on the same inputs.
    #[test]
    fn hashtags_normalize_as_the_typescript_does() {
        let cases = [
            ("#밈", "밈"),
            ("##Hello World", "helloworld"),
            ("  ＡＢＣ　ｄｅｆ ", "abcdef"),
            ("see https://x.com/a b", "seeb"),
            ("xhttps://a.b c", "xhttps://a.bc"),
            ("WWW.Example.com/x?y", ""),
            ("http:// x", "http://x"),
            ("ΣΑΣ", "σας"),
            ("a(https://b)c", "a()c"),
            ("\u{feff}tab\tnew\nline\u{3000}", "tabnewline"),
            ("ﬁ①", "fi1"),
        ];
        for (input, expected) in cases {
            assert_eq!(normalize_hashtag(input), expected, "{input:?}");
        }
        // " #밈" is "밈" (D2-12; the TypeScript kept the `#`), so the second
        // "밈" is the same seed.
        assert_eq!(
            seeds(Some(" #밈,밈, ,A b,ab,c"), 2),
            vec!["밈".to_owned(), "ab".to_owned()]
        );
        assert_eq!(normalize_hashtag(" ##짤 "), "짤");
        assert!(seeds(None, 10).is_empty());
    }

    #[test]
    fn timestamps_parse_as_v8_does() {
        let cases = [
            ("2026-11-24T05:00:00+0000", Some("2026-11-24T05:00:00.000Z")),
            ("2026-11-24T05:00:00.000Z", Some("2026-11-24T05:00:00.000Z")),
            ("2026-11-24T05:00:00", Some("2026-11-24T05:00:00.000Z")),
            ("2026-11-24T05:00Z", Some("2026-11-24T05:00:00.000Z")),
            ("2026-11-24", Some("2026-11-24T00:00:00.000Z")),
            ("2026-11", Some("2026-11-01T00:00:00.000Z")),
            ("2026", Some("2026-01-01T00:00:00.000Z")),
            ("+002026-11-24T05:00:00Z", Some("2026-11-24T05:00:00.000Z")),
            (
                "2026-11-24T05:00:00.123456Z",
                Some("2026-11-24T05:00:00.123Z"),
            ),
            ("2026-11-24T05:00:00,5Z", None),
            ("2026-11-24 05:00:00Z", Some("2026-11-24T05:00:00.000Z")),
            ("2026-11-24T24:00:00Z", Some("2026-11-25T00:00:00.000Z")),
            ("2026-02-30T00:00:00Z", Some("2026-03-02T00:00:00.000Z")),
            (
                "2026-11-24T05:00:00+05:30",
                Some("2026-11-23T23:30:00.000Z"),
            ),
            ("2026-11-24T05:00:00-0530", Some("2026-11-24T10:30:00.000Z")),
            ("2026-11-24t05:00:00z", Some("2026-11-24T05:00:00.000Z")),
            ("Tue, 24 Nov 2026 05:00:00 GMT", None),
            ("2026-11-24T05:00:00+00", None),
            ("2026-11-24T5:00:00Z", None),
            (" 2026-11-24T05:00:00Z ", Some("2026-11-24T05:00:00.000Z")),
            ("", None),
            ("2026-13-01", None),
            (
                "-271821-04-20T00:00:00Z",
                Some("-271821-04-20T00:00:00.000Z"),
            ),
            ("-271821-04-19T23:59:59Z", None),
            (
                "+275760-09-13T00:00:00Z",
                Some("+275760-09-13T00:00:00.000Z"),
            ),
            ("0099-01-01T00:00:00Z", Some("0099-01-01T00:00:00.000Z")),
        ];
        for (input, expected) in cases {
            let got = timestamp(&Value::String(input.to_owned())).expect("a string");
            assert_eq!(got.as_deref(), expected, "{input:?}");
        }
        let number = |n: f64| timestamp(&serde_json::json!(n)).expect("a number");
        assert_eq!(number(1.5).as_deref(), Some("1970-01-01T00:00:00.001Z"));
        assert_eq!(number(-1.5).as_deref(), Some("1969-12-31T23:59:59.999Z"));
        assert_eq!(number(8.64e15 + 1.0), None);
        assert_eq!(
            timestamp(&Value::Null).unwrap_err(),
            "Cannot read properties of null (reading 'trim')"
        );
        assert_eq!(
            timestamp(&Value::Bool(true)).unwrap_err(),
            "a.trim is not a function"
        );
    }
}
