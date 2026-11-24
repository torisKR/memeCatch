//! The quiz result card (`lib/quiz-og.tsx`) and its token
//! (`decodeQuizShareToken`, `gradeForScore` in `lib/quiz-share.ts` and
//! `lib/quiz.ts`). The token holds the whole result, so there is no
//! database read.
//!
//! Layout as Yoga computes it for that tree: a 1056×518 content box with the
//! header, the score block and the bottom bar spread by `space-between`.
//! `alignItems: baseline` in the score row lines up the bottoms of the two
//! numbers: Satori gives Yoga no baseline function, so each box's baseline
//! is its height.

use super::font::Font;
use super::text::{LineHeight, TextLine};
use super::{pixel, rounded_rect, svg_open};

const BACKGROUND: &str = "#0f0f13";
const FOREGROUND: &str = "#f4f4f5";
const MUTED: &str = "#a1a1aa";
const BORDER: &str = "#2d2d38";
const ACCENT: &str = "#ff5c38";
const ACCENT_SOFT: &str = "#331c17";
const ACCENT_TEXT: &str = "#ff8a6b";
const SIGNAL: &str = "#22d3ee";
const BAR_OFF: &str = "#343442";
const PAD_X: f64 = 72.0;
const PAD_Y: f64 = 56.0;
const INNER_WIDTH: f64 = 1200.0 - 2.0 * PAD_X;
const INNER_HEIGHT: f64 = 630.0 - 2.0 * PAD_Y;

/// The two radial gradients of `backgroundImage`, as Satori writes them for
/// a 1200×630 box (the second layer painted first). Their masks are white
/// and change nothing, so they are left out.
const GLOW: &str = r#"<defs><pattern id="satori_pattern_id_1" x="0" y="0" width="1" height="1" patternUnits="objectBoundingBox"><radialGradient id="satori_radial_id_1" spreadMethod="pad"><stop offset="0" stop-color="rgba(34,211,238,0.22)"/><stop offset="0.42" stop-color="rgba(34,211,238,0)"/><stop offset="1" stop-color="rgba(34,211,238,0)"/></radialGradient><rect x="0" y="0" width="1200" height="630" fill="rgba(34,211,238,0)"/><circle cx="72" cy="604.8" width="1200" height="630" r="1279.9089967650043" fill="url(#satori_radial_id_1)"/></pattern><pattern id="satori_pattern_id_0" x="0" y="0" width="1" height="1" patternUnits="objectBoundingBox"><radialGradient id="satori_radial_id_0" spreadMethod="pad"><stop offset="0" stop-color="rgba(255,92,56,0.30)"/><stop offset="0.45" stop-color="rgba(255,92,56,0)"/><stop offset="1" stop-color="rgba(255,92,56,0)"/></radialGradient><rect x="0" y="0" width="1200" height="630" fill="rgba(255,92,56,0)"/><circle cx="1104" cy="50.4" width="1200" height="630" r="1246.8970125876476" fill="url(#satori_radial_id_0)"/></pattern></defs><rect x="0" y="0" width="1200" height="630" fill="url(#satori_pattern_id_1)"/><rect x="0" y="0" width="1200" height="630" fill="url(#satori_pattern_id_0)"/>"#;

pub const FONT: &[u8] = include_bytes!("../../assets/og/share-ko.otf");

/// `QUIZ_SIZE`.
const QUIZ_SIZE: usize = 10;
const SHORT_ID_LENGTH: usize = 8;
const HEADER_LENGTH: usize = 4;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuizResult {
    pub mode_label: &'static str,
    pub correct: Vec<bool>,
    pub score: usize,
    pub grade: &'static str,
}

