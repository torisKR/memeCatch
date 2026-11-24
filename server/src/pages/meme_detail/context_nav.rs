//! `components/context-nav.tsx`: "← 이전 · 2020년대 밈 모음 (7/24) · 다음 →"
//! at the top of a meme opened from a collection, from the query the
//! collection's links carry (`?ctx=&prev=&next=&i=&total=`), rendered into
//! the document.

use maud::{Markup, html};

use crate::pages::collections::collection_title;
use crate::routes::js_json;
use crate::routes::public::js;

/// `Number(text)` for a string: JavaScript's StringToNumber.
fn js_number(text: &str) -> f64 {
    let text = js::trim(text);
    if text.is_empty() {
        return 0.0;
    }
    match text {
        "Infinity" | "+Infinity" => return f64::INFINITY,
        "-Infinity" => return f64::NEG_INFINITY,
        _ => {}
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
            return u128::from_str_radix(digits, radix).map_or(f64::NAN, |value| value as f64);
        }
    }
    // Rust also reads "inf" and "nan", which JavaScript does not.
    if !text
        .bytes()
        .all(|b| b.is_ascii_digit() || matches!(b, b'+' | b'-' | b'.' | b'e' | b'E'))
    {
        return f64::NAN;
    }
    text.parse().unwrap_or(f64::NAN)
}

/// `URLSearchParams.get`.
fn get<'a>(pairs: &'a [(String, String)], name: &str) -> Option<&'a str> {
    pairs
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
}

pub fn nav(pairs: &[(String, String)]) -> Markup {
    let Some(ctx) = get(pairs, "ctx").filter(|ctx| !ctx.is_empty()) else {
        return html! {};
    };
    let Some(title) = collection_title(ctx) else {
        return html! {};
    };
    // Only paths of this site's meme pages: no outside URL gets in.
    let safe = |name| get(pairs, name).filter(|path| path.starts_with("/memes/"));
    let (prev, next) = (safe("prev"), safe("next"));
    if prev.is_none() && next.is_none() {
        return html! {};
    }
    let index = get(pairs, "i").filter(|value| !value.is_empty());
    let total = get(pairs, "total").filter(|value| !value.is_empty());
    let (i, n) = (
        index.map_or(f64::NAN, js_number),
        total.map_or(f64::NAN, js_number),
    );
    let progress = (i.is_finite() && n.is_finite() && n > 0.0)
        .then(|| js_json::number((i / n * 100.0).clamp(0.0, 100.0)));
    html! {
        nav aria-label=(format!("{title} 이어보기")) class="relative flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" {
            @if let Some(prev) = prev {
                a class="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-muted transition-colors hover:text-foreground" href=(prev) data-context-nav="prev" data-context=(ctx) {
                    span aria-hidden="true" { "←" } " 이전"
                }
            } @else {
                span {}
            }
            a class="min-w-0 truncate text-center font-medium text-muted transition-colors hover:text-foreground" href=(format!("/collections/{ctx}")) {
                (title)
                @if let (Some(index), Some(total)) = (index, total) {
                    span class="ml-1 tabular-nums text-xs" { "(" (index) "/" (total) ")" }
                }
            }
            @if let Some(next) = next {
                a class="hover-glow-flame inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-accent transition-colors hover:text-foreground" href=(next) data-context-nav="next" data-context=(ctx) {
                    "다음 " span aria-hidden="true" { "→" }
                }
            } @else {
                span {}
            }
            @if let Some(width) = progress {
                span aria-hidden="true" class="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-signal-cyan-soft" {
                    span class="block h-full rounded-full bg-signal-cyan" style=(format!("width:{width}%")) {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_read_as_javascript_reads_a_query_value() {
        assert_eq!(js_number(" 7 "), 7.0);
        assert_eq!(js_number(""), 0.0);
        assert_eq!(js_number("0x10"), 16.0);
        assert_eq!(js_number("1e1"), 10.0);
        assert!(js_number("inf").is_nan());
        assert!(js_number("7a").is_nan());
        assert_eq!(js_number("-Infinity"), f64::NEG_INFINITY);
        assert_eq!(js_json::number(1.0 / 3.0 * 100.0), "33.33333333333333");
    }
}
