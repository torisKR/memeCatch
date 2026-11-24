//! What lib/db/execute.ts does with a plan value of the wrong type, as
//! JavaScript decides it. The browser chooses every value of a plan, and the
//! TypeScript checks most of them only by coercing them to a string
//! (`IDENT.test(value)`, `` `"${value}"` ``), reading their properties, or
//! testing their truthiness. Each helper here is one of those operations, so
//! a hostile plan is refused (or let through) exactly where the TypeScript
//! refuses it.

use crate::routes::js_json;
use crate::routes::request::{Json, property};

/// A JavaScript value read from the plan: `None` is `undefined` (a missing
/// key).
pub type Value<'a> = Option<&'a Json>;

/// Why compiling or running a plan failed, as `queryError` reports it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PlanError {
    /// `throw new Error("invalid identifier")`: code `42602`, status 400.
    InvalidIdentifier,
    /// Any other JavaScript exception (a `TypeError`, `invalid filter …`):
    /// no code, status 400.
    Thrown,
    /// An error from Postgres or the connection: its SQLSTATE (or node-pg's
    /// connection code) and message.
    Database {
        code: Option<String>,
        message: String,
    },
}

pub type Result<T> = std::result::Result<T, PlanError>;

/// `value[key]`. Reading a property of `null` or `undefined` throws a
/// `TypeError`; every other non-object has none of the names a plan uses.
pub fn get<'a>(value: Value<'a>, key: &str) -> Result<Value<'a>> {
    match value {
        None | Some(Json::Null) => Err(PlanError::Thrown),
        Some(Json::Object(entries)) => Ok(property(entries, key)),
        Some(_) => Ok(None),
    }
}

/// `value ? … : …`.
pub fn truthy(value: Value) -> bool {
    match value {
        None | Some(Json::Null) => false,
        Some(Json::Bool(flag)) => *flag,
        Some(Json::Number(n)) => *n != 0.0 && !n.is_nan(),
        Some(Json::String(text)) => !text.is_empty(),
        Some(Json::Array(_) | Json::Object(_)) => true,
    }
}

/// `String(value)`.
pub fn to_string(value: Value) -> String {
    match value {
        None => "undefined".to_owned(),
        Some(json) => json_to_string(json),
    }
}

fn json_to_string(json: &Json) -> String {
    match json {
        Json::Null => "null".to_owned(),
        Json::Bool(flag) => flag.to_string(),
        Json::Number(n) => js_json::number(*n),
        Json::String(text) => text.clone(),
        // `Array.prototype.join`: null and undefined elements are empty.
        Json::Array(items) => items
            .iter()
            .map(|item| match item {
                Json::Null => String::new(),
                other => json_to_string(other),
            })
            .collect::<Vec<_>>()
            .join(","),
        Json::Object(_) => "[object Object]".to_owned(),
    }
}

