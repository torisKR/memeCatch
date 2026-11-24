//! The meme share card (`renderMemeShareCard` in `lib/meme-share-card.tsx`,
//! laid out by `lib/meme-share-layout.ts`): the wordmark pill, up to two
//! title lines, one summary line and the year · category chip, centered in
//! a 540px column on 1200×630; with a photo, the photo under a dark scrim.
//!
//! Lines are fitted as the app fits them (`fit_lines`, measured with the
//! app's own advance table), then each line is drawn as Satori draws a
//! `ShareLine`: one `whiteSpace: pre` text node per font run, its spaces
//! turned into no-break spaces. Box positions are Yoga's for that tree,
//! rounded as Yoga rounds them (`og::pixel`).

use super::satori::engine::{Engine, LineHeight, TextStyle};
use super::satori::segment;
use super::satori::text::{self, TextNode, WhiteSpace};
use super::share_fonts::{Script, ShareFonts};
use super::{At, rounded_rect, svg_open};
use crate::routes::public::js;

pub const WIDTH: f64 = 1200.0;
pub const HEIGHT: f64 = 630.0;
const COLUMN: f64 = 540.0;
const MEASURE_SLACK: f64 = 4.0;
const TITLE_SIZE: f64 = 56.0;
const SUMMARY_SIZE: f64 = 32.0;
const CHIP_SIZE: f64 = 22.0;
const WORDMARK_SIZE: f64 = 20.0;
const LOGO: f64 = 16.0;
const LINE_HEIGHT: f64 = 1.15;
const TITLE_MAX_LINES: usize = 2;
const BACKGROUND: &str = "#131316";
const FOREGROUND: &str = "#f0efec";
const SUMMARY: &str = "#aaa7af";
const CHIP_BACKGROUND: &str = "#26262c";
const ACCENT: &str = "#F74610";
const PILL: &str = "rgba(0,0,0,0.72)";
const ELLIPSIS: &str = "…";
const WORDMARK: &str = "MemeCatch";

/// `SHARE_PHOTO_SCRIM` over the center square, as Satori writes the
/// `linear-gradient` background of a 630×630 box at x = 285.
const SCRIM: &str = r#"<defs><pattern id="satori_pattern_id-1_0" x="0" y="0" width="1" height="1" patternUnits="objectBoundingBox"><linearGradient id="satori_biid-1_0" x1="0" y1="0" x2="0" y2="1" spreadMethod="pad"><stop offset="0%" stop-color="rgba(0,0,0,0.62)"/><stop offset="100%" stop-color="rgba(0,0,0,0.7)"/></linearGradient><rect x="0" y="0" width="630" height="630" fill="url(#satori_biid-1_0)"/></pattern></defs><rect x="285" y="0" width="630" height="630" fill="url(#satori_pattern_id-1_0)"/>"#;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Locale {
    Ko,
    En,
    Ja,
    Zh,
    ZhTw,
}

impl Locale {
    pub fn parse(code: &str) -> Option<Self> {
        Some(match code {
            "ko" => Self::Ko,
            "en" => Self::En,
            "ja" => Self::Ja,
            "zh" => Self::Zh,
            "zh-tw" => Self::ZhTw,
            _ => return None,
        })
    }

    pub fn code(self) -> &'static str {
        match self {
            Self::Ko => "ko",
            Self::En => "en",
            Self::Ja => "ja",
            Self::Zh => "zh",
            Self::ZhTw => "zh-tw",
        }
    }

    fn chip_category(self, category: &str) -> Option<&'static str> {
        const KEYS: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];
        let labels: [&str; 6] = match self {
            Self::Ko => ["유행어", "댄스", "노래", "영상", "드라마", "챌린지"],
            Self::En => ["Phrase", "Dance", "Song", "Video", "Drama", "Challenge"],
            Self::Ja => ["流行語", "ダンス", "歌", "映像", "ドラマ", "チャレンジ"],
            Self::Zh => ["流行语", "舞蹈", "歌曲", "视频", "剧情", "挑战"],
            Self::ZhTw => ["流行語", "舞蹈", "歌曲", "影片", "劇情", "挑戰"],
        };
        KEYS.iter()
            .position(|key| *key == category)
            .map(|index| labels[index])
    }
}

