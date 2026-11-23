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
