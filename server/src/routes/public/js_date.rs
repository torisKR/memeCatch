//! JavaScript `Date` behaviour the ported TypeScript relies on, for the one
//! shape of text these routes handle: a timestamp as Postgres writes it into
//! JSON (`2026-11-23T15:14:12.123456+00:00`) or a bare date.

use time::OffsetDateTime;

const MS_PER_DAY: i64 = 86_400_000;

/// `new Date(text).getTime()` for a real date (`YYYY-MM-DD`, read as UTC
/// midnight) or a real date and time with a zone
/// (`YYYY-MM-DDTHH:MM:SS[.f…](Z|±HH:MM)`). `None` stands for `NaN`.
///
/// V8 keeps the first three digits of the fraction and drops the rest.
///
/// Text in any other shape is `None` here, which is not always what V8
/// answers: it rolls `2026-02-30` over to March, reads a time without a zone
/// as local time, and has a legacy parser for looser text. Postgres writes
/// none of those for a `timestamptz` between years 0001 and 9999, and
/// [`evidence_ms`] refuses them before it asks.
pub fn parse_ms(text: &str) -> Option<i64> {
    let bytes = text.as_bytes();
    let year = digits(bytes.get(0..4)?)?;
    let month = digits(bytes.get(5..7)?)?;
    let day = digits(bytes.get(8..10)?)?;
    if bytes[4] != b'-' || bytes[7] != b'-' || !valid_date(year, month, day) {
        return None;
    }
    let date_ms = days_from_civil(year, month, day) * MS_PER_DAY;
    if bytes.len() == 10 {
        return Some(date_ms);
    }
    let time = bytes.get(10..19)?;
    if time[0] != b'T' || time[3] != b':' || time[6] != b':' {
        return None;
    }
    let (hour, minute, second) = (
        digits(&time[1..3])?,
        digits(&time[4..6])?,
        digits(&time[7..9])?,
    );
    let (millis, zone) = fraction_millis(&bytes[19..])?;
    let offset_minutes = zone_minutes(zone)?;
    // 24:00:00 is the end of the day to V8; later hours are not a time.
    let in_range = (hour < 24 && minute < 60 && second < 60)
        || (hour == 24 && minute == 0 && second == 0 && millis == 0);
    in_range
        .then(|| date_ms + (hour * 60 + minute - offset_minutes) * 60_000 + second * 1_000 + millis)
}

/// The milliseconds of an optional `.fff…` and what follows it.
fn fraction_millis(rest: &[u8]) -> Option<(i64, &[u8])> {
    let Some(after_dot) = rest.strip_prefix(b".") else {
        return Some((0, rest));
    };
    let len = after_dot.iter().take_while(|b| b.is_ascii_digit()).count();
    if len == 0 {
        return None;
    }
    let mut millis = 0;
    for index in 0..3 {
        let digit = after_dot[..len]
            .get(index)
            .map_or(0, |b| i64::from(b - b'0'));
        millis = millis * 10 + digit;
    }
    Some((millis, &after_dot[len..]))
}

/// `Z` or `±HH:MM`, as minutes east of UTC.
fn zone_minutes(zone: &[u8]) -> Option<i64> {
    match zone {
        b"Z" => Some(0),
        [sign @ (b'+' | b'-'), h1, h2, b':', m1, m2] => {
            let (hours, minutes) = (digits(&[*h1, *h2])?, digits(&[*m1, *m2])?);
            let total = hours * 60 + minutes;
            (hours < 24 && minutes < 60).then_some(if *sign == b'-' { -total } else { total })
        }
        _ => None,
    }
}

fn digits(bytes: &[u8]) -> Option<i64> {
    bytes.iter().try_fold(0_i64, |value, byte| {
        byte.is_ascii_digit()
            .then(|| value * 10 + i64::from(byte - b'0'))
    })
}

fn is_leap(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn valid_date(year: i64, month: i64, day: i64) -> bool {
    let month_days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap(year) => 29,
        2 => 28,
        _ => return false,
    };
    (1..=month_days).contains(&day)
}

