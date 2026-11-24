//! A font as Satori 0.25 (in `next/og`) uses it through its bundled
//! opentype.js (`@shuding/opentype.js` 1.4.0-beta.0):
//!
//! - glyphs from `cmap`, advances from `hmtx`, ascender and descender from
//!   `hhea` (Satori reads `font.ascender`, never the OS/2 typo metrics);
//! - kerning from GPOS only through the default script (`DFLT`, else `latn`),
//!   its default language system, the `kern` feature, and lookups whose type
//!   is 2 itself. An extension lookup (type 9) is skipped, as opentype.js's
//!   `getLookupTables(script, language, "kern", 2)` skips it;
//! - `forEachGlyph`: after each glyph the advance, then the kerning to the
//!   next glyph, then the letter spacing;
//! - outlines at `x + px * scale`, `y - py * scale`, written by
//!   `Path.toPathData(1)`.
//!
//! No GSUB feature is applied: none of the fonts used here has `liga` or
//! `rlig` (opentype.js applies only those, and the Arabic forms), which a
//! test checks.

use ttf_parser::{Face, GlyphId, OutlineBuilder, Tag};

pub struct Font {
    face: Face<'static>,
    units_per_em: f64,
    ascender: f64,
    descender: f64,
    kern: Vec<PairSubtable>,
}

impl Font {
    /// Panics on bytes that are not a font: the fonts are compiled in.
    pub fn new(data: &'static [u8]) -> Self {
        let face = Face::parse(data, 0).expect("an embedded font parses");
        let hhea = face.tables().hhea;
        let kern = face
            .raw_face()
            .table(Tag::from_bytes(b"GPOS"))
            .and_then(kern_subtables)
            .unwrap_or_default();
        Self {
            units_per_em: f64::from(face.units_per_em()),
            ascender: f64::from(hhea.ascender),
            descender: f64::from(hhea.descender),
            face,
            kern,
        }
    }

    pub fn has_glyph(&self, character: char) -> bool {
        self.face.glyph_index(character).is_some()
    }

    /// Whether the GSUB table names `tag` as a feature at all.
    #[cfg(test)]
    pub fn has_gsub_feature(&self, tag: &[u8; 4]) -> bool {
        let Some(gsub) = self.face.raw_face().table(Tag::from_bytes(b"GSUB")) else {
            return false;
        };
        let Some(features) = u16_at(gsub, 6).map(usize::from) else {
            return false;
        };
        let count = u16_at(gsub, features).map_or(0, usize::from);
        (0..count).any(|index| {
            let record = features + 2 + index * 6;
            gsub.get(record..record + 4) == Some(&tag[..])
        })
    }

    fn glyph(&self, character: char) -> GlyphId {
        self.face.glyph_index(character).unwrap_or(GlyphId(0))
    }

    /// `charToGlyphIndex`: the glyph of `character`, `None` for index 0.
    pub fn glyph_id(&self, character: char) -> Option<GlyphId> {
        self.face
            .glyph_index(character)
            .filter(|glyph| glyph.0 != 0)
    }

    pub fn units_per_em(&self) -> f64 {
        self.units_per_em
    }

    /// `glyph.advanceWidth` in font units.
    pub fn glyph_advance(&self, glyph: GlyphId) -> f64 {
        f64::from(self.face.glyph_hor_advance(glyph).unwrap_or(0))
    }

    /// `getKerningValue` for two glyph indices, in font units. The indices
    /// may come from another font (Satori's fallback glyphs keep theirs).
    pub fn kerning_units(&self, left: u16, right: u16) -> f64 {
        f64::from(self.kerning(GlyphId(left), GlyphId(right)))
    }

    /// The outline of `glyph` from `(x, y)`, each font unit first multiplied
    /// by `units` (a fallback glyph's `unitsPerEm` ratio) and then by
    /// `scale`, into `out` as `toPathData(1)` writes it. `shift` adds a pen
    /// offset after the absolute value is formed, as opentype.js's cached
    /// path of a repeated glyph does.
    pub fn outline_values(&self, glyph: GlyphId, units: f64, scale: f64) -> Vec<PathCommand> {
        let mut collector = CommandCollector {
            commands: Vec::new(),
            units,
            scale,
        };
        self.face.outline_glyph(glyph, &mut collector);
        collector.commands
    }