/// `decodeQuizShareToken(raw)` for a token already trimmed as
/// `String.prototype.trim` trims it.
pub fn decode_token(token: &str) -> Option<QuizResult> {
    if token.chars().count() < HEADER_LENGTH + SHORT_ID_LENGTH || !token.is_ascii() {
        // A non-ASCII character fails one of the patterns below in any case.
        return None;
    }
    let mode_label = match &token[..1] {
        "a" => "전체",
        "n" => "요즘 밈",
        "r" => "추억 밈",
        _ => return None,
    };
    let mask_hex = &token[1..HEADER_LENGTH];
    if !mask_hex
        .bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return None;
    }
    let body = &token[HEADER_LENGTH..];
    if !body.len().is_multiple_of(SHORT_ID_LENGTH) {
        return None;
    }
    let total = body.len() / SHORT_ID_LENGTH;
    if !(1..=QUIZ_SIZE).contains(&total) {
        return None;
    }
    let ids: Vec<&str> = (0..total)
        .map(|i| &body[i * SHORT_ID_LENGTH..(i + 1) * SHORT_ID_LENGTH])
        .collect();
    let id_ok = |id: &&str| {
        id.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
    };
    if !ids.iter().all(id_ok) {
        return None;
    }
    let mut seen = std::collections::HashSet::new();
    if !ids.iter().all(|id| seen.insert(*id)) {
        return None;
    }
    let mask = u32::from_str_radix(mask_hex, 16).ok()?;
    if mask >= 1 << total {
        return None;
    }
    let correct: Vec<bool> = (0..total).map(|i| mask & (1 << i) != 0).collect();
    let score = correct.iter().filter(|ok| **ok).count();
    Some(QuizResult {
        mode_label,
        grade: grade_label(score, total),
        correct,
        score,
    })
}

/// `gradeForScore(correct, total).label`, with the same floating point.
fn grade_label(score: usize, total: usize) -> &'static str {
    let pct = score as f64 / total as f64 * 100.0;
    match pct {
        p if p >= 90.0 => "밈장인",
        p if p >= 70.0 => "밈잘알",
        p if p >= 50.0 => "밈러",
        p if p >= 30.0 => "밈뉴비",
        _ => "밈세계 입문 환영",
    }
}

/// A rounded box: position, size and its clamped corner radius.
struct Pill {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

impl Pill {
    fn radius(&self) -> f64 {
        self.w.min(self.h) / 2.0
    }

    fn path(&self) -> String {
        rounded_rect(self.x, self.y, self.w, self.h, self.radius())
    }

