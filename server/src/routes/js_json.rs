//! `JSON.stringify(JSON.parse(text))` for a `jsonb` value read from Postgres,
//! for routes that pass a stored document through to the client.
//!
//! Next parses the row and serializes it again, and JavaScript changes two
//! things on the way that `serde_json` does not:
//!
//! - Keys that are array indices (`"0"`, `"10"`) come first, in numeric
//!   order. The others keep the order of the text, which for `jsonb` is by
//!   byte length and then by bytes.
//! - Every number becomes a double and is printed as JavaScript prints one:
//!   `1.0` is `1`, `1e21` is `1e+21`, an integer beyond 2^53 is rounded.

use serde_json::Value;

use super::request::Json;

/// The largest array index, 2^32 - 2.
const MAX_ARRAY_INDEX: u64 = 4_294_967_294;

/// The numeric value of a key JavaScript treats as an array index: `0`, or
/// digits without a leading zero, at most 2^32 - 2.
fn array_index(key: &str) -> Option<u64> {
    let canonical = key == "0" || (!key.starts_with('0') && !key.is_empty());
    if !canonical || !key.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    key.parse().ok().filter(|index| *index <= MAX_ARRAY_INDEX)
}

/// `Number::toString` of ECMAScript.
pub(crate) fn number(value: f64) -> String {
    if value == 0.0 {
        return "0".to_owned();
    }
    // Rust's `{:e}` prints the shortest digits that round-trip: `d.ddde±x`.
    let scientific = format!("{:e}", value.abs());
    let (mantissa, exponent) = scientific.split_once('e').expect("an exponent");
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let exponent: i32 = exponent.parse().expect("a decimal exponent");
    let (count, point) = (digits.len() as i32, exponent + 1);
    let body = if (count..=21).contains(&point) {
        format!("{digits}{}", "0".repeat((point - count) as usize))
    } else if (1..=21).contains(&point) {
        format!(
            "{}.{}",
            &digits[..point as usize],
            &digits[point as usize..]
        )
    } else if (-5..=0).contains(&point) {
        format!("0.{}{digits}", "0".repeat((-point) as usize))
    } else {
        let sign = if exponent < 0 { '-' } else { '+' };
        let fraction = if count > 1 {
            format!(".{}", &digits[1..])
        } else {
            String::new()
        };
        format!("{}{fraction}e{sign}{}", &digits[..1], exponent.abs())
    };
    if value < 0.0 {
        format!("-{body}")
    } else {
        body
    }
}

fn write(value: &Value, out: &mut String) {
    match value {
        Value::Number(n) => out.push_str(&number(n.as_f64().unwrap_or(0.0))),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write(item, out);
            }
            out.push(']');
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort_by_key(|key| match array_index(key) {
                Some(index) => (0, index, 0, key.as_bytes()),
                None => (1, 0, key.len(), key.as_bytes()),
            });
            out.push('{');
            for (index, key) in keys.into_iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&serde_json::to_string(key).expect("a string serializes"));
                out.push(':');
                write(&map[key], out);
            }
            out.push('}');
        }
        // null, booleans and strings are written alike by both.
        other => out.push_str(&serde_json::to_string(other).expect("a scalar serializes")),
    }
}

/// The text `JSON.stringify` gives for `value`.
pub fn stringify(value: &Value) -> String {
    let mut out = String::new();
    write(value, &mut out);
    out
}

/// `JSON.stringify(JSON.parse(text))` for a value parsed with its keys in
/// the order of the text: array-index keys first in numeric order, then the
/// others as they came. For a row `row_to_json` wrote, that is its columns'
/// order, and inside a `jsonb` column the stored one.
pub fn stringify_parsed(value: &Json) -> String {
    let mut out = String::new();
    write_parsed(value, &mut out);
    out
}

fn write_parsed(value: &Json, out: &mut String) {
    match value {
        Json::Null => out.push_str("null"),
        Json::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        Json::Number(n) if n.is_finite() => out.push_str(&number(*n)),
        Json::Number(_) => out.push_str("null"),
        Json::String(text) => {
            out.push_str(&serde_json::to_string(text).expect("a string serializes"))
        }
        Json::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_parsed(item, out);
            }
            out.push(']');
        }
        Json::Object(entries) => {
            let mut ordered: Vec<&(String, Json)> = entries.iter().collect();
            // A stable sort: the other keys keep the order they came in.
            ordered.sort_by_key(|(key, _)| array_index(key).map_or((1, 0), |index| (0, index)));
            out.push('{');
            for (index, (key, item)) in ordered.into_iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&serde_json::to_string(key).expect("a string serializes"));
                out.push(':');
                write_parsed(item, out);
            }
            out.push('}');
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values are what Node prints for String(x).
    #[test]
    fn numbers_are_printed_as_javascript_prints_them() {
        for (value, expected) in [
            (0.0, "0"),
            (-0.0, "0"),
            (1.0, "1"),
            (1.5, "1.5"),
            (100.0, "100"),
            (1e21, "1e+21"),
            (1e20, "100000000000000000000"),
            (123456789012345680000.0, "123456789012345680000"),
            (1.2345678901234567e25, "1.2345678901234566e+25"),
            (1e-6, "0.000001"),
            (1e-7, "1e-7"),
            (0.000001234, "0.000001234"),
            (1.5e-7, "1.5e-7"),
            (9007199254740993.0, "9007199254740992"),
            (0.1 + 0.2, "0.30000000000000004"),
            (5e-324, "5e-324"),
            (1.7976931348623157e308, "1.7976931348623157e+308"),
            (-2.5, "-2.5"),
            (1e300, "1e+300"),
            (123.456, "123.456"),
            (1e6, "1000000"),
        ] {
            assert_eq!(number(value), expected);
        }
    }

    // The input is how Postgres writes the jsonb; the expected text is what
    // Node prints for JSON.stringify(JSON.parse(input)).
    #[test]
    fn a_jsonb_document_comes_out_as_json_stringify_writes_it() {
        let from_postgres = r#"{"A": null, "a": {"2": 2, "x": 3, "-1": 7, "01": 4, "10": 1, "1.5": 8, "4294967294": 6, "4294967295": 5}, "b": 1, "n": [1e21, 1.5e-7, 123456789012345678901234567890, -0.0, 9007199254740993], "z": [1.0, 2000, "\u007f\u0001 é\"\\/"], "aa": 1.0}"#;

        let value: Value = serde_json::from_str(from_postgres).unwrap();

        assert_eq!(
            stringify(&value),
            "{\"A\":null,\"a\":{\"2\":2,\"10\":1,\"4294967294\":6,\"x\":3,\"-1\":7,\"01\":4,\"1.5\":8,\"4294967295\":5},\"b\":1,\"n\":[1e+21,1.5e-7,1.2345678901234568e+29,0,9007199254740992],\"z\":[1,2000,\"\u{7f}\\u0001\u{2028}é\\\"\\\\/\"],\"aa\":1}"
        );
    }
}
