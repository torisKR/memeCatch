//! A text node as Satori 0.25 lays it out and paints it (`ci()` in next/og's
//! bundle), for the styles the cards use: no transform, no tab, no line
//! clamp, `textAlign` start.
//!
//! - `whiteSpace` decides what is kept: `normal` turns `\n` into a space,
//!   collapses runs of spaces and tabs into one and drops one leading and one
//!   trailing space, and lets lines wrap; `pre` keeps everything on one line
//!   per required break.
//! - Words are the line break words (`linebreak.rs`). A word is measured as
//!   the sum of its graphemes measured alone. A line takes words while they
//!   fit the width, not counting the word's own trailing spaces.
//! - Each word is split again into `Intl.Segmenter` words; consecutive
//!   segments on one line are painted as one string until a segment that is
//!   a space (or another of Satori's breaking characters), which ends the
//!   run. A run starts at its first segment's measured position.
//! - On a node of several lines each run's x is rounded.

use super::engine::Engine;
use super::{linebreak, segment};
use crate::routes::public::js;

/// Satori's `ms`: segments after which a painted run ends.
const RUN_ENDS: [&str; 8] = [
    " ",
    "\u{a0}",
    "\u{1361}",
    "\u{10100}",
    "\u{10101}",
    "\u{1039}",
    "\u{1091}",
    "\n",
];

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum WhiteSpace {
    Normal,
    Pre,
}

/// `Sl(text, whiteSpace)`: the text Satori lays out.
fn process(text: &str, white_space: WhiteSpace) -> String {
    if white_space == WhiteSpace::Pre {
        return text.to_owned();
    }
    let mut out = String::with_capacity(text.len());
    let mut in_run = false;
    for c in text.chars().map(|c| if c == '\n' { ' ' } else { c }) {
        if c == ' ' || c == '\t' {
            if !in_run {
                out.push(' ');
            }
            in_run = true;
        } else {
            out.push(c);
            in_run = false;
        }
    }
    let out = out.strip_prefix(' ').unwrap_or(&out);
    out.strip_suffix(' ').unwrap_or(out).to_owned()
}

/// What a text node cannot be drawn from the embedded fonts with: Satori
/// would download a font or an emoji for these graphemes.
pub fn missing(engine: &Engine<'_>, text: &str, white_space: WhiteSpace) -> Vec<String> {
    let content = process(text, white_space);
    segment::graphemes(&content)
        .into_iter()
        .filter(|g| *g != "\t" && !engine.has(g))
        .map(str::to_owned)
        .collect()
}

/// A text character this port does not lay out: controls (a required break
/// or a tab) and line or paragraph separators.
pub fn is_unsupported(c: char) -> bool {
    (c.is_control() && c != '\n') || matches!(c, '\u{2028}' | '\u{2029}' | '\u{85}')
}

/// One segment as `PA` records it in `OA`.
#[derive(Clone, Debug)]
struct Placed {
    y: f64,
    x: f64,
    line: usize,
}

/// The state of the last `PA` call, which painting reads.
#[derive(Default, Debug)]
struct Lines {
    /// `oA`: the width of each line.
    widths: Vec<f64>,
    /// `BA`: the baseline of each line.
    baselines: Vec<f64>,
    /// `Y`: the segments.
    segments: Vec<String>,
    /// `OA`: their places (one more per empty word, as in Satori).
    placed: Vec<Placed>,
}

pub struct TextNode<'a> {
    engine: Engine<'a>,
    words: Vec<String>,
    required: Vec<bool>,
    soft_wrap: bool,
    collapse: bool,
    lines: Lines,
}

impl<'a> TextNode<'a> {
    pub fn new(engine: Engine<'a>, text: &str, white_space: WhiteSpace) -> Self {
        let content = process(text, white_space);
        let (words, required) = linebreak::words(&content);
        Self {
            words: words.into_iter().map(str::to_owned).collect(),
            required,
            soft_wrap: white_space == WhiteSpace::Normal,
            collapse: white_space == WhiteSpace::Normal,
            engine,
            lines: Lines::default(),
        }
    }

    /// `xA`: the graphemes measured one by one.
    fn measure_text(&self, text: &str) -> f64 {
        let mut width = 0.0;
        for grapheme in segment::graphemes(text) {
            width += self.engine.measure(grapheme);
        }
        width
    }