    /// Satori's border: a stroke twice the border width along the rounded
    /// box, clipped to it, starting on the top-left corner at 45°.
    fn border(&self, id: &str, width: f64, color: &str) -> String {
        let (x, y, r) = (self.x, self.y, self.radius());
        let start = r - r * std::f64::consts::FRAC_1_SQRT_2;
        let (sx, sy) = (x + start, y + start);
        let (hh, vv) = (self.w - 2.0 * r, self.h - 2.0 * r);
        format!(
            r#"<clipPath id="{id}"><path d="{}"/></clipPath><path clip-path="url(#{id})" fill="none" stroke="{color}" stroke-width="{}" d="M{sx:.3},{sy:.3} A{r},{r} 0 0 1 {},{y} h{hh} a{r},{r} 0 0 1 {r},{r} v{vv} a{r},{r} 0 0 1 -{r},{r} h-{hh} a{r},{r} 0 0 1 -{r},-{r} v-{vv} A{r},{r} 0 0 1 {sx:.3},{sy:.3}"/>"#,
            self.path(),
            width * 2.0,
            x + r
        )
    }
}

fn text(color: &str, data: &str) -> String {
    format!(r#"<path fill="{color}" d="{data}"/>"#)
}

pub fn svg(result: &QuizResult) -> String {
    let font = Font::new(FONT);
    let mut svg = svg_open(1200, 630);
    svg.push_str(&format!(
        r#"<rect x="0" y="0" width="1200" height="630" fill="{BACKGROUND}"/>{GLOW}"#
    ));
    let header_h = header(&mut svg, &font, result.mode_label);
    let score = ScoreBlock::new(&font, result);
    let call = TextLine::new(
        &font,
        "같은 문제로 내 점수 이겨보기",
        40.0,
        LineHeight::Normal,
    );
    let site = TextLine::new(&font, "catchmeme.com", 28.0, LineHeight::Normal);
    let row_h = call.height.max(site.height);
    let bar_h = row_h + 2.0 * 22.0;
    let gap = (INNER_HEIGHT - header_h - score.height - bar_h) / 2.0;
    score.paint(&mut svg, PAD_Y + header_h + pixel(gap));

    // `space-between` puts the last box at the end of the content box; its
    // padding is 22 36 and its two texts are centered on its height.
    let bar_y = PAD_Y + INNER_HEIGHT - bar_h;
    svg.push_str(&format!(
        r#"<path fill="{ACCENT}" d="{}"/>"#,
        rounded_rect(PAD_X, bar_y, INNER_WIDTH, bar_h, 28.0)
    ));
    let row_y = bar_y + 22.0;
    let call_y = row_y + pixel((row_h - call.height) / 2.0);
    svg.push_str(&text("#ffffff", &call.path(PAD_X + 36.0, call_y)));
    let site_x = PAD_X + INNER_WIDTH - 36.0 - site.width;
    let site_y = row_y + pixel((row_h - site.height) / 2.0);
    svg.push_str(&text("#ffe8e1", &site.path(site_x, site_y)));
    svg.push_str("</svg>");
    svg
}

/// The dot and name on the left, the mode badge (border 2, padding 6 22) on
/// the right. Returns the row height.
fn header(svg: &mut String, font: &Font, mode_label: &str) -> f64 {
    let name = TextLine::new(font, "밈캐치 밈력고사", 30.0, LineHeight::Normal);
    let mode_text = format!("{mode_label} 모드");
    let mode = TextLine::new(font, &mode_text, 26.0, LineHeight::Normal);
    let badge_w = mode.width + 2.0 * 22.0 + 2.0 * 2.0;
    let badge_h = mode.height + 2.0 * 6.0 + 2.0 * 2.0;
    let name_h = name.height.max(18.0);
    let header_h = name_h.max(badge_h);
    let name_y = PAD_Y + pixel((header_h - name_h) / 2.0);
    let dot_y = name_y + pixel((name_h - 18.0) / 2.0);
    svg.push_str(&format!(
        r#"<path fill="{ACCENT}" d="{}"/>"#,
        rounded_rect(PAD_X, dot_y, 18.0, 18.0, 9.0)
    ));
    svg.push_str(&text(FOREGROUND, &name.path(PAD_X + 18.0 + 14.0, name_y)));
    let badge = Pill {
        x: PAD_X + INNER_WIDTH - badge_w,
        y: PAD_Y + pixel((header_h - badge_h) / 2.0),
        w: badge_w,
        h: badge_h,
    };
    svg.push_str(&badge.border("mode", 2.0, BORDER));
    svg.push_str(&text(
        MUTED,
        &mode.path(badge.x + 2.0 + 22.0, badge.y + 2.0 + 6.0),
    ));
    header_h
}

/// "친구의 밈력은" over the score and total on the left; the grade pill
/// (border 3, padding 8 32) over the answer bars on the right, 64 to the
/// right and 24 above the bottom.
struct ScoreBlock<'a> {
    lead: TextLine<'a>,
    score: TextLine<'a>,
    out_of: TextLine<'a>,
    grade: TextLine<'a>,
    correct: &'a [bool],
    height: f64,
}

impl<'a> ScoreBlock<'a> {
    fn new(font: &'a Font, result: &'a QuizResult) -> Self {
        let lead = TextLine::new(font, "친구의 밈력은", 34.0, LineHeight::Normal);
        let score = TextLine::owned(
            font,
            result.score.to_string(),
            200.0,
            LineHeight::Times(1.0),
        );
        let total = result.correct.len();
        let out_of = TextLine::owned(font, format!("/ {total}"), 72.0, LineHeight::Normal);
        let grade = TextLine::new(font, result.grade, 48.0, LineHeight::Normal);
        let left_h = lead.height + 4.0 + score.height.max(out_of.height);
        let right_h = grade.height + 2.0 * 11.0 + 20.0 + 14.0;
        Self {
            height: left_h.max(right_h + 24.0),
            lead,
            score,
            out_of,
            grade,
            correct: &result.correct,
        }
    }

