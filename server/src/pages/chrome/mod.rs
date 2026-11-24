//! The frame around every native page: what `app/_root/root-document.tsx`
//! puts on every page, in any of the 19 languages. Transcribed from what Next
//! renders (`scripts/html-to-maud.mjs`), so the class lists are the ones
//! `app/globals.css` and Tailwind already style.
//!
//! The markup is complete without script. `ui/*.js` adds the behaviour and
//! reads its inputs from `data-*` attributes; markup a script shows later
//! (the account menu, the sign-in dialog, the install prompt) is here too, in
//! `<template>` elements. Each part carries `data-frame="<part>"`: the
//! language switch swaps those parts for the ones `fragment` renders.

pub mod chat;
pub mod footer;
pub mod header;
pub mod overlays;

use maud::{Markup, PreEscaped, html};
use serde_json::{Value, json};

use super::i18n::Locale;

/// What the frame depends on: the language and the page it is around.
#[derive(Clone, Copy)]
pub struct Frame<'a> {
    pub locale: Locale,
    /// The path as requested, still percent-encoded, with its query.
    pub path_and_query: &'a str,
}

impl Frame<'_> {
    /// `usePathname()`: the path without its query.
    pub fn pathname(&self) -> &str {
        self.path_and_query
            .split_once('?')
            .map_or(self.path_and_query, |(path, _)| path)
    }
}

/// Everything the language switch replaces, as `ui/locale.js` reads it.
pub fn fragment(frame: &Frame) -> Value {
    let info = frame.locale.info();
    let mut fragment = json!({
        "lang": info.lang,
        "dir": info.dir,
        "parts": {
            "header": header::header(frame).into_string(),
            "footer": footer::footer(frame).into_string(),
            "bottom-nav": footer::bottom_nav(frame).into_string(),
            "chat": chat::chat(frame).into_string(),
        },
        "save": frame.locale.save(),
        "locale": frame.locale.code(),
        "export": frame.locale.export_copy(),
    });
    // The copy of a page that changes with the frame (`account::copy`).
    if let Some(copy) = super::account::copy::page_copy(frame.path_and_query, frame.locale.code()) {
        fragment["page"] = copy;
    }
    fragment
}

/// A lucide icon as lucide-react renders it. `children` is trusted markup:
/// a constant of this module.
fn lucide(name: &str, class: &str, stroke_width: &str, children: &'static str) -> Markup {
    html! {
        svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=(stroke_width) stroke-linecap="round" stroke-linejoin="round" class=(format!("lucide lucide-{name} {class}")) aria-hidden="true" {
            (PreEscaped(children))
        }
    }
}

/// `components/brand-mark.tsx` `BrandTile`.
pub(crate) fn brand_tile(size: &str) -> Markup {
    html! {
        span aria-hidden="true" class=(format!("inline-grid shrink-0 place-items-center rounded-[30%] bg-accent {size}")) {
            svg viewBox="0 0 64 64" class="h-[74%] w-[74%]" fill="none" {
                path d="M 37.4 11.7 A 21 21 0 1 0 52.9 33.8" stroke="#FFF9F5" stroke-width="10" stroke-linecap="round" {}
                circle cx="49.2" cy="20" r="6" fill="#FFF9F5" {}
                path fill="#FFF9F5" d="M14.5 44.5 10.5 58.5 25.5 53.5Z" {}
            }
        }
    }
}

/// `aria-current="page"` where a component sets it.
fn current(active: bool) -> Option<&'static str> {
    active.then_some("page")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_fragment_carries_the_language_and_every_part() {
        let arabic = Locale::get("ar").expect("ar");
        let frame = Frame {
            locale: arabic,
            path_and_query: "/about?x=1",
        };
        assert_eq!(frame.pathname(), "/about");
        let value = fragment(&frame);
        assert_eq!(value["lang"], "ar");
        assert_eq!(value["dir"], "rtl");
        for part in ["header", "footer", "bottom-nav", "chat"] {
            let html = value["parts"][part].as_str().expect(part);
            assert!(html.contains(&format!("data-frame=\"{part}\"")), "{part}");
        }
        let header = value["parts"]["header"].as_str().expect("header");
        assert!(header.contains("تسجيل الدخول"));
        assert_eq!(value["save"]["saveButton"], "Save this meme");
    }
}
