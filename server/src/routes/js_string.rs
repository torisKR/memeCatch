//! A JavaScript string: UTF-16 code units. `slice` and `length` count those
//! units, so `"…😀".slice(0, n)` can end in half of a surrogate pair, which a
//! Rust `String` cannot hold. `JSON.stringify` then writes the half as
//! `\udXXX`, and `encodeURIComponent` throws on it. The ports that cut text
//! with `slice` keep it as a [`JsString`] so those cases come out the same.

use super::public::js;

#[derive(Clone, Debug, Default, PartialEq, Eq, Hash)]
pub struct JsString(Vec<u16>);

impl From<&str> for JsString {
    fn from(value: &str) -> Self {
        Self(value.encode_utf16().collect())
    }
}

impl JsString {
    pub fn units(&self) -> &[u16] {
        &self.0
    }

    /// `length`.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// `slice(0, end)`.
    pub fn prefix(&self, end: usize) -> Self {
        Self(self.0[..end.min(self.0.len())].to_vec())
    }

    /// `slice(start, end)` with both in range.
    pub fn slice(&self, start: usize, end: usize) -> Self {
        Self(self.0[start..end].to_vec())
    }

    /// `trim()`. Every JavaScript space is in the BMP.
    pub fn trim(&self) -> Self {
        let space = |unit: &u16| char::from_u32(u32::from(*unit)).is_some_and(js::is_space);
        let Some(start) = self.0.iter().position(|unit| !space(unit)) else {
            return Self::default();
        };
        let end = self
            .0
            .iter()
            .rposition(|unit| !space(unit))
            .map_or(0, |at| at + 1);
        Self(self.0[start..end].to_vec())
    }

    /// `parts.join(separator)`.
    pub fn join(parts: &[Self], separator: &str) -> Self {
        let separator: Vec<u16> = separator.encode_utf16().collect();
        let units: Vec<Vec<u16>> = parts.iter().map(|part| part.0.clone()).collect();
        Self(units.join(&separator[..]))
    }

    /// `includes(needle)`.
    pub fn contains(&self, needle: &Self) -> bool {
        needle.0.is_empty()
            || self
                .0
                .windows(needle.0.len())
                .any(|window| window == needle.0)
    }

    pub fn eq_str(&self, other: &str) -> bool {
        self.0.iter().copied().eq(other.encode_utf16())
    }

    /// The code points of `for (const c of s)`: a lone surrogate is its own.
    pub fn code_points(&self) -> impl Iterator<Item = u32> + '_ {
        char::decode_utf16(self.0.iter().copied())
            .map(|point| point.map_or_else(|lone| u32::from(lone.unpaired_surrogate()), u32::from))
    }

    /// The text, unless it holds a lone surrogate.
    pub fn to_str(&self) -> Option<String> {
        String::from_utf16(&self.0).ok()
    }

    /// `JSON.stringify(s)`: what `serde_json` writes, with a lone surrogate
    /// as a lower-case `\uXXXX` escape.
    pub fn json(&self) -> String {
        let mut out = String::with_capacity(self.0.len() + 2);
        out.push('"');
        for point in char::decode_utf16(self.0.iter().copied()) {
            match point {
                Ok('"') => out.push_str("\\\""),
                Ok('\\') => out.push_str("\\\\"),
                Ok('\u{8}') => out.push_str("\\b"),
                Ok('\u{c}') => out.push_str("\\f"),
                Ok('\n') => out.push_str("\\n"),
                Ok('\r') => out.push_str("\\r"),
                Ok('\t') => out.push_str("\\t"),
                Ok(c) if c < ' ' => out.push_str(&format!("\\u{:04x}", u32::from(c))),
                Ok(c) => out.push(c),
                Err(lone) => out.push_str(&format!("\\u{:04x}", lone.unpaired_surrogate())),
            }
        }
        out.push('"');
        out
    }

    /// `encodeURIComponent(s)`; `None` where it throws `URIError`.
    pub fn encode_uri_component(&self) -> Option<String> {
        self.to_str().map(|text| js::encode_uri_component(&text))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slicing_can_split_a_pair_and_the_half_is_escaped() {
        let text = JsString::from("a😀b");
        assert_eq!(text.len(), 4);
        let cut = text.prefix(2);
        assert_eq!(cut.json(), r#""a\ud83d""#);
        assert_eq!(cut.encode_uri_component(), None);
        assert_eq!(text.json(), "\"a😀b\"");
        assert_eq!(cut.code_points().collect::<Vec<_>>(), [0x61, 0xd83d]);
    }

    #[test]
    fn json_escapes_as_json_stringify_does() {
        let raw = "\"\\\u{1}\u{8}\t\n\u{7f}\u{2028}";
        assert_eq!(
            JsString::from(raw).json(),
            serde_json::to_string(raw).expect("a string serializes")
        );
    }

    #[test]
    fn trim_join_and_contains() {
        assert!(JsString::from("\u{feff} 밈 \u{3000}").trim().eq_str("밈"));
        assert!(JsString::from("   ").trim().is_empty());
        let joined = JsString::join(&[JsString::from("a"), JsString::from("b")], "\n");
        assert!(joined.eq_str("a\nb"));
        assert!(joined.contains(&JsString::from("\nb")));
        assert!(joined.contains(&JsString::default()));
    }
}