/// `/^[a-z_][a-z0-9_]*$/i.test(text)`.
pub fn is_ident_text(text: &str) -> bool {
    let mut bytes = text.bytes();
    let first_ok = bytes
        .next()
        .is_some_and(|b| b.is_ascii_alphabetic() || b == b'_');
    first_ok && bytes.all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

/// `isIdent(value)`: the test runs on `String(value)`.
pub fn is_ident(value: Value) -> bool {
    is_ident_text(&to_string(value))
}

/// `quoteIdent(value)`.
pub fn quote_ident(value: Value) -> Result<String> {
    quote_ident_text(&to_string(value))
}

pub fn quote_ident_text(text: &str) -> Result<String> {
    if is_ident_text(text) {
        Ok(format!("\"{text}\""))
    } else {
        Err(PlanError::InvalidIdentifier)
    }
}

/// The value when it is a string. Where the TypeScript calls a string method
/// (`split`, `trim`, `endsWith`) on anything else, it throws a `TypeError`.
pub fn string_method_target(value: Value<'_>) -> Result<&str> {
    match value {
        Some(Json::String(text)) => Ok(text),
        _ => Err(PlanError::Thrown),
    }
}

/// The value when it is a string, for `Map.get` and `===`, which never
/// coerce.
pub fn as_str(value: Value<'_>) -> Option<&str> {
    match value {
        Some(Json::String(text)) => Some(text),
        _ => None,
    }
}

/// `String.prototype.trim`: the WhiteSpace and LineTerminator code points of
/// ECMAScript, which are not Rust's (`str::trim` also strips U+0085 and
/// keeps U+FEFF).
pub fn trim(text: &str) -> &str {
    let space = |c: char| {
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
    };
    text.trim_matches(space)
}

/// `Object.keys(value)` / `Object.entries(value)` for the `args ?? {}` of an
/// RPC: an object's own entries; a string's characters and an array's
/// elements under their index keys; nothing for a number or a boolean.
pub fn entries(value: Value) -> Vec<(String, Value)> {
    match value {
        None | Some(Json::Null | Json::Bool(_) | Json::Number(_)) => Vec::new(),
        // Index-like keys come first in JavaScript. None of them passes
        // `isIdent`, so where they stand changes nothing but which key is
        // refused first, and every refusal is the same.
        Some(Json::Object(pairs)) => pairs
            .iter()
            .map(|(key, value)| (key.clone(), Some(value)))
            .collect(),
        Some(Json::Array(items)) => items
            .iter()
            .enumerate()
            .map(|(index, item)| (index.to_string(), Some(item)))
            .collect(),
        // One entry per UTF-16 unit; any entry makes the call fail, so one
        // per `char` says the same.
        Some(Json::String(text)) => text
            .chars()
            .enumerate()
            .map(|(index, _)| (index.to_string(), None))
            .collect(),
    }
}

/// `Number.isInteger(value)`, and the value.
pub fn integer(value: Value) -> Option<f64> {
    match value {
        Some(Json::Number(n)) if n.is_finite() && n.fract() == 0.0 => Some(*n),
        _ => None,
    }
}

/// `JSON.stringify(value)` for a value that came from `JSON.parse`.
pub fn stringify(value: &Json) -> String {
    js_json::stringify_parsed(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(text: &str) -> Json {
        Json::parse(text).expect("json")
    }

    #[test]
    fn identifiers_are_tested_on_the_string_javascript_makes() {
        // Each verdict is what isIdent/quoteIdent give for the same value.
        let ident = |text: &str| is_ident(Some(&parse(text)));
        assert!(ident(r#""title""#));
        assert!(ident(r#"["title"]"#));
        assert!(ident(r#"[["title"]]"#));
        assert!(ident("null"));
        assert!(ident("true"));
        assert!(is_ident(None));
        assert!(!ident(r#"["a","b"]"#));
        assert!(!ident("[null]"));
        assert!(!ident("12"));
        assert!(!ident("{}"));
        assert!(!ident(r#""a;b""#));
        assert!(!ident(r#""é""#));
        assert!(!ident(r#""title\n""#));
        assert_eq!(
            quote_ident(Some(&parse(r#"["memes"]"#))),
            Ok("\"memes\"".into())
        );
    }

    #[test]
    fn trim_strips_what_javascript_strips() {
        assert_eq!(trim("\u{feff} id\u{3000}"), "id");
        assert_eq!(trim("id\u{85}"), "id\u{85}");
    }

    #[test]
    fn rpc_args_have_the_keys_object_entries_gives() {
        let keys = |text: &str| -> Vec<String> {
            let json = parse(text);
            entries(Some(&json))
                .into_iter()
                .map(|(key, _)| key)
                .collect()
        };
        assert_eq!(keys(r#"{"b":1,"a":1}"#), ["b", "a"]);
        assert_eq!(keys(r#""ab""#), ["0", "1"]);
        assert_eq!(keys("[7]"), ["0"]);
        assert!(keys("5").is_empty() && keys("null").is_empty() && keys(r#""""#).is_empty());
    }
}
