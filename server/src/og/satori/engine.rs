//! Satori's font engine for one text node (`getEngine`, `measure`, `getSVG`
//! and `patchFontFallbackResolver` of the class `ir` in next/og's bundle).
//!
//! - The fonts a node may use, in order: the node's own families, then every
//!   loaded font in the order it was loaded (the node's own again among
//!   them: their keys carry a `_unknown` suffix the family names lack).
//! - A string is drawn with the first of those whose cmap has its first
//!   code point, else with the last one. The choice is remembered per node
//!   by the string's first UTF-16 unit, so two astral characters with the
//!   same high surrogate get the font of the first (Satori's `charCodeAt`).
//! - A character the chosen font lacks is drawn with the glyph of the font
//!   chosen for that character alone, its outline and advance scaled by the
//!   ratio of the two `unitsPerEm`; kerning is still looked up in the first
//!   font with that glyph's own index.
//! - A grapheme is "missing" when the font chosen for it (without the last
//!   resort) lacks one of its characters. Satori then asks next/og to
//!   download a font or emoji for it; the caller hands such a card to Next.

use std::cell::RefCell;
use std::collections::HashMap;

use ttf_parser::GlyphId;

use crate::og::font::{Font, PathCommand, write_values};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LineHeight {
    Normal,
    /// A multiple of the font size.
    Times(f64),
}

#[derive(Clone, Copy, Debug)]
pub struct TextStyle {
    pub font_size: f64,
    pub line_height: LineHeight,
    pub letter_spacing: f64,
}

/// One glyph as opentype.js's `stringToGlyphs`, after Satori's fallback.
#[derive(Clone, Copy)]
struct Glyph {
    font: usize,
    id: GlyphId,
    /// `advanceWidth` in the first font's units.
    advance: f64,
    /// The `unitsPerEm` ratio for a fallback glyph, else 1.
    units: f64,
    /// A fallback glyph is a new object each time: never a cached path.
    fallback: bool,
}

pub struct Engine<'a> {
    fonts: Vec<&'a Font>,
    style: TextStyle,
    chosen: RefCell<HashMap<u16, usize>>,
}

fn first_unit(text: &str) -> Option<u16> {
    text.encode_utf16().next()
}

impl<'a> Engine<'a> {
    /// `fonts`: the node's own families, then every loaded font in order.
    pub fn new(fonts: Vec<&'a Font>, style: TextStyle) -> Self {
        assert!(!fonts.is_empty(), "a text node needs a font");
        Self {
            fonts,
            style,
            chosen: RefCell::new(HashMap::new()),
        }
    }

    pub fn style(&self) -> TextStyle {
        self.style
    }

    /// `d2(text, lastResort)`.
    fn pick(&self, text: &str, last_resort: bool) -> Option<usize> {
        let unit = first_unit(text)?;
        if let Some(found) = self.chosen.borrow().get(&unit) {
            return Some(*found);
        }
        let first = text.chars().next()?;
        let last = self.fonts.len() - 1;
        let found = (0..self.fonts.len())
            .find(|&i| self.fonts[i].glyph_id(first).is_some() || (last_resort && i == last))?;
        self.chosen.borrow_mut().insert(unit, found);
        Some(found)
    }

    fn font_for(&self, text: &str) -> usize {
        self.pick(text, true).unwrap_or(0)
    }

    /// `engine.has(grapheme)`.
    pub fn has(&self, grapheme: &str) -> bool {
        if grapheme == "\n" {
            return true;
        }
        let Some(index) = self.pick(grapheme, false) else {
            return false;
        };
        let font = self.fonts[index];
        grapheme.chars().all(|c| font.glyph_id(c).is_some())
    }

    fn glyphs(&self, text: &str, primary: usize) -> Vec<Glyph> {
        let font = self.fonts[primary];
        text.chars()
            .map(|c| match font.glyph_id(c) {
                Some(id) => Glyph {
                    font: primary,
                    id,
                    advance: font.glyph_advance(id),
                    units: 1.0,
                    fallback: false,
                },
                None => {
                    let other = self.font_for(c.encode_utf8(&mut [0; 4]));
                    if other == primary {
                        let id = GlyphId(0);
                        return Glyph {
                            font: primary,
                            id,
                            advance: font.glyph_advance(id),
                            units: 1.0,
                            fallback: false,
                        };
                    }
                    let source = self.fonts[other];
                    let id = source.glyph_id(c).unwrap_or(GlyphId(0));
                    let units = font.units_per_em() / source.units_per_em();
                    Glyph {
                        font: other,
                        id,
                        advance: source.glyph_advance(id) * units,
                        units,
                        fallback: true,
                    }
                }
            })
            .collect()
    }