    fn scale(&self, font_size: f64) -> f64 {
        1.0 / self.units_per_em * font_size
    }

    /// `ascender / unitsPerEm * fontSize`.
    pub fn ascender(&self, font_size: f64) -> f64 {
        self.ascender / self.units_per_em * font_size
    }

    pub fn descender(&self, font_size: f64) -> f64 {
        self.descender / self.units_per_em * font_size
    }

    fn kerning(&self, left: GlyphId, right: GlyphId) -> i16 {
        self.kern
            .iter()
            .find_map(|subtable| subtable.value(left.0, right.0))
            .unwrap_or(0)
    }

    /// `font.forEachGlyph(text, x, y, fontSize, { letterSpacing })` with a
    /// callback per glyph; returns the pen position after the last glyph.
    fn for_each_glyph(
        &self,
        text: &str,
        mut x: f64,
        font_size: f64,
        letter_spacing: f64,
        mut each: impl FnMut(GlyphId, f64),
    ) -> f64 {
        let scale = self.scale(font_size);
        let glyphs: Vec<GlyphId> = text.chars().map(|c| self.glyph(c)).collect();
        for (index, glyph) in glyphs.iter().enumerate() {
            each(*glyph, x);
            let advance = self.face.glyph_hor_advance(*glyph).unwrap_or(0);
            if advance != 0 {
                x += f64::from(advance) * scale;
            }
            if let Some(next) = glyphs.get(index + 1) {
                x += f64::from(self.kerning(*glyph, *next)) * scale;
            }
            // Satori passes `letterSpacing / fontSize`; opentype.js adds
            // `options.letterSpacing * fontSize`.
            if letter_spacing != 0.0 {
                x += letter_spacing / font_size * font_size;
            }
        }
        x
    }

    /// `getAdvanceWidth(text, fontSize, { letterSpacing })`.
    pub fn advance(&self, text: &str, font_size: f64, letter_spacing: f64) -> f64 {
        self.for_each_glyph(text, 0.0, font_size, letter_spacing, |_, _| {})
    }

    /// The glyphs of `text` from `(x, baseline)` as path data.
    pub fn path(
        &self,
        text: &str,
        x: f64,
        baseline: f64,
        font_size: f64,
        letter_spacing: f64,
    ) -> String {
        let scale = self.scale(font_size);
        let mut data = String::new();
        self.for_each_glyph(text, x, font_size, letter_spacing, |glyph, at| {
            let mut writer = PathWriter {
                out: &mut data,
                x: at,
                y: baseline,
                scale,
            };
            self.face.outline_glyph(glyph, &mut writer);
        });
        data
    }
}

/// One outline command with its points as `x + px * scale` and
/// `y + -py * scale` would add them: `(px * scale, -py * scale)`.
#[derive(Clone, Debug)]
pub struct PathCommand {
    pub letter: char,
    pub points: Vec<(f64, f64)>,
}

struct CommandCollector {
    commands: Vec<PathCommand>,
    units: f64,
    scale: f64,
}

impl CommandCollector {
    fn push(&mut self, letter: char, points: &[(f32, f32)]) {
        let points = points
            .iter()
            .map(|(px, py)| {
                (
                    f64::from(*px) * self.units * self.scale,
                    -(f64::from(*py) * self.units) * self.scale,
                )
            })
            .collect();
        self.commands.push(PathCommand { letter, points });
    }
}

impl OutlineBuilder for CommandCollector {
    fn move_to(&mut self, x: f32, y: f32) {
        self.push('M', &[(x, y)]);
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.push('L', &[(x, y)]);
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.push('Q', &[(x1, y1), (x, y)]);
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.push('C', &[(x1, y1), (x2, y2), (x, y)]);
    }
    fn close(&mut self) {
        self.push('Z', &[]);
    }
}

/// `packValues` of `toPathData(1)` for absolute values.
pub fn write_values(out: &mut String, values: &[f64]) {
    pack_values(out, values);
}

struct PathWriter<'a> {
    out: &'a mut String,
    x: f64,
    y: f64,
    scale: f64,
}

impl PathWriter<'_> {
    fn command(&mut self, letter: char, points: &[(f32, f32)]) {
        self.out.push(letter);
        let values: Vec<f64> = points
            .iter()
            .flat_map(|(px, py)| {
                [
                    self.x + f64::from(*px) * self.scale,
                    self.y + -f64::from(*py) * self.scale,
                ]
            })
            .collect();
        pack_values(self.out, &values);
    }
}

