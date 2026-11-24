//! Dates as the meme page writes them: the timestamps Postgres puts into JSON
//! (`2026-02-10T11:12:13.456+00:00`), read the way `Date.parse` reads them,
//! and shown as `toLocaleDateString("ko-KR", { year: "numeric", month:
//! "long", day: "numeric", timeZone: "Asia/Seoul" })` does.

use time::format_description::well_known::Rfc3339;
use time::{Date, Month, OffsetDateTime, UtcOffset};

use crate::routes::public::js;

const SEOUL: UtcOffset = match UtcOffset::from_hms(9, 0, 0) {
    Ok(offset) => offset,
    Err(_) => panic!("+09:00 is an offset"),
};

/// `2026년 2월 10일`, in Seoul.
pub fn korean_date(time: OffsetDateTime) -> String {
    let time = time.to_offset(SEOUL);
    format!(
        "{}년 {}월 {}일",
        time.year(),
        u8::from(time.month()),
        time.day()
    )
}

/// `new Intl.DateTimeFormat(dateLocale, { dateStyle: "long" }).format(time)`
/// of an edition (en-US, ja-JP, zh-CN, zh-TW), in UTC.
pub fn edition_date(code: &str, time: OffsetDateTime) -> String {
    let time = time.to_offset(UtcOffset::UTC);
    let (year, month, day) = (time.year(), time.month(), time.day());
    if code == "en" {
        format!("{month} {day}, {year}")
    } else {
        format!("{year}年{}月{day}日", u8::from(month))
    }
}

/// `Date.parse` for the two forms the pages meet: RFC 3339 and a bare
/// `YYYY-MM-DD`, which JavaScript reads as midnight UTC.
pub fn parse(text: &str) -> Option<OffsetDateTime> {
    if let Ok(time) = OffsetDateTime::parse(text, &Rfc3339) {
        return Some(time);
    }
    let bytes = text.as_bytes();
    if bytes.len() != 10 || !date_shape(bytes) {
        return None;
    }
    let number = |range: std::ops::Range<usize>| text[range].parse::<u16>().ok();
    let month = Month::try_from(u8::try_from(number(5..7)?).ok()?).ok()?;
    let day = u8::try_from(number(8..10)?).ok()?;
    let date = Date::from_calendar_date(i32::from(number(0..4)?), month, day).ok()?;
    Some(date.midnight().assume_utc())
}

fn digits(bytes: &[u8]) -> bool {
    bytes.iter().all(u8::is_ascii_digit)
}

/// `\d{4}-\d{2}-\d{2}`.
fn date_shape(bytes: &[u8]) -> bool {
    bytes.len() >= 10
        && digits(&bytes[..4])
        && bytes[4] == b'-'
        && digits(&bytes[5..7])
        && bytes[7] == b'-'
        && digits(&bytes[8..10])
}

/// Two digits no greater than `max`.
fn two(bytes: &[u8], max: u8) -> bool {
    bytes.len() == 2 && digits(bytes) && (bytes[0] - b'0') * 10 + (bytes[1] - b'0') <= max
}

/// The time part `evidenceTimestamp` accepts:
/// `T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)`.
fn time_shape(rest: &[u8]) -> bool {
    let Some(rest) = rest.strip_prefix(b"T") else {
        return false;
    };
    if rest.len() < 8 || rest[2] != b':' || rest[5] != b':' {
        return false;
    }
    if !two(&rest[0..2], 23) || !two(&rest[3..5], 59) || !two(&rest[6..8], 59) {
        return false;
    }
    let mut rest = &rest[8..];
    if let Some(fraction) = rest.strip_prefix(b".") {
        let length = fraction.iter().take_while(|b| b.is_ascii_digit()).count();
        if !(1..=6).contains(&length) {
            return false;
        }
        rest = &fraction[length..];
    }
    match rest {
        b"Z" => true,
        [b'+' | b'-', h1, h2, b':', m1, m2] => two(&[*h1, *h2], 14) && two(&[*m1, *m2], 59),
        _ => false,
    }
}

/// `evidenceTimestamp(value, now)` of lib/source-links.ts: the stored text,
/// when it is a real calendar date (with a time, optionally) not in the future.
pub fn evidence_timestamp(value: Option<&str>, now: OffsetDateTime) -> Option<&str> {
    let text = js::trim(value?);
    let bytes = text.as_bytes();
    if !date_shape(bytes) || !(bytes.len() == 10 || time_shape(&bytes[10..])) {
        return None;
    }
    // A calendar date that exists, then `Date.parse(text) <= now`.
    parse(&text[..10])?;
    parse(text).filter(|time| *time <= now).map(|_| text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_postgres_timestamp_is_shown_as_its_day_in_seoul() {
        let late = parse("2026-02-10T15:30:00+00:00").expect("parses");
        assert_eq!(korean_date(late), "2026년 2월 11일");
        let stored = parse("2026-02-10T11:12:13.456+00:00").expect("parses");
        assert_eq!(korean_date(stored), "2026년 2월 10일");
        let bare = parse("2026-01-02").expect("a bare date");
        assert_eq!(korean_date(bare), "2026년 1월 2일");
        assert!(parse("2026-02-30").is_none());
        assert!(parse("yesterday").is_none());
    }

    #[test]
    fn evidence_needs_a_real_date_in_the_past_and_the_documented_shape() {
        let now = parse("2026-11-24T00:00:00Z").expect("parses");
        let ok = |text| evidence_timestamp(Some(text), now);
        assert_eq!(
            ok(" 2026-02-10T11:12:13.456+00:00 "),
            Some("2026-02-10T11:12:13.456+00:00")
        );
        assert_eq!(ok("2026-02-10"), Some("2026-02-10"));
        assert_eq!(ok("2026-02-10T11:12:13Z"), Some("2026-02-10T11:12:13Z"));
        assert_eq!(ok("2026-02-30"), None);
        assert_eq!(ok("2026-02-10T24:00:00Z"), None);
        assert_eq!(ok("2026-02-10T11:12:13.1234567Z"), None);
        assert_eq!(ok("2026-02-10T11:12:13+15:00"), None);
        assert_eq!(ok("2026-02-10T11:12Z"), None);
        assert_eq!(ok("2027-01-01"), None);
        assert_eq!(evidence_timestamp(None, now), None);
    }

    #[test]
    fn an_edition_writes_the_long_date_of_its_language_in_utc() {
        let time = parse("2026-10-31T23:59:00+00:00").unwrap();
        assert_eq!(edition_date("en", time), "October 31, 2026");
        assert_eq!(edition_date("ja", time), "2026年10月31日");
        assert_eq!(
            edition_date("zh-tw", parse("2026-11-01T08:00:00+09:00").unwrap()),
            "2026年10月31日"
        );
    }
}
