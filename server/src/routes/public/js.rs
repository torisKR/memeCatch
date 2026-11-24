//! JavaScript string semantics the ported TypeScript relies on. Rust's own
//! `trim`, `len` and whitespace class differ from JavaScript's in ways that
//! change which quiz is served, so the ports use these instead.

/// What `\s` matches in a JavaScript regex without the `u` flag, and what
/// `String.prototype.trim` removes: WhiteSpace plus LineTerminator. Unlike
/// Rust's `char::is_whitespace` it includes U+FEFF and excludes U+0085.
pub fn is_space(c: char) -> bool {
    matches!(
        c,
        '\u{9}'..='\u{d}'
            | ' '
            | '\u{a0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200a}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
            | '\u{feff}'
    )
}

/// `String.prototype.trim`.
pub fn trim(value: &str) -> &str {
    value.trim_matches(is_space)
}

/// `value.replace(/\s+/g, " ")`.
pub fn collapse_spaces(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut in_space = false;
    for c in value.chars() {
        if !is_space(c) {
            out.push(c);
        } else if !in_space {
            out.push(' ');
        }
        in_space = is_space(c);
    }
    out
}

/// `String.prototype.length`: UTF-16 code units, not bytes or characters.
pub fn utf16_len(value: &str) -> usize {
    value.encode_utf16().count()
}

/// `value.slice(0, units)`: the longest prefix of at most `units` UTF-16
/// code units, and the high surrogate JavaScript keeps alone when the cut
/// falls inside a surrogate pair.
pub fn utf16_slice(value: &str, units: usize) -> (&str, Option<u16>) {
    let mut count = 0;
    for (index, c) in value.char_indices() {
        let width = c.len_utf16();
        if count + width > units {
            let lone = (count < units).then(|| {
                let mut buffer = [0; 2];
                c.encode_utf16(&mut buffer)[0]
            });
            return (&value[..index], lone);
        }
        count += width;
    }
    (value, None)
}

/// `Number(value)` of a string: white space trimmed, empty is 0, `Infinity`
/// with a sign, `0x`/`0o`/`0b` without one, else a decimal literal; anything
/// else is NaN.
pub fn number(value: &str) -> f64 {
    let text = trim(value);
    if text.is_empty() {
        return 0.0;
    }
    for (prefix, radix) in [
        ("0x", 16),
        ("0X", 16),
        ("0o", 8),
        ("0O", 8),
        ("0b", 2),
        ("0B", 2),
    ] {
        if let Some(digits) = text.strip_prefix(prefix) {
            return u128::from_str_radix(digits, radix)
                .ok()
                .filter(|_| !digits.is_empty() && !digits.starts_with(['+', '-']))
                .map_or(f64::NAN, |value| value as f64);
        }
    }
    let (sign, body) = match text.strip_prefix('-') {
        Some(rest) => (-1.0, rest),
        None => (1.0, text.strip_prefix('+').unwrap_or(text)),
    };
    if body == "Infinity" {
        return sign * f64::INFINITY;
    }
    // StrUnsignedDecimalLiteral: digits with at most one dot (a digit on
    // either side), then an optional exponent with digits.
    let (mantissa, exponent) = match body.find(['e', 'E']) {
        Some(at) => (&body[..at], Some(&body[at + 1..])),
        None => (body, None),
    };
    let digits = mantissa.chars().filter(char::is_ascii_digit).count();
    let dots = mantissa.chars().filter(|c| *c == '.').count();
    let mantissa_ok = digits > 0 && dots <= 1 && digits + dots == mantissa.len();
    let exponent_ok = exponent.is_none_or(|exp| {
        let exp = exp.strip_prefix(['+', '-']).unwrap_or(exp);
        !exp.is_empty() && exp.chars().all(|c| c.is_ascii_digit())
    });
    if !(mantissa_ok && exponent_ok) {
        return f64::NAN;
    }
    body.parse::<f64>().map_or(f64::NAN, |value| sign * value)
}