impl OutlineBuilder for PathWriter<'_> {
    fn move_to(&mut self, x: f32, y: f32) {
        self.command('M', &[(x, y)]);
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.command('L', &[(x, y)]);
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.command('Q', &[(x1, y1), (x, y)]);
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.command('C', &[(x1, y1), (x2, y2), (x, y)]);
    }
    fn close(&mut self) {
        self.out.push('Z');
    }
}

/// `packValues` of `toPathData`: a space before every value but the first,
/// unless the value is negative.
fn pack_values(out: &mut String, values: &[f64]) {
    for (index, value) in values.iter().enumerate() {
        if *value >= 0.0 && index > 0 {
            out.push(' ');
        }
        out.push_str(&float_to_string(*value));
    }
}

/// `floatToString` of `toPathData(1)`: an integer as one, anything else as
/// `Number.prototype.toFixed(1)`, which rounds the exact value half up.
pub fn float_to_string(value: f64) -> String {
    if value.fract() == 0.0 {
        // `"" + Math.round(-0)` is "0".
        return format!("{}", value as i64);
    }
    // Every f64 of this size has an exact decimal expansion this long.
    let exact = format!("{:.60}", value.abs());
    let (whole, fraction) = exact.split_once('.').expect("a decimal point");
    let digits = fraction.as_bytes();
    let mut tenths =
        whole.parse::<u64>().expect("an integer part") * 10 + u64::from(digits[0] - b'0');
    if digits[1] >= b'5' {
        tenths += 1;
    }
    let sign = if value < 0.0 { "-" } else { "" };
    format!("{sign}{}.{}", tenths / 10, tenths % 10)
}

