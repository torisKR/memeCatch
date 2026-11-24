//! `markdown::markdown_body` against the app's real `MarkdownBody`. No
//! database needed.
//!
//! `fixtures/markdown.json` holds what components/markdown-body.tsx renders
//! under Node for each body in it. A body that renderer could not render
//! (it overflows the stack) is marked `throws`; this one must still finish,
//! in bounded time.

use std::time::{Duration, Instant};

use memecatch_server::markdown::markdown_body;
use serde::Deserialize;
use sha2::{Digest, Sha256};

#[derive(Deserialize)]
struct Fixture {
    cases: Vec<Case>,
    generated: Vec<Generated>,
}

#[derive(Deserialize)]
struct Case {
    name: String,
    body: String,
    html: Option<String>,
    throws: Option<String>,
}

#[derive(Deserialize)]
struct Generated {
    name: String,
    prefix: String,
    unit: String,
    times: usize,
    suffix: String,
    sha256: Option<String>,
    throws: Option<String>,
}

/// Generous for a debug build: the renderer's own deadline is 250 ms.
const TIME_LIMIT: Duration = Duration::from_secs(3);

fn fixture() -> Fixture {
    serde_json::from_str(include_str!("fixtures/markdown.json")).unwrap()
}

/// `html` without the links GFM makes of bare URLs, `www.` hosts and email
/// addresses (an email's is a `span`: the sanitizer drops `mailto:`).
fn without_autolinks(html: &str) -> String {
    const OPEN: &str = "<a href=\"";
    const REST: &str = "\" target=\"_blank\" rel=\"noopener noreferrer nofollow\" class=\"break-words font-semibold text-accent underline underline-offset-2 hover:opacity-80\">";
    let mut out = String::new();
    let mut rest = html;
    loop {
        let link = rest.find(OPEN);
        let span = rest.find("<span>");
        let Some(at) = [link, span].into_iter().flatten().min() else {
            out.push_str(rest);
            return out;
        };
        out.push_str(&rest[..at]);
        let tail = &rest[at..];
        let parsed = if Some(at) == link {
            tail[OPEN.len()..]
                .split_once(REST)
                .and_then(|(href, after)| {
                    let (label, after) = after.split_once("</a>")?;
                    let literal = label == href || format!("http://{label}") == href;
                    (literal && !label.contains('<')).then_some((label, after))
                })
        } else {
            tail["<span>".len()..]
                .split_once("</span>")
                .filter(|(label, _)| label.contains('@') && !label.contains('<'))
        };
        match parsed {
            Some((label, after)) => {
                out.push_str(label);
                rest = after;
            }
            None => {
                out.push_str(&tail[..1]);
                rest = &tail[1..];
            }
        }
    }
}

/// The two differences PLAN.md B6-21 records, each matched exactly:
/// comrak makes no link of a bare URL after an unmatched `[` or `![` in
/// the same paragraph (micromark does), and keeps a space for a code span
/// that holds only a line ending (micromark keeps nothing).
fn recorded_difference(body: &str, expected: &str, actual: &str) -> Option<&'static str> {
    if body.contains('[') && without_autolinks(expected) == without_autolinks(actual) {
        return Some("autolink after an open bracket");
    }
    let code = r#"<code class="rounded bg-surface-2 px-1.5 py-0.5 text-[0.9em]">"#;
    if body.contains("`\n`")
        && expected.replace(&format!("{code}</code>"), &format!("{code} </code>")) == actual
    {
        return Some("code span of a line ending");
    }
    None
}

#[test]
fn every_body_renders_as_the_component_renders_it() {
    let mut differing = Vec::new();
    let mut recorded = Vec::new();
    for case in fixture().cases {
        let html = markdown_body(&case.body, "");
        match (&case.html, &case.throws) {
            (Some(expected), _) if &html != expected => {
                if let Some(kind) = recorded_difference(&case.body, expected, &html) {
                    recorded.push(format!("{}: {kind}", case.name));
                    continue;
                }
                differing.push(format!(
                    "{}\n  body:     {:?}\n  expected: {expected:?}\n  actual:   {html:?}",
                    case.name, case.body
                ));
            }
            (None, Some(_)) => assert!(html.starts_with("<div"), "{}", case.name),
            _ => {}
        }
    }
    assert!(
        differing.is_empty(),
        "{} of the bodies differ:\n{}",
        differing.len(),
        differing.join("\n")
    );
    // A handful, all named: a new kind of difference fails above.
    assert!(recorded.len() <= 8, "recorded differences: {recorded:#?}");
}

#[test]
fn the_recorded_differences_are_what_they_say() {
    let link = |href: &str, label: &str| {
        format!(
            r#"<a href="{href}" target="_blank" rel="noopener noreferrer nofollow" class="break-words font-semibold text-accent underline underline-offset-2 hover:opacity-80">{label}</a>"#
        )
    };
    let expected = format!("[ {}", link("http://www.example.com", "www.example.com"));
    assert_eq!(
        recorded_difference("[ www.example.com", &expected, "[ www.example.com"),
        Some("autolink after an open bracket")
    );
    // Any other link missing is a difference of its own.
    let other = format!("[ {}", link("https://example.com/b", "b"));
    assert_eq!(recorded_difference("[ b", &other, "[ b"), None);
    assert_eq!(
        recorded_difference("www.example.com", &expected, "[ www.example.com"),
        None
    );
    let actual = markdown_body("[ www.example.com", "");
    assert!(actual.contains("[ www.example.com</p>"), "{actual}");
}

#[test]
fn huge_and_hostile_bodies_render_in_bounded_time() {
    for case in fixture().generated {
        let body = format!(
            "{}{}{}",
            case.prefix,
            case.unit.repeat(case.times),
            case.suffix
        );
        let started = Instant::now();
        let html = markdown_body(&body, "");
        let took = started.elapsed();
        assert!(took < TIME_LIMIT, "{} took {took:?}", case.name);
        assert!(
            html.len() < body.len() * 40 + 4096,
            "{}: {} bytes",
            case.name,
            html.len()
        );
        if let (Some(expected), None) = (&case.sha256, &case.throws) {
            let actual = hex::encode(Sha256::digest(html.as_bytes()));
            assert_eq!(&actual, expected, "{}", case.name);
        }
    }
}

#[test]
fn the_wrapper_takes_the_callers_class() {
    assert_eq!(
        markdown_body("a", "mt-4"),
        r#"<div class="break-words text-base leading-relaxed mt-4"><p class="my-3 leading-relaxed first:mt-0 last:mb-0">a</p></div>"#
    );
}
