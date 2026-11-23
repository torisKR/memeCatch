//! The interface strings of the native pages, in the 19 languages of
//! `lib/i18n.ts`. Not translated here: `scripts/build-i18n.mjs` exports the
//! TypeScript dictionaries to `i18n/*.json`, which is embedded at build time,
//! and CI fails when the TypeScript changes without a rerun.
//!
//! A few labels live inside components as small inline tables (the bottom
//! navigation's "home", the header's "latest"); those are in `chrome` next to
//! the markup that uses them, with the component named.

pub mod routing;

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::{Deserialize, Serialize};

const FRAME_JSON: &str = include_str!("../../../i18n/frame.json");
pub const DEFAULT_LOCALE: &str = "ko";
/// `CHAT_LOCALES` in components/meme-chatbot.tsx: the chat panel speaks
/// these, and English elsewhere.
const CHAT_LOCALES: [&str; 5] = ["ko", "en", "ja", "zh", "zh-tw"];
const CHAT_FALLBACK: &str = "en";

#[derive(Deserialize)]
struct FrameJson {
    locales: Vec<LocaleInfo>,
    messages: HashMap<String, Messages>,
    #[serde(rename = "memeCardsNav")]
    meme_cards_nav: HashMap<String, String>,
    chat: HashMap<String, ChatCopy>,
    save: HashMap<String, SaveCopy>,
}

/// `SUPPORTED_LOCALES` with `LANGUAGE_NAMES`, `LANGUAGE_FLAGS`,
/// `LANGUAGE_SHORT_NAMES`, `getDocumentLanguage` and `getDocumentDirection`.
#[derive(Deserialize)]
pub struct LocaleInfo {
    pub code: String,
    pub name: String,
    pub flag: String,
    pub short: String,
    /// `<html lang>`.
    pub lang: String,
    /// `<html dir>`: `ltr` or `rtl`.
    pub dir: String,
}

/// `getMessages(locale)` of lib/i18n.ts, fallbacks applied.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Messages {
    pub brand: String,
    pub home: String,
    pub search: String,
    pub search_placeholder: String,
    pub explore: String,
    pub timeline: String,
    pub community: String,
    pub submit: String,
    pub my: String,
    pub login: String,
    pub saved_memes: String,
    pub logout: String,
    pub greeting: String,
    pub account_menu: String,
    pub random: String,
    pub language: String,
    pub language_menu: String,
    pub footer_nav: String,
    pub about: String,
    pub editorial: String,
    pub guides: String,
    pub privacy: String,
    pub terms: String,
    pub rankings: String,
    pub news: String,
    pub legal_summary: String,
    pub support: String,
    pub legal1: String,
    pub legal2: String,
    pub main_nav: String,
    pub discovery_nav: String,
    pub menu: String,
}

/// `MEME_CHAT_COPY[locale]` of lib/meme-chat-copy.ts.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatCopy {
    pub starter_one: String,
    pub starter_two: String,
    pub starter_three: String,
    pub input_hint: String,
    pub subtitle: String,
    pub launcher_hint: String,
    pub reading: String,
    pub searching: String,
    pub found: String,
    pub no_references: String,
    pub answering: String,
    pub title: String,
    pub open: String,
    pub close: String,
    pub clear: String,
    pub welcome: String,
    pub privacy: String,
    pub disclosure: String,
    pub timeout: String,
    pub question: String,
    pub placeholder: String,
    pub send: String,
    pub pending: String,
    pub generated: String,
    pub retrieved: String,
    pub empty: String,
    pub references: String,
    pub sources: String,
    pub invalid: String,
    pub limited: String,
    pub unavailable: String,
}

/// `SAVE_COPY[locale]` of components/save-button.tsx.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCopy {
    pub login_gate: String,
    pub saved_button: String,
    pub save_button: String,
    pub saved: String,
    pub removed: String,
    pub retry: String,
}

struct Entry {
    info: LocaleInfo,
    messages: Messages,
    meme_cards_nav: String,
    chat_code: &'static str,
    save: SaveCopy,
}

struct Frame {
    entries: Vec<Entry>,
    chat: HashMap<String, ChatCopy>,
}

