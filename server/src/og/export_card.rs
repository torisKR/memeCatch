//! The card `GET /memes/{key}/export` downloads (`renderMemeCard` of
//! lib/meme-card.tsx): the logo row, the title and its one-line meaning,
//! the safety badge and the lifecycle gauge, and the `catchmeme.com`
//! watermark, in three templates and two formats.
//!
//! Next drew it with Satori and Pretendard fetched from jsDelivr when it
//! could. Here the same layout is built as SVG by hand (a column whose three
//! parts are spread out, as `justify-content: space-between` does) with the
//! share card's bundled fonts (`share_fonts`), so nothing is fetched while a
//! card is drawn (D2-10, PLAN.md). The fonts have one weight.

use super::satori::engine::{Engine, LineHeight, TextStyle};
use super::satori::text::{TextNode, WhiteSpace};
use super::share_fonts::{Script, ShareFonts};
use super::svg_open;
use crate::og::font::Font;

/// `CARD_TEMPLATES`: background, text, secondary text, accent, empty cell.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Template {
    Classic,
    Minimal,
    Bold,
}

struct Colors {
    bg: &'static str,
    fg: &'static str,
    sub: &'static str,
    accent: &'static str,
    cell: &'static str,
}

impl Template {
    /// `isCardTemplate(value) ? value : "classic"`.
    pub fn parse(value: Option<&str>) -> Self {
        match value {
            Some("minimal") => Self::Minimal,
            Some("bold") => Self::Bold,
            _ => Self::Classic,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Classic => "classic",
            Self::Minimal => "minimal",
            Self::Bold => "bold",
        }
    }

    fn colors(self) -> Colors {
        match self {
            Self::Classic => Colors {
                bg: "#131316",
                fg: "#f0efec",
                sub: "#9c99a3",
                accent: "#ff6b47",
                cell: "#26262c",
            },
            Self::Minimal => Colors {
                bg: "#faf9f7",
                fg: "#1a1a1e",
                sub: "#6b6870",
                accent: "#ff6b47",
                cell: "#e7e5e0",
            },
            Self::Bold => Colors {
                bg: "#ff6b47",
                fg: "#ffffff",
                sub: "#ffe6de",
                accent: "#ffffff",
                cell: "#ffffff",
            },
        }
    }
}

/// `CARD_FORMATS`: the landscape card or the portrait story.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Format {
    Card,
    Story,
}

impl Format {
    /// `isCardFormat(value) ? value : "card"`.
    pub fn parse(value: Option<&str>) -> Self {
        if value == Some("story") {
            Self::Story
        } else {
            Self::Card
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Card => "card",
            Self::Story => "story",
        }
    }

    pub fn size(self) -> (u32, u32) {
        match self {
            Self::Card => (1200, 630),
            Self::Story => (1080, 1920),
        }
    }
}

/// What the card says, in `locale` (`ko`, `en`, `ja`, `zh`, `zh-tw`).
pub struct ExportCard {
    pub title: String,
    pub summary: String,
    /// `safety_level`; an unknown value is drawn as `yellow`.
    pub safety: String,
    /// `lifecycle_status`; an unknown value is drawn as `active`.
    pub lifecycle: String,
    pub locale: String,
    pub template: Template,
    pub format: Format,
}

/// `SAFETY_LEVELS[level].icon` and `SAFETY_COLOR[level]` (fg, bg).
fn safety(level: &str) -> (&'static str, &'static str, &'static str) {
    match level {
        "green" => ("●", "#3ecf85", "#12301f"),
        "gray" => ("◌", "#a1a1aa", "#26262c"),
        // `✕` is in none of the bundled fonts; `×` is the same mark.
        "red" => ("×", "#ff6b6b", "#351515"),
        _ => ("▲", "#e8b53a", "#33290e"),
    }
}

/// `LIFECYCLE_STATUS[status].flame` and `LIFE_COLOR[status]`.
fn lifecycle(status: &str) -> (usize, &'static str) {
    match status {
        "rising" => (4, "#ff6b47"),
        "cooling" => (2, "#7d93aa"),
        "archived" => (1, "#6f6a60"),
        _ => (3, "#ffb054"),
    }
}