fn u16_at(data: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_be_bytes(
        data.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn i16_at(data: &[u8], offset: usize) -> Option<i16> {
    Some(i16::from_be_bytes(
        data.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

/// One PairPos subtable of a kerning lookup, kept as its bytes.
struct PairSubtable {
    data: &'static [u8],
}

/// The PairPos subtables opentype.js kerns with, in lookup order.
fn kern_subtables(gpos: &'static [u8]) -> Option<Vec<PairSubtable>> {
    let scripts = usize::from(u16_at(gpos, 4)?);
    let features = usize::from(u16_at(gpos, 6)?);
    let lookups = usize::from(u16_at(gpos, 8)?);
    let script = default_script(gpos, scripts)?;
    let default_lang_sys = usize::from(u16_at(gpos, script)?);
    if default_lang_sys == 0 {
        return None;
    }
    let lang_sys = script + default_lang_sys;
    let feature_count = usize::from(u16_at(gpos, lang_sys + 4)?);
    // `getFeatureTable`: the first `kern` feature of the language system.
    let feature = (0..feature_count).find_map(|index| {
        let feature_index = usize::from(u16_at(gpos, lang_sys + 6 + index * 2)?);
        let record = features + 2 + feature_index * 6;
        (gpos.get(record..record + 4)? == b"kern")
            .then(|| u16_at(gpos, record + 4).map(|offset| features + usize::from(offset)))
            .flatten()
    })?;
    let mut found = Vec::new();
    let lookup_count = usize::from(u16_at(gpos, feature + 2)?);
    for lookup in 0..lookup_count {
        let lookup_index = usize::from(u16_at(gpos, feature + 4 + lookup * 2)?);
        let table = lookups + usize::from(u16_at(gpos, lookups + 2 + lookup_index * 2)?);
        if u16_at(gpos, table)? != 2 {
            continue;
        }
        let count = usize::from(u16_at(gpos, table + 4)?);
        for sub in 0..count {
            let offset = table + usize::from(u16_at(gpos, table + 6 + sub * 2)?);
            found.push(PairSubtable {
                data: gpos.get(offset..)?,
            });
        }
    }
    Some(found)
}

/// The Script table of `DFLT`, else `latn` (`getDefaultScriptName`).
fn default_script(gpos: &[u8], scripts: usize) -> Option<usize> {
    let count = usize::from(u16_at(gpos, scripts)?);
    let find = |tag: &[u8; 4]| {
        (0..count).find_map(|index| {
            let record = scripts + 2 + index * 6;
            (gpos.get(record..record + 4)? == tag)
                .then(|| u16_at(gpos, record + 4).map(|offset| scripts + usize::from(offset)))
                .flatten()
        })
    };
    find(b"DFLT").or_else(|| find(b"latn"))
}

impl PairSubtable {
    /// `Position.getKerningValue` for this subtable: `None` goes on to the
    /// next subtable.
    fn value(&self, left: u16, right: u16) -> Option<i16> {
        let data = self.data;
        let coverage = usize::from(u16_at(data, 2)?);
        let covered = coverage_index(data.get(coverage..)?, left)?;
        let format1 = u16_at(data, 4)?;
        let size1 = value_record_size(format1);
        let size2 = value_record_size(u16_at(data, 6)?);
        // `value1.xAdvance || 0`: XPlacement and YPlacement come first.
        let x_advance = |record: usize| -> i16 {
            if format1 & 0x4 == 0 {
                return 0;
            }
            let before = (format1 & 0x3).count_ones() as usize * 2;
            i16_at(data, record + before).unwrap_or(0)
        };
        match u16_at(data, 0)? {
            1 => {
                let set = usize::from(u16_at(data, 10 + covered * 2)?);
                let pairs = usize::from(u16_at(data, set)?);
                let stride = 2 + size1 + size2;
                (0..pairs)
                    .map(|index| set + 2 + index * stride)
                    .find(|record| u16_at(data, *record) == Some(right))
                    .map(|record| x_advance(record + 2))
            }
            2 => {
                let class_def1 = usize::from(u16_at(data, 8)?);
                let class_def2 = usize::from(u16_at(data, 10)?);
                let class2_count = usize::from(u16_at(data, 14)?);
                let class1 = glyph_class(data.get(class_def1..)?, left);
                let class2 = glyph_class(data.get(class_def2..)?, right);
                Some(x_advance(
                    16 + (class1 * class2_count + class2) * (size1 + size2),
                ))
            }
            _ => None,
        }
    }
}

fn value_record_size(format: u16) -> usize {
    (format & 0xff).count_ones() as usize * 2
}

fn coverage_index(table: &[u8], glyph: u16) -> Option<usize> {
    let count = usize::from(u16_at(table, 2)?);
    match u16_at(table, 0)? {
        1 => (0..count).find(|index| u16_at(table, 4 + index * 2) == Some(glyph)),
        2 => (0..count).find_map(|index| {
            let range = 4 + index * 6;
            let (start, end) = (u16_at(table, range)?, u16_at(table, range + 2)?);
            let first = usize::from(u16_at(table, range + 4)?);
            (start..=end)
                .contains(&glyph)
                .then(|| first + usize::from(glyph - start))
        }),
        _ => None,
    }
}

/// `getGlyphClass`: the class, or 0 for a glyph the table does not list.
fn glyph_class(table: &[u8], glyph: u16) -> usize {
    let class = match u16_at(table, 0) {
        Some(1) => u16_at(table, 2)
            .zip(u16_at(table, 4))
            .and_then(|(start, count)| {
                let index = glyph.checked_sub(start).filter(|index| *index < count)?;
                u16_at(table, 6 + usize::from(index) * 2)
            }),
        Some(2) => u16_at(table, 2).and_then(|count| {
            (0..usize::from(count)).find_map(|index| {
                let range = 4 + index * 6;
                let (start, end) = (u16_at(table, range)?, u16_at(table, range + 2)?);
                (start..=end)
                    .contains(&glyph)
                    .then(|| u16_at(table, range + 4))
                    .flatten()
            })
        }),
        _ => None,
    };
    usize::from(class.unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_are_written_as_to_fixed_one_writes_them() {
        assert_eq!(float_to_string(240.0), "240");
        assert_eq!(float_to_string(-0.0), "0");
        assert_eq!(float_to_string(545.1), "545.1");
        // Exact ties round up, as toFixed does: 0.25 is exact in binary.
        assert_eq!(float_to_string(0.25), "0.3");
        assert_eq!(float_to_string(-0.25), "-0.3");
        // 1.45 is stored as 1.4499999…, so it rounds down.
        assert_eq!(float_to_string(1.45), "1.4");
        assert_eq!(float_to_string(1.96), "2.0");
    }
}
