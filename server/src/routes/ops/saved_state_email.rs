//! The email of a saved-state change: `savedStatePayload` and
//! `buildSavedStateChangeEmail` of `lib/trend/outbox.server.ts`, and the JSON
//! body the delivery provider receives.
//!
//! The text is built in UTF-16, as JavaScript strings are. The title is cut
//! to 200 code units (`slice(0, 200)`), which can split a surrogate pair;
//! `JSON.stringify` then writes the lone half as `\udXXX`, and so does
//! [`json_string`].

use serde_json::Value;
use url::Url;

use crate::routes::public::js;

const TITLE_UNITS: usize = 200;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Locale {
    Ko,
    En,
    Ja,
    Zh,
    ZhTw,
}

impl Locale {
    fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "ko" => Self::Ko,
            "en" => Self::En,
            "ja" => Self::Ja,
            "zh" => Self::Zh,
            "zh-tw" => Self::ZhTw,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Payload {
    /// Trimmed and cut to 200 UTF-16 code units.
    title: Vec<u16>,
    short_id: String,
    old_state: String,
    new_state: String,
    locale: Locale,
}

/// `savedStatePayload(value)`: `None` is `invalid_payload`.
pub fn payload(value: &Value) -> Option<Payload> {
    let input = value.as_object()?;
    let text = |key: &str| input.get(key).and_then(Value::as_str);
    let title = js::trim(text("title")?);
    let short_id = text("short_id")?;
    let locale = Locale::parse(text("locale")?)?;
    if title.is_empty() || !is_short_id(short_id) {
        return None;
    }
    let mut title: Vec<u16> = title.encode_utf16().collect();
    title.truncate(TITLE_UNITS);
    Some(Payload {
        title,
        short_id: short_id.to_owned(),
        old_state: text("old_state")?.to_owned(),
        new_state: text("new_state")?.to_owned(),
        locale,
    })
}

/// `/^[a-zA-Z0-9-]{1,80}$/`.
fn is_short_id(value: &str) -> bool {
    (1..=80).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

/// `{ subject, text, html }`, each in UTF-16.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Email {
    pub subject: Vec<u16>,
    pub text: Vec<u16>,
    pub html: Vec<u16>,
}

/// What the outbox records when a state names a property every object
/// inherits (TypeScript bug, ported): `STATE_LABELS[locale][state]` is then a
/// function or `Object.prototype`, not a string, and `escapeHtml` throws on
/// it. The text is the `TypeError` of the minified TypeScript build, which
/// names the parameter of `escapeHtml` `a`.
pub const INHERITED_LABEL_ERROR: &str = "a.replaceAll is not a function";

/// `buildSavedStateChangeEmail(payload)`. `site` is `SITE_URL`. `Err` is the
/// message the dispatcher's failure records.
pub fn build(payload: &Payload, site: &Url) -> Result<Email, String> {
    let (Some(old_state), Some(new_state)) = (
        label(payload.locale, &payload.old_state),
        label(payload.locale, &payload.new_state),
    ) else {
        return Err(INHERITED_LABEL_ERROR.to_owned());
    };
    let (old_state, new_state) = (utf16(&old_state), utf16(&new_state));
    // `new URL(`/memes/${shortId}`, SITE_URL)` and `searchParams.set`.
    let mut url = site
        .join(&format!("/memes/{}", payload.short_id))
        .expect("an absolute path joins any base");
    url.set_query(Some("source=saved_state_email"));
    let url = utf16(url.as_str());
    let title = &payload.title;
    let subject_prefix = match payload.locale {
        Locale::Ko => "저장한 밈 상태 변경: ",
        _ => "Saved meme update: ",
    };
    let arrow = utf16(" → ");
    let newline = utf16("\n");
    let subject = [utf16(subject_prefix).as_slice(), title].concat();
    let text = [
        title.as_slice(),
        &newline,
        &old_state,
        &arrow,
        &new_state,
        &newline,
        &url,
    ]
    .concat();
    let html = [
        utf16("<p><strong>").as_slice(),
        &escape_html(title),
        &utf16("</strong></p><p>"),
        &escape_html(&old_state),
        &arrow,
        &escape_html(&new_state),
        &utf16("</p><p><a href=\""),
        &escape_html(&url),
        &utf16("\">"),
        &escape_html(&url),
        &utf16("</a></p>"),
    ]
    .concat();
    Ok(Email {
        subject,
        text,
        html,
    })
}

/// The body `JSON.stringify({ from, to: [recipient], ...email, idempotencyKey,
/// metadata: { outboxId, topic } })` writes.
pub fn request_body(
    from: &str,
    recipient: &str,
    email: &Email,
    outbox_id: &str,
    topic: &str,
) -> String {
    let mut body = String::from("{\"from\":");
    json_string(&utf16(from), &mut body);
    body.push_str(",\"to\":[");
    json_string(&utf16(recipient), &mut body);
    body.push_str("],\"subject\":");
    json_string(&email.subject, &mut body);
    body.push_str(",\"text\":");
    json_string(&email.text, &mut body);
    body.push_str(",\"html\":");
    json_string(&email.html, &mut body);
    body.push_str(",\"idempotencyKey\":");
    json_string(&utf16(outbox_id), &mut body);
    body.push_str(",\"metadata\":{\"outboxId\":");
    json_string(&utf16(outbox_id), &mut body);
    body.push_str(",\"topic\":");
    json_string(&utf16(topic), &mut body);
    body.push_str("}}");
    body
}

/// `STATE_LABELS[locale][state] ?? state`. The labels are a plain object, so
/// a state named like a property of `Object.prototype` finds that property:
/// `None` (see [`INHERITED_LABEL_ERROR`]).
fn label(locale: Locale, state: &str) -> Option<String> {
    let own = match (locale, state) {
        (Locale::Ko, "candidate") => "관찰 중",
        (Locale::Ko, "rising") => "급상승",
        (Locale::Ko, "trending") => "유행 중",
        (Locale::Ko, "cooling") => "식는 중",
        (Locale::Ko, "archive") => "보관",
        (Locale::En, "candidate") => "Candidate",
        (Locale::En, "rising") => "Rising",
        (Locale::En, "trending") => "Trending",
        (Locale::En, "cooling") => "Cooling",
        (Locale::En, "archive") => "Archive",
        (Locale::Ja, "candidate") => "観察中",
        (Locale::Ja, "rising") => "急上昇",
        (Locale::Ja, "trending") => "トレンド中",
        (Locale::Ja, "cooling") => "下降中",
        (Locale::Ja, "archive") => "アーカイブ",
        (Locale::Zh, "candidate") => "观察中",
        (Locale::Zh, "rising") => "上升",
        (Locale::Zh, "trending") => "流行中",
        (Locale::Zh, "cooling") => "降温",
        (Locale::Zh, "archive") => "归档",
        (Locale::ZhTw, "candidate") => "觀察中",
        (Locale::ZhTw, "rising") => "上升",
        (Locale::ZhTw, "trending") => "流行中",
        (Locale::ZhTw, "cooling") => "降溫",
        (Locale::ZhTw, "archive") => "封存",
        _ if INHERITED.contains(&state) => return None,
        _ => state,
    };
    Some(own.to_owned())
}

/// The properties of `Object.prototype` (`Object.getOwnPropertyNames`).
const INHERITED: [&str; 12] = [
    "constructor",
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
    "__proto__",
    "toLocaleString",
];

fn utf16(text: &str) -> Vec<u16> {
    text.encode_utf16().collect()
}

/// `escapeHtml`: `& < > " '`, in that order of replacement (the order does
/// not change the result).
fn escape_html(units: &[u16]) -> Vec<u16> {
    let mut out = Vec::with_capacity(units.len());
    for &unit in units {
        let entity = match unit {
            0x26 => "&amp;",
            0x3c => "&lt;",
            0x3e => "&gt;",
            0x22 => "&quot;",
            0x27 => "&#39;",
            _ => {
                out.push(unit);
                continue;
            }
        };
        out.extend(entity.encode_utf16());
    }
    out
}

/// A string as `JSON.stringify` quotes it: `"` and `\` escaped, the short
/// escapes for backspace, form feed, newline, return and tab, `\u00xx` for
/// the other controls, `\udxxx` for a lone surrogate, everything else as is.
pub fn json_string(units: &[u16], out: &mut String) {
    out.push('"');
    for item in char::decode_utf16(units.iter().copied()) {
        match item {
            Ok('"') => out.push_str("\\\""),
            Ok('\\') => out.push_str("\\\\"),
            Ok('\u{8}') => out.push_str("\\b"),
            Ok('\u{c}') => out.push_str("\\f"),
            Ok('\n') => out.push_str("\\n"),
            Ok('\r') => out.push_str("\\r"),
            Ok('\t') => out.push_str("\\t"),
            Ok(control) if control < ' ' => {
                out.push_str(&format!("\\u{:04x}", u32::from(control)));
            }
            Ok(other) => out.push(other),
            Err(lone) => out.push_str(&format!("\\u{:04x}", lone.unpaired_surrogate())),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn site() -> Url {
        Url::parse("https://catchmeme.com").expect("url")
    }

    fn text(units: &[u16]) -> String {
        String::from_utf16_lossy(units)
    }

    // Expected values are what lib/trend/outbox.server.ts gives under Node.
    #[test]
    fn builds_the_korean_email() {
        let value = json!({"title": "  <공>&\"'  ", "short_id": "ab-1", "old_state": "rising",
            "new_state": "unknown", "locale": "ko"});
        let email = build(&payload(&value).expect("valid"), &site()).expect("built");
        assert_eq!(text(&email.subject), "저장한 밈 상태 변경: <공>&\"'");
        assert_eq!(
            text(&email.text),
            "<공>&\"'\n급상승 → unknown\nhttps://catchmeme.com/memes/ab-1?source=saved_state_email"
        );
        assert_eq!(
            text(&email.html),
            "<p><strong>&lt;공&gt;&amp;&quot;&#39;</strong></p><p>급상승 → unknown</p><p><a href=\"https://catchmeme.com/memes/ab-1?source=saved_state_email\">https://catchmeme.com/memes/ab-1?source=saved_state_email</a></p>"
        );
    }

    #[test]
    fn a_state_named_like_an_inherited_property_fails_as_the_typescript_does() {
        for state in ["toString", "constructor", "__proto__", "valueOf"] {
            for (old_state, new_state) in [(state, "rising"), ("rising", state)] {
                let value = json!({"title": "t", "short_id": "a", "old_state": old_state,
                    "new_state": new_state, "locale": "en"});
                assert_eq!(
                    build(&payload(&value).expect("valid"), &site()),
                    Err(INHERITED_LABEL_ERROR.to_owned()),
                    "{old_state} -> {new_state}"
                );
            }
        }
    }

    #[test]
    fn refuses_what_saved_state_payload_refuses() {
        let good = json!({"title": "t", "short_id": "a", "old_state": "x", "new_state": "y", "locale": "en"});
        assert!(payload(&good).is_some());
        for (key, bad) in [
            ("title", json!("   ")),
            ("title", json!(1)),
            ("short_id", json!("")),
            ("short_id", json!("a_b")),
            ("short_id", json!("a".repeat(81))),
            ("old_state", json!(null)),
            ("locale", json!("fr")),
        ] {
            let mut value = good.clone();
            value[key] = bad;
            assert!(payload(&value).is_none(), "{key}");
        }
        assert!(payload(&json!([good])).is_none());
    }

    #[test]
    fn cuts_the_title_inside_a_surrogate_pair_as_javascript_does() {
        let title = format!("{}😀", "a".repeat(199));
        let value = json!({"title": title, "short_id": "a", "old_state": "x", "new_state": "y", "locale": "en"});
        let email = build(&payload(&value).expect("valid"), &site()).expect("built");
        let body = request_body("f@x", "t@x", &email, "id", "topic");
        // JSON.stringify(`Saved meme update: ${"a".repeat(199)}\ud83d`)
        assert!(
            body.contains(&format!(
                "\"subject\":\"Saved meme update: {}\\ud83d\"",
                "a".repeat(199)
            )),
            "{body}"
        );
    }

    #[test]
    fn quotes_strings_as_json_stringify() {
        let mut out = String::new();
        json_string(
            &utf16("a\"\\\u{8}\u{c}\n\r\t\u{1}\u{7f}\u{2028}/é"),
            &mut out,
        );
        assert_eq!(out, "\"a\\\"\\\\\\b\\f\\n\\r\\t\\u0001\u{7f}\u{2028}/é\"");
    }

    #[test]
    fn writes_the_provider_body_in_the_typescript_key_order() {
        let value = json!({"title": "T", "short_id": "s", "old_state": "x", "new_state": "archive", "locale": "zh-tw"});
        let email = build(&payload(&value).expect("valid"), &site()).expect("built");
        assert_eq!(
            request_body("from@x", "to@x", &email, "o-1", "saved_state"),
            "{\"from\":\"from@x\",\"to\":[\"to@x\"],\"subject\":\"Saved meme update: T\",\"text\":\"T\\nx → 封存\\nhttps://catchmeme.com/memes/s?source=saved_state_email\",\"html\":\"<p><strong>T</strong></p><p>x → 封存</p><p><a href=\\\"https://catchmeme.com/memes/s?source=saved_state_email\\\">https://catchmeme.com/memes/s?source=saved_state_email</a></p>\",\"idempotencyKey\":\"o-1\",\"metadata\":{\"outboxId\":\"o-1\",\"topic\":\"saved_state\"}}"
        );
    }
}