/// `CARD_COPY[locale]`: the tagline, the safety label, the lifecycle label.
fn copy(locale: &str, safety: &str, lifecycle: &str) -> (&'static str, &'static str, &'static str) {
    let index = |order: [&str; 4], value: &str, fallback: usize| {
        order.iter().position(|v| *v == value).unwrap_or(fallback)
    };
    let s = index(["green", "yellow", "gray", "red"], safety, 1);
    let l = index(["rising", "active", "cooling", "archived"], lifecycle, 1);
    let (tagline, safeties, lifecycles): (&str, [&str; 4], [&str; 4]) = match locale {
        "en" => (
            "Korean Memes Explained",
            [
                "Safe to use",
                "Context needed",
                "Past its prime",
                "Risky to use",
            ],
            ["Rising", "Active", "Cooling", "Archived"],
        ),
        "ja" => (
            "韓国ミームをわかりやすく解説",
            ["使ってOK", "文脈に注意", "旬を過ぎた", "使用注意"],
            ["急上昇", "流行中", "落ち着き中", "懐かしミーム"],
        ),
        "zh" => (
            "看懂韩国网络迷因",
            ["可以使用", "注意语境", "已经过时", "谨慎使用"],
            ["上升中", "流行中", "降温中", "怀旧迷因"],
        ),
        "zh-tw" => (
            "看懂韓國網路迷因",
            ["可以使用", "注意語境", "已經過時", "謹慎使用"],
            ["上升中", "流行中", "降溫中", "懷舊迷因"],
        ),
        _ => (
            "그 밈, 3초 안에 알려드려요",
            ["써도 됨", "맥락 주의", "이미 늦음", "쓰면 위험"],
            ["급상승", "유행 중", "식는 중", "추억 밈"],
        ),
    };
    (tagline, safeties[s], lifecycles[l])
}

/// `truncate(text, max)`: at most `max` UTF-16 units, the last one an
/// ellipsis when cut (never half of a surrogate pair).
fn truncate(text: &str, max: usize) -> String {
    if text.encode_utf16().count() <= max {
        return text.to_owned();
    }
    let mut kept = String::new();
    let mut units = 0;
    for c in text.chars() {
        if units + c.len_utf16() > max - 1 {
            break;
        }
        units += c.len_utf16();
        kept.push(c);
    }
    kept.push('…');
    kept
}

/// The fonts a text node may use: the locale's script first, then the other
/// scripts and every emoji subset.
fn fonts(locale: &str) -> Vec<&'static Font> {
    let set = ShareFonts::get();
    let first = match locale {
        "ja" => Script::Ja,
        "zh" => Script::Zh,
        "zh-tw" => Script::ZhTw,
        _ => Script::Ko,
    };
    let own = set.script(first);
    let mut list = vec![own];
    list.extend(set.scripts.iter().filter(|font| !std::ptr::eq(*font, own)));
    list.extend(set.emoji.iter());
    list
}

/// One laid-out text node and its box.
struct Text {
    node: TextNode<'static>,
    width: f64,
    height: f64,
}

impl Text {
    fn new(locale: &str, text: &str, style: TextStyle, max_width: f64) -> Self {
        let mut node = TextNode::new(Engine::new(fonts(locale), style), text, WhiteSpace::Normal);
        let (width, height) = node.measure(max_width);
        Self {
            node,
            width,
            height,
        }
    }

