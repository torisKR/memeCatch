//! The `Intl` formats the operator screens print, as Node 22's ICU prints
//! them for `ko-KR`. Each function names the options it stands for.
//!
//! Formats without `timeZone` use the time zone of the Next process. The
//! production image sets none, so Node runs in UTC; these print UTC.

use time::format_description::well_known::Rfc3339;
use time::{OffsetDateTime, PrimitiveDateTime, UtcOffset};

pub const KST: UtcOffset = match UtcOffset::from_hms(9, 0, 0) {
    Ok(offset) => offset,
    Err(_) => panic!("+09:00 is a valid offset"),
};

/// `new Date(value)` of a timestamp as Postgres or JSON gives it:
/// RFC 3339, or Postgres' text form (`2026-11-24 13:07:00.12+00`).
pub fn parse_timestamp(value: &str) -> Option<OffsetDateTime> {
    if let Ok(parsed) = OffsetDateTime::parse(value, &Rfc3339) {
        return Some(parsed);
    }
    let normalized = postgres_to_rfc3339(value)?;
    OffsetDateTime::parse(&normalized, &Rfc3339).ok()
}

/// `new Date(value)` of a timestamp or of a bare `YYYY-MM-DD` (UTC midnight).
pub fn parse_timestamp_or_date(value: &str) -> Option<OffsetDateTime> {
    if value.len() == 10 {
        return parse_timestamp(&format!("{value}T00:00:00Z"));
    }
    parse_timestamp(value)
}

fn postgres_to_rfc3339(value: &str) -> Option<String> {
    let (date, rest) = value.split_once(' ')?;
    let zone_at = rest.rfind(['+', '-'])?;
    let (clock, zone) = rest.split_at(zone_at);
    let zone = match zone.len() {
        3 => format!("{zone}:00"),
        5 if !zone.contains(':') => format!("{}:{}", &zone[..3], &zone[3..]),
        _ => zone.to_owned(),
    };
    Some(format!("{date}T{clock}{zone}"))
}

/// `PrimitiveDateTime` of `value` at `offset`.
fn at(value: OffsetDateTime, offset: UtcOffset) -> PrimitiveDateTime {
    let local = value.to_offset(offset);
    PrimitiveDateTime::new(local.date(), local.time())
}

/// `{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
/// minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" }`:
/// `2026. 11. 24. 13:07`.
pub fn kst_date_time_h23(value: OffsetDateTime) -> String {
    let local = at(value, KST);
    format!(
        "{}. {:02}. {:02}. {:02}:{:02}",
        local.year(),
        u8::from(local.month()),
        local.day(),
        local.hour(),
        local.minute()
    )
}

/// `toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit",
/// day: "2-digit" })` in UTC: `26. 11. 24.`.
pub fn utc_short_date(value: OffsetDateTime) -> String {
    let local = at(value, UtcOffset::UTC);
    format!(
        "{:02}. {:02}. {:02}.",
        local.year().rem_euclid(100),
        u8::from(local.month()),
        local.day()
    )
}

/// `toLocaleString("ko-KR", { year: "numeric", month: "2-digit",
/// day: "2-digit", hour: "2-digit", minute: "2-digit" })` at `offset`:
/// `2026. 11. 24. 오후 01:07`.
pub fn date_time_12h(value: OffsetDateTime, offset: UtcOffset) -> String {
    let local = at(value, offset);
    let (period, hour) = twelve_hour(local.hour());
    format!(
        "{}. {:02}. {:02}. {period} {hour:02}:{:02}",
        local.year(),
        u8::from(local.month()),
        local.day(),
        local.minute()
    )
}

/// `new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul" }).format(d)`:
/// `2026. 1. 5.`.
pub fn kst_date(value: OffsetDateTime) -> String {
    let local = at(value, KST);
    format!(
        "{}. {}. {}.",
        local.year(),
        u8::from(local.month()),
        local.day()
    )
}

/// `{ dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }`:
/// `2026. 1. 5. 오전 12:59`.
pub fn kst_medium_short(value: OffsetDateTime) -> String {
    let local = at(value, KST);
    let (period, hour) = twelve_hour(local.hour());
    format!(
        "{}. {}. {}. {period} {hour}:{:02}",
        local.year(),
        u8::from(local.month()),
        local.day(),
        local.minute()
    )
}

/// `Number.prototype.toFixed(digits)` for a value under 1e21: the exact
/// binary value rounded half up (away from zero), "-" kept for a negative.
pub fn to_fixed(value: f64, digits: usize) -> String {
    // Every f64 under 1e21 has an exact decimal expansion this long.
    let exact = format!("{:.1100}", value.abs());
    let (whole, fraction) = exact.split_once('.').expect("a decimal point");
    let mut kept: Vec<u8> = whole.bytes().chain(fraction.bytes().take(digits)).collect();
    if fraction.as_bytes()[digits] >= b'5' {
        let mut index = kept.len();
        loop {
            if index == 0 {
                kept.insert(0, b'1');
                break;
            }
            index -= 1;
            if kept[index] == b'9' {
                kept[index] = b'0';
            } else {
                kept[index] += 1;
                break;
            }
        }
    }
    let split = kept.len() - digits;
    let (int, frac) = kept.split_at(split);
    let sign = if value < 0.0 { "-" } else { "" };
    let int = String::from_utf8_lossy(int);
    if digits == 0 {
        format!("{sign}{int}")
    } else {
        format!("{sign}{int}.{}", String::from_utf8_lossy(frac))
    }
}

