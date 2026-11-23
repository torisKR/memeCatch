//! The parts of `lib/labels.ts`, `lib/site.ts` and `lib/i18n-routing.ts` the
//! text routes print: category and safety wording, the locales that have
//! translated content, and the path of a meme page.

use super::js;

/// `CONTACT_EMAIL` in lib/site.ts.
pub const CONTACT_EMAIL: &str = "toris@toris.kr";

/// `SEO_CONTENT_LOCALES` in lib/i18n-routing.ts, in its order.
pub const SEO_CONTENT_LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];

/// `DISPLAY_CATEGORY_LIST`: key, wording, and the `memes.category` values it
/// covers. The first entry is `AI_MEME_DISPLAY_CATEGORY`.
pub const DISPLAY_CATEGORIES: [(&str, &str, &[&str]); 6] = [
    ("ai-meme", "AI 밈", &["phrase", "image"]),
    ("meme_term", "밈 용어(유행어)", &["phrase"]),
    ("challenge_dance", "챌린지 댄스", &["dance", "challenge"]),
    ("song", "노래", &["song"]),
    ("drama_scene", "드라마 장면", &["comment"]),
    ("meme_video", "밈 영상", &["image"]),
];

/// `SAFETY_LEVELS`: key, icon and wording, in the order of the object.
pub const SAFETY_LEVELS: [(&str, &str, &str); 4] = [
    ("green", "●", "써도 됨"),
    ("yellow", "▲", "맥락 주의"),
    ("gray", "◌", "이미 늦음"),
    ("red", "✕", "쓰면 위험"),
];

/// `CATEGORIES[category]?.user`.
pub fn category_label(category: &str) -> Option<&'static str> {
    Some(match category {
        "phrase" => "밈 용어(유행어)",
        "dance" | "challenge" => "챌린지 댄스",
        "song" => "노래",
        "image" => "밈 영상",
        "comment" => "드라마 장면",
        _ => return None,
    })
}

/// `memePathFrom` in lib/labels.ts.
pub fn meme_path(short_id: &str, slug: &str) -> String {
    format!("/memes/{short_id}-{}", js::encode_uri_component(slug))
}

/// `SITE_URL` in lib/site.ts for a raw `NEXT_PUBLIC_SITE_URL` (or its
/// default): `.replace(/\/+$/, "")`.
pub fn site_url(raw: &str) -> &str {
    raw.trim_end_matches('/')
}

/// `value.toLocaleString("en-US")` for a count: groups of three with commas.
pub fn en_us_count(value: usize) -> String {
    let digits = value.to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            out.push(',');
        }
        out.push(digit);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meme_path_percent_encodes_the_slug_only() {
        assert_eq!(
            meme_path("rk3w632x", "중꺾마 밈"),
            "/memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88%20%EB%B0%88"
        );
    }

    // Expected values are what Node prints for n.toLocaleString("en-US").
    #[test]
    fn counts_are_grouped_like_to_locale_string() {
        for (value, expected) in [
            (0, "0"),
            (48, "48"),
            (999, "999"),
            (1_000, "1,000"),
            (12_345, "12,345"),
            (1_234_567, "1,234,567"),
        ] {
            assert_eq!(en_us_count(value), expected);
        }
    }

    #[test]
    fn site_url_loses_every_trailing_slash() {
        assert_eq!(
            site_url("https://catchmeme.com///"),
            "https://catchmeme.com"
        );
        assert_eq!(site_url("https://catchmeme.com"), "https://catchmeme.com");
        assert_eq!(site_url(""), "");
    }
}