    /// `forEachGlyph`: the pen position of each glyph, and after the last.
    fn pen(&self, glyphs: &[Glyph], primary: usize, start: f64) -> (Vec<f64>, f64) {
        let font = self.fonts[primary];
        let TextStyle {
            font_size,
            letter_spacing,
            ..
        } = self.style;
        let scale = 1.0 / font.units_per_em() * font_size;
        let mut x = start;
        let mut at = Vec::with_capacity(glyphs.len());
        for (index, glyph) in glyphs.iter().enumerate() {
            at.push(x);
            if glyph.advance != 0.0 {
                x += glyph.advance * scale;
            }
            if let Some(next) = glyphs.get(index + 1) {
                x += font.kerning_units(glyph.id.0, next.id.0) * scale;
            }
            if letter_spacing != 0.0 {
                x += letter_spacing / font_size * font_size;
            }
        }
        (at, x)
    }

    /// `engine.measure(text)`: `getAdvanceWidth` with the fallback glyphs.
    pub fn measure(&self, text: &str) -> f64 {
        let primary = self.font_for(text);
        let glyphs = self.glyphs(text, primary);
        self.pen(&glyphs, primary, 0.0).1
    }

    /// `engine.getSVG(text, { left, top })`: the path data of the glyphs.
    pub fn svg(&self, text: &str, left: f64, top: f64) -> String {
        let text = text.replace('\n', "");
        let primary = self.font_for(&text);
        let font = self.fonts[primary];
        let scale = 1.0 / font.units_per_em() * self.style.font_size;
        let glyphs = self.glyphs(&text, primary);
        let (at, _) = self.pen(&glyphs, primary, left);
        let mut cached: HashMap<u16, (f64, Vec<PathCommand>)> = HashMap::new();
        let mut data = String::new();
        for (glyph, x) in glyphs.iter().zip(at) {
            let (commands, shift) = match cached.get(&glyph.id.0).filter(|_| !glyph.fallback) {
                Some((first_x, commands)) => (commands.clone(), x - first_x),
                None => {
                    let raw = self.fonts[glyph.font].outline_values(glyph.id, glyph.units, scale);
                    let placed: Vec<PathCommand> = raw
                        .into_iter()
                        .map(|command| PathCommand {
                            letter: command.letter,
                            points: command
                                .points
                                .iter()
                                .map(|(px, py)| (x + px, top + py))
                                .collect(),
                        })
                        .collect();
                    if !glyph.fallback {
                        cached.insert(glyph.id.0, (x, placed.clone()));
                    }
                    (placed, 0.0)
                }
            };
            for command in commands {
                data.push(command.letter);
                let values: Vec<f64> = command
                    .points
                    .iter()
                    .flat_map(|(px, py)| [if shift == 0.0 { *px } else { px + shift }, *py])
                    .collect();
                write_values(&mut data, &values);
            }
        }
        data
    }

    fn metrics(&self, text: Option<&str>) -> (f64, f64, f64) {
        let font = self.fonts[text.map_or(0, |t| self.font_for(t))];
        let size = self.style.font_size;
        let ascender = font.ascender(size);
        let descender = font.descender(size);
        let height = match self.style.line_height {
            LineHeight::Normal => ascender - descender,
            LineHeight::Times(factor) => size * factor,
        };
        (ascender, descender, height)
    }

    /// `engine.height(word)`.
    pub fn height(&self, text: &str) -> f64 {
        self.metrics(Some(text)).2
    }

    /// `engine.baseline(word)`.
    pub fn baseline(&self, text: &str) -> f64 {
        let (ascender, descender, height) = self.metrics(Some(text));
        ascender + (height - (ascender - descender)) / 2.0
    }
}