/// `MemeShareCardContent` without the photo.
#[derive(Clone, Debug, PartialEq)]
pub struct ShareCard {
    pub locale: Locale,
    pub title: String,
    pub summary: Option<String>,
    pub year: Option<i64>,
    /// One of the six categories (`categoryOrNull`).
    pub category: Option<String>,
}

impl ShareCard {
    /// `chipLabel`.
    fn chip(&self) -> Option<String> {
        let mut parts = Vec::new();
        if let Some(year) = self.year {
            parts.push(year.to_string());
        }
        if let Some(label) = self
            .category
            .as_deref()
            .and_then(|c| self.locale.chip_category(c))
        {
            parts.push(label.to_owned());
        }
        (!parts.is_empty()).then(|| parts.join(" · "))
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
    Script(Script),
    Emoji,
}

/// `fontKindFor`.
fn kind_for(code: u32, locale: Locale) -> Kind {
    let emoji =
        code >= 0x1f000 || (0x2600..=0x27bf).contains(&code) || code == 0xfe0f || code == 0x200d;
    if emoji {
        return Kind::Emoji;
    }
    let hangul = (0x1100..=0x11ff).contains(&code)
        || (0x3130..=0x318f).contains(&code)
        || (0xac00..=0xd7a3).contains(&code);
    let kana = (0x3040..=0x30ff).contains(&code)
        || (0x31f0..=0x31ff).contains(&code)
        || (0xff66..=0xff9d).contains(&code);
    if hangul {
        return Kind::Script(Script::Ko);
    }
    if kana {
        return Kind::Script(Script::Ja);
    }
    if (0x4e00..=0x9fff).contains(&code) {
        return Kind::Script(match locale {
            Locale::Ja => Script::Ja,
            Locale::ZhTw => Script::ZhTw,
            Locale::Zh | Locale::Ko | Locale::En => Script::Zh,
        });
    }
    Kind::Script(Script::Ko)
}

/// `measureText` of `lib/meme-share-layout.ts`.
fn measure_app(text: &str, font_size: f64, locale: Locale, fonts: &ShareFonts) -> f64 {
    let mut width = 0.0;
    for c in text.chars() {
        let code = u32::from(c);
        let (advance, units_per_em) = match kind_for(code, locale) {
            Kind::Emoji => fonts.emoji_advance(code),
            Kind::Script(script) => {
                let table = fonts.script_advances(script);
                (table.get(code), table.units_per_em)
            }
        };
        let units = advance.unwrap_or(units_per_em);
        width += units * font_size / units_per_em;
    }
    width
}

fn is_blank(token: &str) -> bool {
    !token.is_empty() && token.chars().all(js::is_space)
}

/// `text.split(/(\s+)/).filter(part => part.length > 0)`.
fn tokens(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for c in text.chars() {
        match out.last_mut() {
            Some(last) if is_blank(last) == js::is_space(c) => last.push(c),
            _ => out.push(c.to_string()),
        }
    }
    out
}

fn trim_end(text: &str) -> &str {
    text.trim_end_matches(js::is_space)
}

/// `ellipsize`.
fn ellipsize(line: &str, fits: &dyn Fn(&str) -> bool) -> String {
    let mut cut = trim_end(line).to_owned();
    while !cut.is_empty() && !fits(&format!("{cut}{ELLIPSIS}")) {
        if let Some(space) = cut.rfind(' ').filter(|space| *space > 0)
            && fits(&format!("{}{ELLIPSIS}", &cut[..space]))
        {
            cut.truncate(space);
            break;
        }
        let mut parts = segment::graphemes(&cut);
        parts.pop();
        cut = parts.concat();
    }
    if cut.is_empty() {
        ELLIPSIS.to_owned()
    } else {
        format!("{}{ELLIPSIS}", trim_end(&cut))
    }
}

/// One line of `fitShareLines`: tokens from `index`, a token too wide alone
/// broken by grapheme.
fn fill_line(tokens: &mut [String], index: &mut usize, fits: &dyn Fn(&str) -> bool) -> String {
    let mut line = String::new();
    while *index < tokens.len() {
        let token = tokens[*index].clone();
        let next = format!("{line}{token}");
        if is_blank(&token) {
            if !line.is_empty() && fits(&next) {
                line = next;
                *index += 1;
                continue;
            }
            break;
        }
        if fits(&next) {
            line = next;
            *index += 1;
            continue;
        }
        if !line.is_empty() {
            break;
        }
        let parts = segment::graphemes(&token);
        let mut piece = String::new();
        let mut glyph = 0;
        while glyph < parts.len() && fits(&format!("{piece}{}", parts[glyph])) {
            piece.push_str(parts[glyph]);
            glyph += 1;
        }
        if piece.is_empty() {
            piece = parts.first().map(|p| (*p).to_owned()).unwrap_or_default();
            glyph = 1;
        }
        let rest = parts
            .get(glyph..)
            .map(|rest| rest.concat())
            .unwrap_or_default();
        if rest.is_empty() {
            *index += 1;
        } else {
            tokens[*index] = rest;
        }
        return piece;
    }
    line
}

/// `fitShareLines(text, fontSize, maxLines, locale, fonts)`.
fn fit_lines(text: &str, font_size: f64, max_lines: usize, locale: Locale) -> Vec<String> {
    let fonts = ShareFonts::get();
    let max_width = COLUMN - MEASURE_SLACK;
    let fits = |value: &str| measure_app(value, font_size, locale, fonts) <= max_width;
    let mut tokens = tokens(js::trim(text));
    let mut lines: Vec<String> = Vec::new();
    let mut index = 0;
    while index < tokens.len() && lines.len() < max_lines {
        while index < tokens.len() && is_blank(&tokens[index]) {
            index += 1;
        }
        if index >= tokens.len() {
            break;
        }
        let line = fill_line(&mut tokens, &mut index, &fits);
        if !js::trim(&line).is_empty() {
            lines.push(trim_end(&line).to_owned());
        }
    }
    let leftover = tokens
        .get(index..)
        .map(|rest| rest.concat())
        .unwrap_or_default();
    if js::trim(&leftover).is_empty() {
        return lines;
    }
    let last = lines.last().cloned().unwrap_or_default();
    let fitted = ellipsize(&last, &fits);
    match lines.last_mut() {
        Some(slot) => *slot = fitted,
        None => lines.push(fitted),
    }
    lines.truncate(max_lines);
    lines
}

/// `layoutMemeShareCard`.
#[derive(Debug, Clone, PartialEq)]
pub struct Layout {
    pub title: Vec<String>,
    pub summary: Option<String>,
    pub chip: Option<String>,
}

pub fn layout(card: &ShareCard) -> Layout {
    let first = |text: &str, size| fit_lines(text, size, 1, card.locale).into_iter().next();
    Layout {
        title: fit_lines(&card.title, TITLE_SIZE, TITLE_MAX_LINES, card.locale),
        summary: card.summary.as_deref().and_then(|s| first(s, SUMMARY_SIZE)),
        chip: card.chip().and_then(|c| first(&c, CHIP_SIZE)),
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Family {
    Script(Script),
    Emoji(usize),
}

/// `fontRuns`: runs of one family, whitespace-only runs folded into the
/// run before, spaces turned into no-break spaces.
fn font_runs(text: &str, locale: Locale, fonts: &ShareFonts) -> Vec<(Family, String)> {
    let mut runs: Vec<(Family, String)> = Vec::new();
    for c in text.chars() {
        let code = u32::from(c);
        let family = match kind_for(code, locale) {
            Kind::Emoji => fonts
                .emoji_face(code)
                .map_or(Family::Script(Script::Ko), Family::Emoji),
            Kind::Script(script) => Family::Script(script),
        };
        match runs.last_mut() {
            Some((last, run)) if *last == family => run.push(c),
            _ => runs.push((family, c.to_string())),
        }
    }
    let mut folded: Vec<(Family, String)> = Vec::new();
    for (family, run) in runs {
        match folded.last_mut() {
            Some((_, previous)) if js::trim(&run).is_empty() => previous.push_str(&run),
            _ => folded.push((family, run)),
        }
    }
    folded
        .into_iter()
        .map(|(family, run)| (family, run.replace(' ', "\u{a0}")))
        .collect()
}

/// Why a card cannot be laid out: the default card goes instead.
#[derive(Debug, PartialEq, Eq)]
pub enum Unsupported {
    /// Satori would download a font or emoji for these graphemes.
    Missing(Vec<String>),
    /// A control character, or a line wider than the column.
    Shape(&'static str),
}

/// The fonts loaded for this card: the four scripts, then the emoji faces
/// that own a painted character.
struct CardFonts<'a> {
    fonts: &'a ShareFonts,
    emoji_faces: Vec<usize>,
}

impl<'a> CardFonts<'a> {
    fn new(painted: &str) -> Self {
        let fonts = ShareFonts::get();
        let mut emoji_faces: Vec<usize> = painted
            .chars()
            .filter(|c| fonts.emoji_advance(u32::from(*c)).0.is_some())
            .filter_map(|c| fonts.emoji_face(u32::from(c)))
            .collect();
        emoji_faces.sort_unstable();
        emoji_faces.dedup();
        Self { fonts, emoji_faces }
    }

    fn engine(&self, family: Family, font_size: f64) -> Engine<'a> {
        let own = match family {
            Family::Script(script) => self.fonts.script(script),
            Family::Emoji(index) => &self.fonts.emoji[index],
        };
        let mut list = vec![own];
        list.extend(self.fonts.scripts.iter());
        list.extend(self.emoji_faces.iter().map(|i| &self.fonts.emoji[*i]));
        let style = TextStyle {
            font_size,
            line_height: LineHeight::Times(LINE_HEIGHT),
            letter_spacing: 0.0,
        };
        Engine::new(list, style)
    }
}

/// A `ShareLine`: its runs as text nodes with their widths.
struct Line<'a> {
    runs: Vec<(TextNode<'a>, f64)>,
    width: f64,
    height: f64,
    color: &'static str,
}

impl<'a> Line<'a> {
    fn new(
        fonts: &CardFonts<'a>,
        text: &str,
        locale: Locale,
        size: f64,
        color: &'static str,
    ) -> Result<Self, Unsupported> {
        if text.chars().any(|c| text::is_unsupported(c) || c == '\n') {
            return Err(Unsupported::Shape("a control character"));
        }
        let mut runs = Vec::new();
        let (mut width, mut height) = (0.0, 0.0f64);
        for (family, run) in font_runs(text, locale, fonts.fonts) {
            let engine = fonts.engine(family, size);
            let missing = text::missing(&engine, &run, WhiteSpace::Pre);
            if !missing.is_empty() {
                return Err(Unsupported::Missing(missing));
            }
            let mut node = TextNode::new(engine, &run, WhiteSpace::Pre);
            let (run_width, run_height) = node.measure(f64::INFINITY);
            width += run_width;
            height = height.max(run_height);
            runs.push((node, run_width));
        }
        Ok(Self {
            runs,
            width,
            height,
            color,
        })
    }

    /// The text, its runs side by side from `at`.
    fn paint(&self, at: At) -> String {
        let mut svg = String::new();
        let mut offset = 0.0;
        for (node, width) in &self.runs {
            let run = at.child(offset, 0.0);
            let data = node.paint(run.left, run.top);
            svg.push_str(&format!(
                r#"<g  ><path fill="{}" d="{data}"/></g>"#,
                self.color
            ));
            offset += width;
        }
        svg
    }
}

fn pill(fill: &str, at: At, width: f64, height: f64) -> String {
    let (x, y, width, height) = at.rect(width, height);
    let radius = (width / 2.0).min(height / 2.0).min(999.0);
    format!(
        r#"<path fill="{fill}" d="{}"/>"#,
        rounded_rect(x, y, width, height, radius)
    )
}

/// The photo as Satori places an `objectFit: cover` image on the card.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PhotoBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl PhotoBox {
    /// `sharePhotoObjectPosition` and Satori's `cover`: `center 30%` for a
    /// tall photo, else centered.
    pub fn cover(natural_width: f64, natural_height: f64) -> Self {
        let tall = natural_height / natural_width >= 1.5;
        let (along_x, along_y) = (WIDTH / 2.0, if tall { 0.3 * HEIGHT } else { HEIGHT / 2.0 });
        let scale = (WIDTH / natural_width).max(HEIGHT / natural_height);
        let (width, height) = (natural_width * scale, natural_height * scale);
        Self {
            x: along_x - width * along_x / WIDTH,
            y: along_y - height * along_y / HEIGHT,
            width,
            height,
        }
    }
}

/// The card's SVG, without the photo itself: with `photo`, the black
/// ground and the scrim the photo goes between (`og::photo` paints it).
pub fn svg(card: &ShareCard, photo: bool) -> Result<String, Unsupported> {
    let lines = layout(card);
    let painted = [
        WORDMARK.to_owned(),
        lines.title.concat(),
        lines.summary.clone().unwrap_or_default(),
        lines.chip.clone().unwrap_or_default(),
    ]
    .concat();
    let fonts = CardFonts::new(&painted);
    let line = |text: &str, size, color| Line::new(&fonts, text, card.locale, size, color);
    let wordmark = line(WORDMARK, WORDMARK_SIZE, FOREGROUND)?;
    let titles: Vec<Line> = lines
        .title
        .iter()
        .map(|text| line(text, TITLE_SIZE, FOREGROUND))
        .collect::<Result<_, _>>()?;
    let summary = lines
        .summary
        .as_deref()
        .map(|t| line(t, SUMMARY_SIZE, SUMMARY))
        .transpose()?;
    let chip = lines
        .chip
        .as_deref()
        .map(|t| line(t, CHIP_SIZE, FOREGROUND))
        .transpose()?;
    let widest = titles.iter().map(|l| l.width).fold(0.0, f64::max);
    let all = titles.iter().chain(&summary).chain(&chip);
    if all.clone().any(|l| l.width > COLUMN) || widest > COLUMN {
        return Err(Unsupported::Shape("a line wider than the column"));
    }
    let tree = Tree {
        photo,
        wordmark,
        titles,
        summary,
        chip,
    };
    Ok(tree.draw())
}

struct Tree<'a> {
    photo: bool,
    wordmark: Line<'a>,
    titles: Vec<Line<'a>>,
    summary: Option<Line<'a>>,
    chip: Option<Line<'a>>,
}