    fn paint(&self, svg: &mut String, top: f64) {
        let numbers_h = self.score.height.max(self.out_of.height);
        let left_y = top + self.height - (self.lead.height + 4.0 + numbers_h);
        svg.push_str(&text(MUTED, &self.lead.path(PAD_X, left_y)));
        let bottom = left_y + self.lead.height + 4.0 + numbers_h;
        let score_y = bottom - self.score.height;
        svg.push_str(&text(SIGNAL, &self.score.path(PAD_X, score_y)));
        let out_of_x = PAD_X + self.score.width + 12.0;
        let out_of_y = bottom - self.out_of.height;
        svg.push_str(&text(MUTED, &self.out_of.path(out_of_x, out_of_y)));

        let left_w = self
            .lead
            .width
            .max(self.score.width + 12.0 + self.out_of.width);
        let pill_h = self.grade.height + 2.0 * 8.0 + 2.0 * 3.0;
        let pill = Pill {
            x: PAD_X + left_w + 64.0,
            y: top + self.height - 24.0 - (pill_h + 20.0 + 14.0),
            w: self.grade.width + 2.0 * 32.0 + 2.0 * 3.0,
            h: pill_h,
        };
        svg.push_str(&format!(
            r#"<path fill="{ACCENT_SOFT}" d="{}"/>"#,
            pill.path()
        ));
        svg.push_str(&pill.border("grade", 3.0, ACCENT));
        let grade_path = self.grade.path(pill.x + 3.0 + 32.0, pill.y + 3.0 + 8.0);
        svg.push_str(&text(ACCENT_TEXT, &grade_path));
        let bars_y = pill.y + pill.h + 20.0;
        for (index, ok) in self.correct.iter().enumerate() {
            let color = if *ok { SIGNAL } else { BAR_OFF };
            let x = pill.x + index as f64 * 50.0;
            svg.push_str(&format!(
                r#"<path fill="{color}" d="{}"/>"#,
                rounded_rect(x, bars_y, 40.0, 14.0, 7.0)
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const IDS: &str = "aaaaaaa1aaaaaaa2aaaaaaa3";

    #[test]
    fn tokens_are_checked_as_decode_quiz_share_token_checks_them() {
        let result = decode_token(&format!("a005{IDS}")).expect("valid");
        assert_eq!(result.correct, [true, false, true]);
        assert_eq!(
            (result.score, result.grade, result.mode_label),
            (2, "밈러", "전체")
        );
        for bad in [
            format!("x005{IDS}"),
            format!("a00G{IDS}"),
            format!("a008{IDS}"),
            format!("a005{IDS}a"),
            "a005aaaaaaa1aaaaaaa1".to_owned(),
            "a005AAAAAAA1".to_owned(),
            "a005aaaa".to_owned(),
            format!("a005{}", "aaaaaaa1".repeat(0)),
        ] {
            assert_eq!(decode_token(&bad), None, "{bad}");
        }
    }

    #[test]
    fn grades_follow_the_percentage_bands() {
        assert_eq!(grade_label(9, 10), "밈장인");
        assert_eq!(grade_label(7, 10), "밈잘알");
        assert_eq!(grade_label(1, 2), "밈러");
        assert_eq!(grade_label(3, 10), "밈뉴비");
        assert_eq!(grade_label(0, 1), "밈세계 입문 환영");
    }
}