/// Days from 1970-01-01 to a proleptic Gregorian date.
pub(crate) fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year.rem_euclid(400);
    let day_of_year = (153 * ((month + 9) % 12) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

/// `evidenceTimestamp` in lib/source-links.ts, as milliseconds: text that is
/// a real date, or a real date and time with a zone, not after `now_ms`.
/// The caller trims first (`super::js::trim`).
pub fn evidence_ms(text: &str, now_ms: i64) -> Option<i64> {
    let bytes = text.as_bytes();
    // What the regular expression adds to `parse_ms`: an hour below 24, one
    // to six fraction digits, and a zone of at most 14 hours.
    if bytes.len() != 10 {
        let (_, zone) = fraction_millis(bytes.get(19..)?)?;
        let fraction_len = bytes.len() - 19 - zone.len();
        let zone_ok = match zone {
            b"Z" => true,
            [_, h1, h2, ..] => digits(&[*h1, *h2])? <= 14,
            _ => false,
        };
        // Nothing, or "." and one to six digits.
        if !(fraction_len == 0 || (2..=7).contains(&fraction_len)) || !zone_ok {
            return None;
        }
        if digits(bytes.get(11..13)?)? > 23 {
            return None;
        }
    }
    // `Date.UTC(year, …)` reads a year below 100 as 19xx, so the calendar
    // check of the TypeScript fails for those.
    if digits(bytes.get(0..4)?)? < 100 {
        return None;
    }
    parse_ms(text).filter(|ms| *ms <= now_ms)
}

/// `new Date(ms).toUTCString()`: `Mon, 23 Nov 2026 15:14:12 GMT`.
pub fn to_utc_string(ms: i64) -> Option<String> {
    let at = OffsetDateTime::from_unix_timestamp(ms.div_euclid(1_000)).ok()?;
    let weekday = &at.weekday().to_string()[..3];
    let month = &at.month().to_string()[..3];
    Some(format!(
        "{weekday}, {:02} {month} {:04} {:02}:{:02}:{:02} GMT",
        at.day(),
        at.year(),
        at.hour(),
        at.minute(),
        at.second()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values are what Node 26 prints for `new Date(text).getTime()`.
    #[test]
    fn parses_postgres_json_timestamps_like_v8() {
        for (text, expected) in [
            ("2026-07-16T00:30:00.123999+00:00", Some(1_784_161_800_123)),
            ("2026-07-16T00:30:00.9999995+00:00", Some(1_784_161_800_999)),
            ("2026-07-16T00:30:00+09:00", Some(1_784_129_400_000)),
            ("2026-07-16T00:30:00.1+00:00", Some(1_784_161_800_100)),
            ("2026-07-16T00:30:00Z", Some(1_784_161_800_000)),
            ("2026-07-16", Some(1_784_160_000_000)),
            ("1969-12-31T23:59:59.999999+00:00", Some(-1)),
            ("1969-12-31T23:59:59.0005+00:00", Some(-1_000)),
            ("2026-07-16T24:00:00+00:00", Some(1_784_246_400_000)),
            ("0123-01-02T00:00:00+00:00", Some(-58_285_612_800_000)),
            ("10000-01-01T00:00:00+00:00", None),
            ("2026-07-16T24:00:01+00:00", None),
            ("2026-07-16T00:30:00+00", None),
            ("infinity", None),
            ("2026-07-16T00:30:00.+00:00", None),
            ("", None),
        ] {
            assert_eq!(parse_ms(text), expected, "{text}");
        }
    }

    // V8 gives a number for each of these (a rolled-over date, local time,
    // its legacy parser). Postgres writes none of them.
    #[test]
    fn text_postgres_never_writes_is_not_a_time_here() {
        for text in [
            "2026-02-30",
            "2026-07-16T00:30:00",
            "2026-07-16 00:30:00+00:00",
        ] {
            assert_eq!(parse_ms(text), None, "{text}");
        }
    }

    #[test]
    fn evidence_timestamp_refuses_the_future_and_shapes_the_regex_refuses() {
        let now = 1_784_161_800_123;

        assert_eq!(
            evidence_ms("2026-07-16T00:30:00.123456+00:00", now),
            Some(now)
        );
        assert_eq!(evidence_ms("2026-07-16", now), Some(1_784_160_000_000));
        // One millisecond after now.
        assert_eq!(evidence_ms("2026-07-16T00:30:00.124+00:00", now), None);
        for refused in [
            "2026-07-16T00:30:00.1234567+00:00", // seven fraction digits
            "2026-07-16T24:00:00+00:00",         // hour 24
            "2026-07-16T00:30:00+15:00",         // zone beyond 14 hours
            "2026-07-16T00:30:00",               // no zone
            "0099-07-16",                        // Date.UTC reads it as 1999
            "2026-02-29",                        // not a leap year
            "2026-7-16",
            "infinity",
        ] {
            assert_eq!(evidence_ms(refused, now), None, "{refused}");
        }
    }

    // Expected values are what Node prints for `new Date(ms).toUTCString()`.
    #[test]
    fn utc_string_matches_javascript() {
        assert_eq!(
            to_utc_string(1_795_446_852_500).as_deref(),
            Some("Mon, 23 Nov 2026 15:14:12 GMT")
        );
        assert_eq!(
            to_utc_string(-58_285_612_800_000).as_deref(),
            Some("Sat, 02 Jan 0123 00:00:00 GMT")
        );
        assert_eq!(
            to_utc_string(-1).as_deref(),
            Some("Wed, 31 Dec 1969 23:59:59 GMT")
        );
    }
}
