//! The locale default card (`lib/og-default-card.tsx` with
//! `lib/og-default-image.ts`): the logo chip and wordmark over one or two
//! title lines, centered on 1200×630. Arabic is the committed PNG, served as it
//! is (`assets/og/ar.png`).

use super::font::Font;
use super::text::{LineHeight, TextLine};
use super::{pixel, rounded_rect, svg_open};

pub const WIDTH: f64 = 1200.0;
pub const HEIGHT: f64 = 630.0;
const BACKGROUND: &str = "#131316";
const FOREGROUND: &str = "#f0efec";
const ACCENT: &str = "#F74610";
const LOGO_SIZE: f64 = 56.0;
const LOGO_RADIUS: f64 = 16.0;
const LOGO_ICON: f64 = 38.0;
const WORDMARK_SIZE: f64 = 36.0;
const WORDMARK_GAP: f64 = 16.0;
const TITLE_SIZE: f64 = 64.0;
const TITLE_LINE_HEIGHT: f64 = 1.2;
const TITLE_GAP: f64 = 28.0;

/// The `<svg>` child as Satori embeds it: the icon of the chip.
const ICON_HREF: &str = "data:image/svg+xml;utf8,%3Csvg  fill=%22none%22 xmlns=%22http://www.w3.org/2000/svg%22 width=%2238%22 height=%2238%22 viewBox=%220 0 64 64%22%3E%3Cpath d=%22M 37.4 11.7 A 21 21 0 1 0 52.9 33.8%22 stroke=%22%23FFF9F5%22 stroke-width=%2210%22 stroke-linecap=%22round%22%3E%3C/path%3E%3Ccircle cx=%2249.2%22 cy=%2220%22 r=%226%22 fill=%22%23FFF9F5%22%3E%3C/circle%3E%3Cpath fill=%22%23FFF9F5%22 d=%22M14.5 44.5 10.5 58.5 25.5 53.5Z%22%3E%3C/path%3E%3C/svg%3E";

pub const AR_PNG: &[u8] = include_bytes!("../../assets/og/ar.png");

/// `OG_DEFAULT_LOCALES` and the painted lines of `OG_DEFAULT_COPY`.
pub const LOCALES: [(&str, &[&str]); 5] = [
    ("ko", &["밈캐치 — 그 밈,", "3초 안에 알려드려요"]),
    ("en", &["Korean Memes", "Explained"]),
    ("ja", &["韓国ミームを", "わかりやすく解説"]),
    ("zh", &["看懂韩国网络迷因"]),
    ("zh-tw", &["看懂韓國網路迷因"]),
];

/// The per-locale subset fonts of `assets/og-fonts`.
pub fn font_bytes(locale: &str) -> Option<&'static [u8]> {
    Some(match locale {
        "ko" => include_bytes!("../../assets/og/ko.ttf"),
        "en" => include_bytes!("../../assets/og/en.ttf"),
        "ja" => include_bytes!("../../assets/og/ja.ttf"),
        "zh" => include_bytes!("../../assets/og/zh.ttf"),
        "zh-tw" => include_bytes!("../../assets/og/zh-tw.ttf"),
        _ => return None,
    })
}

/// The card's SVG, `None` for a locale without one (Arabic included).
pub fn svg(locale: &str) -> Option<String> {
    let (_, lines) = LOCALES.iter().find(|(code, _)| *code == locale)?;
    let font = Font::new(font_bytes(locale)?);
    Some(layout(&font, lines))
}

fn layout(font: &Font, lines: &[&str]) -> String {
    let wordmark = TextLine::new(font, "MemeCatch", WORDMARK_SIZE, LineHeight::Normal);
    let titles: Vec<TextLine> = lines
        .iter()
        .map(|line| TextLine::new(font, line, TITLE_SIZE, LineHeight::Times(TITLE_LINE_HEIGHT)))
        .collect();
    let row_width = LOGO_SIZE + WORDMARK_GAP + wordmark.width;
    let row_height = LOGO_SIZE.max(wordmark.height);
    let column_width = titles.iter().map(|t| t.width).fold(0.0, f64::max);
    let column_height: f64 = titles.iter().map(|t| t.height).sum();
    let group_width = row_width.max(column_width);
    let group_height = row_height + TITLE_GAP + column_height;

    let group_x = pixel((WIDTH - group_width) / 2.0);
    let group_y = pixel((HEIGHT - group_height) / 2.0);
    let row_x = group_x + pixel((group_width - row_width) / 2.0);
    let chip_y = group_y + pixel((row_height - LOGO_SIZE) / 2.0);
    let icon = pixel((LOGO_SIZE - LOGO_ICON) / 2.0);

    let mut svg = svg_open(1200, 630);
    svg.push_str(&format!(
        r#"<rect x="0" y="0" width="1200" height="630" fill="{BACKGROUND}"/><path fill="{ACCENT}" d="{}"/>"#,
        rounded_rect(row_x, chip_y, LOGO_SIZE, LOGO_SIZE, LOGO_RADIUS)
    ));
    let (icon_x, icon_y) = (row_x + icon, chip_y + icon);
    svg.push_str(&format!(
        r#"<clipPath id="icon"><rect x="{icon_x}" y="{icon_y}" width="{LOGO_ICON}" height="{LOGO_ICON}"/></clipPath><image x="{icon_x}" y="{icon_y}" width="{LOGO_ICON}" height="{LOGO_ICON}" href="{ICON_HREF}" preserveAspectRatio="none" clip-path="url(#icon)"/>"#
    ));
    let wordmark_x = row_x + LOGO_SIZE + WORDMARK_GAP;
    let wordmark_y = group_y + pixel((row_height - wordmark.height) / 2.0);
    let mut paths = wordmark.path(wordmark_x, wordmark_y);

    let column_x = group_x + pixel((group_width - column_width) / 2.0);
    let mut line_y = group_y + row_height + TITLE_GAP;
    for title in &titles {
        paths.push_str(&title.path(column_x + pixel((column_width - title.width) / 2.0), line_y));
        line_y += title.height;
    }
    svg.push_str(&format!(r#"<path fill="{FOREGROUND}" d="{paths}"/></svg>"#));
    svg
}