    /// `q(word)`: its width and the width of its trailing spaces.
    fn word_width(&self, word: &str) -> (f64, f64) {
        if word.is_empty() {
            return (0.0, 0.0);
        }
        let width = self.measure_text(word);
        let trimmed = word.trim_end_matches(js::is_space);
        let without = if trimmed == word {
            width
        } else {
            self.measure_text(trimmed)
        };
        (width, width - without)
    }

    /// `PA(V)`: fills lines of width `available`; returns the widest line and
    /// the height, and keeps the lines for painting.
    fn fill(&mut self, available: f64) -> (f64, f64) {
        let mut lines = Lines::default();
        let (mut line, mut widest, mut height) = (0usize, 0.0f64, 0.0);
        let (mut width, mut line_height, mut baseline, mut previous_spaces) = (0.0, 0.0, 0.0, 0.0);
        for index in 0..self.words.len() {
            let word = self.words[index].clone();
            let required = self.required.get(index).copied().unwrap_or(false);
            let (mut word_width, spaces) = self.word_width(&word);
            if required && line_height == 0.0 {
                line_height = self.engine.height(&word);
            }
            let wraps = index > 0 && width + word_width > available + spaces && self.soft_wrap;
            if required || wraps {
                if self.collapse && word == " " {
                    word_width = 0.0;
                }
                lines.widths.push(width - previous_spaces);
                lines.baselines.push(baseline);
                line += 1;
                height += line_height;
                width = word_width;
                line_height = if word_width != 0.0 {
                    self.engine.height(&word).round()
                } else {
                    0.0
                };
                baseline = if word_width != 0.0 {
                    self.engine.baseline(&word).round()
                } else {
                    0.0
                };
                if !required {
                    widest = widest.max(available);
                }
            } else {
                width += word_width;
                let rounded = self.engine.height(&word).round();
                if rounded > line_height {
                    line_height = rounded;
                    baseline = self.engine.baseline(&word).round();
                }
            }
            widest = widest.max(width);
            let mut x = width - word_width;
            if word_width == 0.0 {
                lines.placed.push(Placed { y: height, x, line });
            } else {
                for part in segment::words(&word) {
                    let part_width = self.engine.measure(&part);
                    lines.segments.push(part);
                    lines.placed.push(Placed { y: height, x, line });
                    x += part_width;
                }
            }
            previous_spaces = spaces;
        }
        if width != 0.0 {
            height += line_height;
            lines.widths.push(width);
            lines.baselines.push(baseline);
        }
        self.lines = lines;
        (widest, height)
    }

    /// The measure function Satori gives Yoga: `(ceil(width), height)`.
    pub fn measure(&mut self, available: f64) -> (f64, f64) {
        let (width, height) = self.fill(available);
        (width.ceil(), height)
    }

    /// The glyph path data of the node placed at `(left, top)`, as the last
    /// `measure` laid it out.
    pub fn paint(&self, left: f64, top: f64) -> String {
        let lines = &self.lines;
        let multi_line = lines.widths.len() > 1;
        let mut data = String::new();
        let mut pending: Option<(String, f64)> = None;
        for (index, segment) in lines.segments.iter().enumerate() {
            let Some(place) = lines.placed.get(index) else {
                continue;
            };
            let next = lines.placed.get(index + 1);
            let mut x = place.x;
            if multi_line {
                x = x.round();
            }
            let line_baseline = lines.baselines[place.line];
            let own = self.engine.baseline(segment);
            let shift = line_baseline - own;
            let joins = !RUN_ENDS.contains(&segment.as_str())
                && lines.segments.get(index + 1).is_some()
                && next.is_some_and(|next| next.y == place.y);
            if joins {
                match &mut pending {
                    Some((text, _)) => text.push_str(segment),
                    None => pending = Some((segment.clone(), x)),
                }
                continue;
            }
            let (text, start) = match pending.take() {
                Some((mut text, start)) => {
                    text.push_str(segment);
                    (text, start)
                }
                None => (segment.clone(), x),
            };
            let y = top + place.y + own + shift;
            data.push_str(&self.engine.svg(&text, left + start, y));
            data.push(' ');
        }
        data
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normal_white_space_collapses_and_trims_one_space() {
        assert_eq!(process("  a \t b\nc  ", WhiteSpace::Normal), "a b c");
        assert_eq!(process(" a ", WhiteSpace::Pre), " a ");
    }
}