/// `String(number)` for the values a count takes: an integer below 1e21
/// without a fraction, `NaN`, `Infinity`.
/// ponytail: other fractions print as Rust's shortest form, which differs
/// from JavaScript only below 1e-6 (JavaScript switches to an exponent).
pub fn number_to_string(value: f64) -> String {
    if value.is_nan() {
        "NaN".to_owned()
    } else if value.is_infinite() {
        if value > 0.0 { "Infinity" } else { "-Infinity" }.to_owned()
    } else if value == 0.0 {
        // Both zeros print as "0".
        "0".to_owned()
    } else if value.fract() == 0.0 && value.abs() < 1e21 {
        format!("{value:.0}")
    } else {
        format!("{value}")
    }
}

/// `encodeURIComponent`. Rust strings hold no lone surrogates, so the
/// `URIError` case cannot occur.
pub fn encode_uri_component(value: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            out.push(char::from(byte));
        } else {
            out.push('%');
            out.push(char::from(HEX[usize::from(byte >> 4)]));
            out.push(char::from(HEX[usize::from(byte & 0xf)]));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values: String.prototype.slice under Node.
    #[test]
    fn numbers_read_and_print_as_javascript_does() {
        // Expected values: Number(...) and String(...) under Node.
        for (input, expected) in [
            ("3", 3.0),
            (" 3 ", 3.0),
            ("", 0.0),
            ("0x10", 16.0),
            ("3e1", 30.0),
            ("1.5", 1.5),
            (".5", 0.5),
            ("5.", 5.0),
            ("-2", -2.0),
            ("+Infinity", f64::INFINITY),
        ] {
            assert_eq!(number(input), expected, "{input:?}");
        }
        for input in [
            "abc", "3abc", "1_0", "0x", "-0x10", "inf", "NaN", "1e", ".", "1.2.3",
        ] {
            assert!(number(input).is_nan(), "{input:?}");
        }
        assert_eq!(number_to_string(3.0), "3");
        assert_eq!(number_to_string(30.0), "30");
        assert_eq!(number_to_string(1.5), "1.5");
        assert_eq!(number_to_string(-2.0), "-2");
        assert_eq!(number_to_string(-0.0), "0");
    }

    #[test]
    fn slices_count_utf16_units() {
        assert_eq!(utf16_slice("가나다", 2), ("가나", None));
        assert_eq!(utf16_slice("a😂b", 2), ("a", Some(0xd83d)));
        assert_eq!(utf16_slice("a😂b", 3), ("a😂", None));
        assert_eq!(utf16_slice("ab", 5), ("ab", None));
    }

    #[test]
    fn space_class_is_javascripts_not_rusts() {
        assert!(is_space('\u{feff}'));
        assert!(!'\u{feff}'.is_whitespace());
        assert!(!is_space('\u{85}'));
        assert!('\u{85}'.is_whitespace());
        assert_eq!(trim("\u{feff}\u{3000} 밈 \n\u{2028}"), "밈");
        assert_eq!(collapse_spaces("a \t\u{a0}b\nc"), "a b c");
    }

    #[test]
    fn length_counts_utf16_code_units() {
        assert_eq!(utf16_len("밈"), 1);
        assert_eq!(utf16_len("😀"), 2);
    }

    #[test]
    fn encode_uri_component_matches_javascript() {
        // Expected values are what Node prints for encodeURIComponent(input).
        assert_eq!(encode_uri_component("ai-slop"), "ai-slop");
        assert_eq!(
            encode_uri_component("중꺾마"),
            "%EC%A4%91%EA%BA%BE%EB%A7%88"
        );
        assert_eq!(
            encode_uri_component("a b/c?d#e&f=g+h%i"),
            "a%20b%2Fc%3Fd%23e%26f%3Dg%2Bh%25i"
        );
        assert_eq!(encode_uri_component("-_.!~*'()"), "-_.!~*'()");
        assert_eq!(encode_uri_component("😀"), "%F0%9F%98%80");
    }
}