static FRAME: LazyLock<Frame> = LazyLock::new(|| load(FRAME_JSON));

fn load(json: &str) -> Frame {
    let mut data: FrameJson = serde_json::from_str(json).expect("i18n/frame.json parses");
    let entries = data
        .locales
        .into_iter()
        .map(|info| {
            let code = info.code.as_str();
            let chat_code = CHAT_LOCALES
                .iter()
                .copied()
                .find(|chat| *chat == code)
                .unwrap_or(CHAT_FALLBACK);
            Entry {
                messages: data
                    .messages
                    .remove(code)
                    .expect("messages for every locale"),
                meme_cards_nav: data
                    .meme_cards_nav
                    .remove(code)
                    .expect("memeCardsNav for every locale"),
                save: data.save.remove(code).expect("save copy for every locale"),
                chat_code,
                info,
            }
        })
        .collect();
    Frame {
        entries,
        chat: data.chat,
    }
}

/// One interface language. Cheap to copy.
#[derive(Clone, Copy)]
pub struct Locale(&'static Entry);

impl Locale {
    /// `isLocale`: one of the 19 codes, exactly.
    pub fn get(code: &str) -> Option<Self> {
        FRAME
            .entries
            .iter()
            .find(|entry| entry.info.code == code)
            .map(Self)
    }

    pub fn korean() -> Self {
        Self::get(DEFAULT_LOCALE).expect("Korean is a locale")
    }

    /// Every locale, in the order of `SUPPORTED_LOCALES`.
    pub fn all() -> impl Iterator<Item = Self> {
        FRAME.entries.iter().map(Self)
    }

    pub fn code(self) -> &'static str {
        &self.0.info.code
    }

    pub fn info(self) -> &'static LocaleInfo {
        &self.0.info
    }

    pub fn messages(self) -> &'static Messages {
        &self.0.messages
    }

    /// `MEME_CARDS_COPY[locale].nav` of lib/i18n-meme-cards.ts.
    pub fn meme_cards_nav(self) -> &'static str {
        &self.0.meme_cards_nav
    }

    pub fn save(self) -> &'static SaveCopy {
        &self.0.save
    }

    /// The language the chat panel answers in, and its copy.
    pub fn chat(self) -> (&'static str, &'static ChatCopy) {
        let code = self.0.chat_code;
        (code, &FRAME.chat[code])
    }

    pub fn is_korean(self) -> bool {
        self.code() == DEFAULT_LOCALE
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_locale_has_every_string_and_the_right_direction() {
        let codes: Vec<&str> = Locale::all().map(Locale::code).collect();
        assert_eq!(
            codes,
            [
                "ko", "en", "ja", "zh", "zh-tw", "th", "vi", "mn", "id", "ar", "ru", "es", "de",
                "fr", "it", "pt", "tr", "ms", "hi"
            ]
        );
        for locale in Locale::all() {
            let expected = if locale.code() == "ar" { "rtl" } else { "ltr" };
            assert_eq!(locale.info().dir, expected, "{}", locale.code());
            assert!(!locale.messages().login.is_empty());
        }
        let korean = Locale::korean();
        assert_eq!(korean.messages().login, "로그인");
        assert_eq!(korean.info().lang, "ko");
        assert_eq!(
            Locale::get("zh").map(|l| l.info().lang.as_str()),
            Some("zh-Hans")
        );
        assert!(Locale::get("xx").is_none());
        assert!(Locale::get("KO").is_none());
    }

    #[test]
    fn the_chat_falls_back_to_english_and_saving_to_its_fallbacks() {
        let arabic = Locale::get("ar").expect("ar");
        assert_eq!(arabic.chat().0, "en");
        assert_eq!(arabic.chat().1.open, FRAME.chat["en"].open);
        assert_eq!(Locale::get("zh-tw").map(|l| l.chat().0), Some("zh-tw"));
        assert_eq!(arabic.save().save_button, "Save this meme");
        assert_eq!(
            Locale::get("zh-tw").map(|l| l.save().saved_button.as_str()),
            Some("已收藏")
        );
        assert_eq!(Locale::korean().save().save_button, "이 밈 저장하기");
    }
}