    fn paint(&self, x: f64, y: f64, fill: &str, opacity: Option<f64>) -> String {
        let opacity = opacity
            .map(|o| format!(r#" opacity="{o}""#))
            .unwrap_or_default();
        format!(
            r#"<path fill="{fill}"{opacity} d="{}"/>"#,
            self.node.paint(x, y)
        )
    }
}

fn style(font_size: f64, line_height: LineHeight, letter_spacing: f64) -> TextStyle {
    TextStyle {
        font_size,
        line_height,
        letter_spacing,
    }
}

impl ExportCard {
    /// The card as SVG, `Format::size` pixels.
    pub fn svg(&self) -> String {
        let story = self.format == Format::Story;
        let colors = self.template.colors();
        let bold = self.template == Template::Bold;
        let (icon, safety_fg, safety_bg) = safety(&self.safety);
        let (badge_bg, badge_fg) = if bold {
            ("rgba(255,255,255,0.16)", "#ffffff")
        } else {
            (safety_bg, safety_fg)
        };
        let (flame, life_color) = lifecycle(&self.lifecycle);
        let life_fg = if bold { "#ffffff" } else { life_color };
        let (tagline, safety_label, life_label) = copy(&self.locale, &self.safety, &self.lifecycle);
        let title = truncate(
            if self.title.is_empty() {
                "밈캐치"
            } else {
                &self.title
            },
            if story { 26 } else { 20 },
        );
        let summary = truncate(
            if self.summary.is_empty() {
                "그 밈, 3초 안에 알려드려요"
            } else {
                &self.summary
            },
            if story { 72 } else { 52 },
        );
        let title_size = match (story, title.encode_utf16().count()) {
            (true, n) if n > 14 => 108.0,
            (true, _) => 128.0,
            (false, n) if n > 12 => 76.0,
            (false, _) => 92.0,
        };
        let (width, height) = self.format.size();
        let (w, h) = (f64::from(width), f64::from(height));
        let (pad_x, pad_y) = if story { (88.0, 120.0) } else { (72.0, 56.0) };
        let inner = w - 2.0 * pad_x;
        let locale = self.locale.as_str();
        let line = |value: &str, size: f64| {
            Text::new(
                locale,
                value,
                style(size, LineHeight::Normal, 0.0),
                f64::INFINITY,
            )
        };

        // Top: the logo dot, the wordmark, the tagline.
        let mark = line("밈캐치", if story { 42.0 } else { 34.0 });
        let tag = line(tagline, if story { 30.0 } else { 26.0 });
        let top_h = mark.height.max(tag.height).max(20.0);
        // Middle: the title and its meaning.
        let title = Text::new(
            locale,
            &title,
            style(title_size, LineHeight::Times(1.15), -1.0),
            inner,
        );
        let summary_size = if story { 52.0 } else { 38.0 };
        let summary = Text::new(
            locale,
            &summary,
            style(summary_size, LineHeight::Times(1.4), 0.0),
            inner,
        );
        let middle_gap = if story { 32.0 } else { 22.0 };
        let middle_h = title.height + middle_gap + summary.height;
        // Bottom: the badge (border 2, padding 14 × 30) and the gauge.
        let icon = line(icon, 30.0);
        let safety_text = line(safety_label, 32.0);
        let badge_inner = icon.height.max(safety_text.height);
        let badge_w = 2.0 + 30.0 + icon.width + 14.0 + safety_text.width + 30.0 + 2.0;
        let badge_h = 2.0 + 14.0 + badge_inner + 14.0 + 2.0;
        let life = line(life_label, 30.0);
        let cells_w = 4.0 * 44.0 + 3.0 * 8.0;
        let gauge_w = cells_w + 16.0 + life.width;
        let gauge_h = life.height.max(20.0);
        let bottom_h = if story {
            badge_h + 28.0 + gauge_h
        } else {
            badge_h.max(gauge_h)
        };
        let spread = ((h - 2.0 * pad_y - top_h - middle_h - bottom_h) / 2.0).max(0.0);

        let mut svg = svg_open(width, height);
        svg.push_str(&format!(
            r#"<rect x="0" y="0" width="{width}" height="{height}" fill="{}"/>"#,
            colors.bg
        ));
        let mut y = pad_y;
        svg.push_str(&format!(
            r#"<circle cx="{}" cy="{}" r="10" fill="{}"/>"#,
            pad_x + 10.0,
            y + top_h / 2.0,
            colors.accent
        ));
        let mut x = pad_x + 20.0 + 14.0;
        svg.push_str(&mark.paint(x, y + (top_h - mark.height) / 2.0, colors.accent, None));
        x += mark.width + 14.0 + 6.0;
        svg.push_str(&tag.paint(x, y + (top_h - tag.height) / 2.0, colors.sub, None));

        y += top_h + spread;
        svg.push_str(&title.paint(pad_x, y, colors.fg, None));
        y += title.height + middle_gap;
        svg.push_str(&summary.paint(pad_x, y, colors.sub, None));

        let bottom = h - pad_y - bottom_h;
        let badge_y = if story {
            bottom
        } else {
            bottom + (bottom_h - badge_h) / 2.0
        };
        svg.push_str(&format!(
            r#"<rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="{badge_bg}" stroke="{badge_fg}" stroke-width="2"/>"#,
            pad_x + 1.0,
            badge_y + 1.0,
            badge_w - 2.0,
            badge_h - 2.0,
            (badge_h - 2.0) / 2.0
        ));
        let content_y = badge_y + 16.0;
        let icon_x = pad_x + 32.0;
        svg.push_str(&icon.paint(
            icon_x,
            content_y + (badge_inner - icon.height) / 2.0,
            badge_fg,
            None,
        ));
        svg.push_str(&safety_text.paint(
            icon_x + icon.width + 14.0,
            content_y + (badge_inner - safety_text.height) / 2.0,
            badge_fg,
            None,
        ));

        let (gauge_x, gauge_y) = if story {
            (pad_x, bottom + badge_h + 28.0)
        } else {
            (w - pad_x - gauge_w, bottom + (bottom_h - gauge_h) / 2.0)
        };
        for cell in 0..4u8 {
            let fill = if usize::from(cell) < flame {
                life_fg
            } else {
                colors.cell
            };
            svg.push_str(&format!(
                r#"<rect x="{}" y="{}" width="44" height="20" rx="6" fill="{fill}"/>"#,
                gauge_x + f64::from(cell) * 52.0,
                gauge_y + (gauge_h - 20.0) / 2.0
            ));
        }
        svg.push_str(&life.paint(
            gauge_x + cells_w + 16.0,
            gauge_y + (gauge_h - life.height) / 2.0,
            life_fg,
            None,
        ));

        // The watermark, at the bottom right.
        let watermark = line("catchmeme.com", if story { 26.0 } else { 22.0 });
        let (right, below) = if story { (88.0, 56.0) } else { (72.0, 24.0) };
        svg.push_str(&watermark.paint(
            w - right - watermark.width,
            h - below - watermark.height,
            colors.sub,
            Some(0.7),
        ));
        svg.push_str("</svg>");
        svg
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card(template: Template, format: Format, locale: &str) -> ExportCard {
        ExportCard {
            title: "어쩔티비 저쩔티비 안물티비 안궁티비".into(),
            summary:
                "상대의 말을 받아치며 대화를 끝내는 초등학생발 유행어로, 길게 쓰면 두 줄이 된다"
                    .into(),
            safety: "green".into(),
            lifecycle: "cooling".into(),
            locale: locale.into(),
            template,
            format,
        }
    }

    #[test]
    fn titles_are_cut_at_utf16_units_with_an_ellipsis() {
        assert_eq!(truncate("짧은 제목", 20), "짧은 제목");
        assert_eq!(truncate("가나다라마바사", 5), "가나다라…");
        // An emoji is two units and is not split.
        assert_eq!(truncate("가나다😀", 4), "가나다…");
    }

    #[test]
    fn every_template_and_format_draws_a_card_of_its_size() {
        for template in [Template::Classic, Template::Minimal, Template::Bold] {
            for format in [Format::Card, Format::Story] {
                for locale in ["ko", "en", "ja", "zh", "zh-tw"] {
                    let svg = card(template, format, locale).svg();
                    let png = crate::og::rasterize(&svg).expect("a png");
                    let decoder = png::Decoder::new(std::io::Cursor::new(&png));
                    let reader = decoder.read_info().expect("png info");
                    let (width, height) = format.size();
                    assert_eq!((reader.info().width, reader.info().height), (width, height));
                    assert!(svg.contains(template.colors().bg), "{template:?}");
                    // Every text is glyph paths.
                    assert!(
                        svg.matches("<path").count() >= 8,
                        "{template:?} {format:?} {locale}"
                    );
                }
            }
        }
    }

    #[test]
    fn the_labels_are_in_the_bundled_fonts() {
        let fonts = fonts("ko");
        for text in [
            "●▲◌×",
            "밈캐치 catchmeme.com",
            "그 밈, 3초 안에 알려드려요 써도 됨 맥락 주의 이미 늦음 쓰면 위험 급상승 유행 중 식는 중 추억 밈",
            "Korean Memes Explained Safe to use Context needed Past its prime Risky",
            "韓国ミームをわかりやすく解説 使ってOK 文脈に注意 旬を過ぎた 使用注意 急上昇 流行中 落ち着き中 懐かしミーム",
            "看懂韩国网络迷因 可以使用 注意语境 已经过时 谨慎使用 上升中 降温中 怀旧迷因",
            "看懂韓國網路迷因 注意語境 已經過時 謹慎使用 降溫中 懷舊迷因",
        ] {
            for c in text.chars().filter(|c| !c.is_whitespace()) {
                assert!(
                    fonts.iter().any(|font| font.has_glyph(c)),
                    "{c:?} has no glyph"
                );
            }
        }
    }
}