/// The text React writes in a `<textarea>`: a leading newline is doubled,
/// since the HTML parser drops the first.
pub fn textarea(value: &str) -> String {
    if value.starts_with('\n') {
        format!("\n{value}")
    } else {
        value.to_owned()
    }
}

/// `Date.prototype.toISOString()`: `2026-11-24T04:07:00.123Z`.
pub fn iso(value: OffsetDateTime) -> String {
    let utc = value.to_offset(UtcOffset::UTC);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        utc.year(),
        u8::from(utc.month()),
        utc.day(),
        utc.hour(),
        utc.minute(),
        utc.second(),
        utc.millisecond()
    )
}

/// `{ month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
/// timeZone: "Asia/Seoul" }`: `11월 24일 오후 01:07`.
pub fn kst_month_day_time(value: OffsetDateTime) -> String {
    let local = at(value, KST);
    let (period, hour) = twelve_hour(local.hour());
    format!(
        "{}월 {}일 {period} {hour:02}:{:02}",
        u8::from(local.month()),
        local.day(),
        local.minute()
    )
}

/// ICU's `a h` for Korean: 오전 for 0–11, 오후 for 12–23, and 12 for 0 and 12.
pub fn twelve_hour(hour: u8) -> (&'static str, u8) {
    let period = if hour < 12 { "오전" } else { "오후" };
    let hour = match hour % 12 {
        0 => 12,
        other => other,
    };
    (period, hour)
}

/// `Number.prototype.toLocaleString("ko-KR")` for an integer.
pub fn count(value: i64) -> String {
    let digits = value.unsigned_abs().to_string();
    let mut grouped = String::with_capacity(digits.len() + digits.len() / 3 + 1);
    if value < 0 {
        grouped.push('-');
    }
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            grouped.push(',');
        }
        grouped.push(digit);
    }
    grouped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_fixed_rounds_the_exact_value_half_up() {
        assert_eq!(to_fixed(1.005, 2), "1.00");
        assert_eq!(to_fixed(0.125, 2), "0.13");
        assert_eq!(to_fixed(2.5, 0), "3");
        assert_eq!(to_fixed(99.999, 2), "100.00");
        assert_eq!(to_fixed(-0.001, 2), "-0.00");
        assert_eq!(to_fixed(0.0, 2), "0.00");
        assert_eq!(to_fixed(12.3, 2), "12.30");
    }

    fn utc(value: &str) -> OffsetDateTime {
        parse_timestamp(value).expect(value)
    }

    // The expected strings are what Node 22 printed with TZ=UTC.
    #[test]
    fn dates_print_as_node_prints_them_for_korean() {
        let midnight = utc("2026-11-24T00:05:00Z");
        let noon = utc("2026-11-24T12:05:00Z");
        let late = utc("2026-01-04T15:59:00Z");
        assert_eq!(kst_date_time_h23(midnight), "2026. 11. 24. 09:05");
        assert_eq!(kst_date_time_h23(late), "2026. 01. 05. 00:59");
        assert_eq!(utc_short_date(late), "26. 01. 04.");
        assert_eq!(
            date_time_12h(midnight, UtcOffset::UTC),
            "2026. 11. 24. 오전 12:05"
        );
        assert_eq!(
            date_time_12h(noon, UtcOffset::UTC),
            "2026. 11. 24. 오후 12:05"
        );
        assert_eq!(
            date_time_12h(late, UtcOffset::UTC),
            "2026. 01. 04. 오후 03:59"
        );
        assert_eq!(kst_date(late), "2026. 1. 5.");
        assert_eq!(kst_month_day_time(midnight), "11월 24일 오전 09:05");
        assert_eq!(kst_month_day_time(late), "1월 5일 오전 12:59");
        assert_eq!(kst_medium_short(late), "2026. 1. 5. 오전 12:59");
        assert_eq!(
            kst_medium_short(utc("2026-11-24T04:07:00Z")),
            "2026. 11. 24. 오후 1:07"
        );
        assert_eq!(
            kst_medium_short(utc("2026-03-01T03:00:00Z")),
            "2026. 3. 1. 오후 12:00"
        );
    }

    #[test]
    fn postgres_text_timestamps_parse() {
        assert_eq!(
            utc("2026-11-24 13:07:00.123+00"),
            utc("2026-11-24T13:07:00.123Z")
        );
        assert_eq!(utc("2026-11-24 22:07:00+09"), utc("2026-11-24T13:07:00Z"));
        assert!(parse_timestamp("yesterday").is_none());
    }

    #[test]
    fn counts_group_by_three() {
        assert_eq!(count(0), "0");
        assert_eq!(count(999), "999");
        assert_eq!(count(1_234_567), "1,234,567");
        assert_eq!(count(-1000), "-1,000");
    }
}