impl Tree<'_> {
    fn pad(&self, x: f64, y: f64) -> (f64, f64) {
        if self.photo { (x, y) } else { (0.0, 0.0) }
    }

    fn draw(&self) -> String {
        let (pill_x, pill_y) = self.pad(12.0, 6.0);
        let (summary_x, summary_y) = self.pad(12.0, 4.0);
        let row = self.wordmark.height.max(LOGO);
        let pill_w = 2.0 * pill_x + LOGO + 8.0 + self.wordmark.width;
        let pill_h = 2.0 * pill_y + row;
        let title_w = self.titles.iter().map(|l| l.width).fold(0.0, f64::max);
        let title_h: f64 = self.titles.iter().map(|l| l.height).sum();
        let summary_box = self
            .summary
            .as_ref()
            .map(|l| (2.0 * summary_x + l.width, 2.0 * summary_y + l.height));
        let chip_box = self
            .chip
            .as_ref()
            .map(|l| (28.0 + l.width, 12.0 + l.height));
        let column_h = pill_h
            + 28.0
            + title_h
            + summary_box.map_or(0.0, |(_, h)| 16.0 + h)
            + chip_box.map_or(0.0, |(_, h)| 22.0 + h);
        let column = At::default().child((WIDTH - COLUMN) / 2.0, (HEIGHT - column_h) / 2.0);

        let mut svg = svg_open(1200, 630);
        // With a photo the black ground and the photo are painted first
        // (`og::photo::ground`) and this is drawn over them.
        if self.photo {
            svg.push_str(SCRIM);
        } else {
            svg.push_str(&format!(
                r#"<rect x="0" y="0" width="1200" height="630" fill="{BACKGROUND}"/>"#
            ));
        }
        let row_at = column.child((COLUMN - pill_w) / 2.0, 0.0);
        if self.photo {
            svg.push_str(&pill(PILL, row_at, pill_w, pill_h));
        }
        let logo = row_at.child(pill_x, pill_y + (row - LOGO) / 2.0);
        svg.push_str(&pill(ACCENT, logo, LOGO, LOGO));
        let mark = row_at.child(
            pill_x + LOGO + 8.0,
            pill_y + (row - self.wordmark.height) / 2.0,
        );
        svg.push_str(&self.wordmark.paint(mark));

        let titles = column.child((COLUMN - title_w) / 2.0, pill_h + 28.0);
        let mut below = 0.0;
        for line in &self.titles {
            svg.push_str(&line.paint(titles.child((title_w - line.width) / 2.0, below)));
            below += line.height;
        }
        let mut y = pill_h + 28.0 + title_h;
        if let (Some(line), Some((w, h))) = (&self.summary, summary_box) {
            let at = column.child((COLUMN - w) / 2.0, y + 16.0);
            if self.photo {
                svg.push_str(&pill(PILL, at, w, h));
            }
            svg.push_str(&line.paint(at.child(summary_x, summary_y)));
            y += 16.0 + h;
        }
        if let (Some(line), Some((w, h))) = (&self.chip, chip_box) {
            let at = column.child((COLUMN - w) / 2.0, y + 22.0);
            let fill = if self.photo { PILL } else { CHIP_BACKGROUND };
            svg.push_str(&pill(fill, at, w, h));
            svg.push_str(&line.paint(at.child(14.0, 6.0)));
        }
        svg.push_str("</svg>");
        svg
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_split_on_runs_of_javascript_whitespace() {
        assert_eq!(tokens("a  b\u{a0}c"), ["a", "  ", "b", "\u{a0}", "c"]);
    }

    #[test]
    fn a_tall_photo_keeps_its_upper_part() {
        let tall = PhotoBox::cover(600.0, 1200.0);
        assert_eq!(
            (tall.x, tall.y, tall.width, tall.height),
            (0.0, -531.0, 1200.0, 2400.0)
        );
        let wide = PhotoBox::cover(1280.0, 720.0);
        assert_eq!((wide.y, wide.height), (-22.5, 675.0));
    }

    #[test]
    fn the_chip_names_year_and_category_in_the_locale() {
        let card = ShareCard {
            locale: Locale::Ja,
            title: "t".into(),
            summary: None,
            year: Some(2022),
            category: Some("song".into()),
        };
        assert_eq!(card.chip().as_deref(), Some("2022 · 歌"));
    }
}
