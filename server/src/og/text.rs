//! A one-line text node as Satori 0.25 lays it out and paints it
//! (`next/dist/compiled/@vercel/og/index.node.js`, the text pass of
//! `ci()` and its measure function):
//!
//! - its width is `Math.ceil` of the sum of each grapheme measured alone
//!   (`measureText`: no kerning between graphemes);
//! - its height is `Math.round` of the line height (`normal`: hhea ascender
//!   minus descender; a number: that times the font size);
//! - the baseline sits `Math.round(ascender + (height - (ascender -
//!   descender)) / 2)` below its top, with the unrounded height;
//! - glyphs are painted in runs that end after each space: a run starts at
//!   the measured width of the text before it and is drawn with the font's
//!   own advances and kerning (`getSVG` over the joined words).
//!
//! The texts painted here have no tab, no non-breaking or other special
//! space, and one character per grapheme; `TextLine::new` checks the last.

use std::borrow::Cow;

use super::font::Font;

#[derive(Clone, Copy)]
pub enum LineHeight {
    Normal,
    /// A multiple of the font size.
    Times(f64),
}

pub struct TextLine<'a> {
    font: &'a Font,
    text: Cow<'a, str>,
    font_size: f64,
    letter_spacing: f64,
    pub width: f64,
    pub height: f64,
    baseline: f64,
}

impl<'a> TextLine<'a> {
    pub fn new(font: &'a Font, text: &'a str, font_size: f64, line_height: LineHeight) -> Self {
        Self::spaced(font, Cow::Borrowed(text), font_size, line_height, 0.0)
    }

    pub fn owned(font: &'a Font, text: String, font_size: f64, line_height: LineHeight) -> Self {
        Self::spaced(font, Cow::Owned(text), font_size, line_height, 0.0)
    }

    fn spaced(
        font: &'a Font,
        text: Cow<'a, str>,
        font_size: f64,
        line_height: LineHeight,
        letter_spacing: f64,
    ) -> Self {
        debug_assert!(
            text.chars()
                .all(|c| !c.is_control() && c != '\u{a0}' && !is_combining(c)),
            "{text:?} needs grapheme segmentation"
        );
        let ascender = font.ascender(font_size);
        let content = ascender - font.descender(font_size);
        let height = match line_height {
            LineHeight::Normal => content,
            LineHeight::Times(factor) => font_size * factor,
        };
        let measured: f64 = text
            .chars()
            .map(|c| font.advance(c.encode_utf8(&mut [0; 4]), font_size, letter_spacing))
            .sum();
        Self {
            font,
            text,
            font_size,
            letter_spacing,
            width: measured.ceil(),
            height: height.round(),
            baseline: (ascender + (height - content) / 2.0).round(),
        }
    }

    /// The glyph path data of the line placed with its box at `(left, top)`.
    pub fn path(&self, left: f64, top: f64) -> String {
        let mut data = String::new();
        let mut offset = 0.0;
        for run in self.text.split_inclusive(' ') {
            data.push_str(&self.font.path(
                run,
                left + offset,
                top + self.baseline,
                self.font_size,
                self.letter_spacing,
            ));
            data.push(' ');
            offset += run
                .chars()
                .map(|c| {
                    self.font.advance(
                        c.encode_utf8(&mut [0; 4]),
                        self.font_size,
                        self.letter_spacing,
                    )
                })
                .sum::<f64>();
        }
        data
    }
}

/// The combining marks a card text could carry; any of them would join the
/// grapheme before it.
fn is_combining(c: char) -> bool {
    matches!(c, '\u{300}'..='\u{36f}' | '\u{1ab0}'..='\u{1aff}' | '\u{20d0}'..='\u{20ff}' | '\u{fe00}'..='\u{fe0f}' | '\u{200d}')
}
