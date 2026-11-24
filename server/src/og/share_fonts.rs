//! The fonts of the meme share card (`assets/og-fonts/share`, copied to
//! `server/assets/og/share`): Korean, Japanese, Simplified and Traditional
//! Chinese, and thirteen Noto Emoji subsets in the order
//! `readdir(...).sort()` gives them in `lib/meme-share-card.tsx`.
//!
//! Two readers of the same files, as in the TypeScript: the app's own
//! advance table (`lib/ttf-metrics.ts`, `AppAdvances`) that
//! `fitShareLines` measures lines with, and the fonts Satori draws with.

use std::sync::OnceLock;

use super::font::Font;

/// `ShareFontKind` without the emoji.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Script {
    Ko,
    Ja,
    Zh,
    ZhTw,
}

const KO: &[u8] = include_bytes!("../../assets/og/share/ko.otf");
const JA: &[u8] = include_bytes!("../../assets/og/share/ja.otf");
const ZH: &[u8] = include_bytes!("../../assets/og/share/zh.otf");
const ZH_TW: &[u8] = include_bytes!("../../assets/og/share/zh-tw.otf");

macro_rules! emoji {
    ($($name:literal),*) => {
        [$(($name, include_bytes!(concat!("../../assets/og/share/emoji/", $name)) as &[u8])),*]
    };
}

/// Sorted as JavaScript sorts the names (code unit order).
pub const EMOJI: [(&str, &[u8]); 13] = emoji!(
    "noto-emoji-0-700-normal.ttf",
    "noto-emoji-1-700-normal.ttf",
    "noto-emoji-10-700-normal.ttf",
    "noto-emoji-11-700-normal.ttf",
    "noto-emoji-2-700-normal.ttf",
    "noto-emoji-3-700-normal.ttf",
    "noto-emoji-4-700-normal.ttf",
    "noto-emoji-5-700-normal.ttf",
    "noto-emoji-6-700-normal.ttf",
    "noto-emoji-7-700-normal.ttf",
    "noto-emoji-8-700-normal.ttf",
    "noto-emoji-9-700-normal.ttf",
    "noto-emoji-emoji-700-normal.ttf"
);

/// The four script fonts as `(file, bytes)`, for the asset test.
pub const SCRIPT_FILES: [(&str, &[u8]); 4] = [
    ("ko.otf", KO),
    ("ja.otf", JA),
    ("zh.otf", ZH),
    ("zh-tw.otf", ZH_TW),
];

fn u16_at(data: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_be_bytes(
        data.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn u32_at(data: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_be_bytes(
        data.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

/// `readFontAdvances`: advances by code point from the cmap subtables of
/// format 4, then 12, each later mapping replacing an earlier one.
pub struct AppAdvances {
    data: &'static [u8],
    pub units_per_em: f64,
    hmtx: usize,
    metrics: usize,
    format4: Vec<usize>,
    format12: Vec<usize>,
}

impl AppAdvances {
    pub fn new(data: &'static [u8]) -> Self {
        let tables = usize::from(u16_at(data, 4).expect("a font"));
        let table = |tag: &[u8; 4]| {
            (0..tables).find_map(|index| {
                let record = 12 + index * 16;
                (data.get(record..record + 4)? == tag)
                    .then(|| u32_at(data, record + 8))
                    .flatten()
                    .map(|offset| offset as usize)
            })
        };
        let (head, hhea, hmtx, cmap) = (
            table(b"head").expect("head"),
            table(b"hhea").expect("hhea"),
            table(b"hmtx").expect("hmtx"),
            table(b"cmap").expect("cmap"),
        );
        let subtables = usize::from(u16_at(data, cmap + 2).expect("cmap"));
        let offsets: Vec<usize> = (0..subtables)
            .filter_map(|index| u32_at(data, cmap + 4 + index * 8 + 4))
            .map(|offset| cmap + offset as usize)
            .collect();
        let with_format = |format: u16| {
            offsets
                .iter()
                .copied()
                .filter(|offset| u16_at(data, *offset) == Some(format))
                .collect::<Vec<_>>()
        };
        Self {
            units_per_em: f64::from(u16_at(data, head + 18).expect("head")),
            metrics: usize::from(u16_at(data, hhea + 34).expect("hhea")),
            hmtx,
            format4: with_format(4),
            format12: with_format(12),
            data,
        }
    }

    fn advance_of(&self, glyph: u32) -> f64 {
        let index = if (glyph as usize) < self.metrics {
            glyph as usize
        } else {
            self.metrics - 1
        };
        f64::from(u16_at(self.data, self.hmtx + index * 4).unwrap_or(0))
    }

    fn format4_glyph(&self, offset: usize, code: u32) -> Option<u32> {
        let data = self.data;
        let segments = usize::from(u16_at(data, offset + 6)? / 2);
        let ends = offset + 14;
        let starts = ends + segments * 2 + 2;
        let deltas = starts + segments * 2;
        let ranges = deltas + segments * 2;
        (0..segments).rev().find_map(|index| {
            let end = u32::from(u16_at(data, ends + index * 2)?);
            let start = u32::from(u16_at(data, starts + index * 2)?);
            if (start == 0xffff && end == 0xffff) || code < start || code > end {
                return None;
            }
            let delta = u32::from(u16_at(data, deltas + index * 2)?);
            let range = usize::from(u16_at(data, ranges + index * 2)?);
            let glyph = if range == 0 {
                (code + delta) & 0xffff
            } else {
                let at = ranges + index * 2 + range + (code - start) as usize * 2;
                let raw = u32::from(u16_at(data, at)?);
                if raw == 0 { 0 } else { (raw + delta) & 0xffff }
            };
            (glyph != 0).then_some(glyph)
        })
    }

    fn format12_glyph(&self, offset: usize, code: u32) -> Option<u32> {
        let groups = u32_at(self.data, offset + 12)? as usize;
        (0..groups).rev().find_map(|index| {
            let group = offset + 16 + index * 12;
            let (start, end) = (u32_at(self.data, group)?, u32_at(self.data, group + 4)?);
            if code < start || code > end {
                return None;
            }
            let glyph = u32_at(self.data, group + 8)? + (code - start);
            (glyph != 0).then_some(glyph)
        })
    }

    /// `advances.get(codePoint)`.
    pub fn get(&self, code: u32) -> Option<f64> {
        let glyph = self
            .format12
            .iter()
            .rev()
            .find_map(|offset| self.format12_glyph(*offset, code))
            .or_else(|| {
                self.format4
                    .iter()
                    .rev()
                    .find_map(|offset| self.format4_glyph(*offset, code))
            })?;
        Some(self.advance_of(glyph))
    }
}

pub struct ShareFonts {
    pub scripts: [Font; 4],
    pub emoji: Vec<Font>,
    script_advances: [AppAdvances; 4],
    emoji_advances: Vec<AppAdvances>,
}

impl ShareFonts {
    pub fn get() -> &'static ShareFonts {
        static FONTS: OnceLock<ShareFonts> = OnceLock::new();
        FONTS.get_or_init(|| ShareFonts {
            scripts: [KO, JA, ZH, ZH_TW].map(Font::new),
            emoji: EMOJI.iter().map(|(_, data)| Font::new(data)).collect(),
            script_advances: [KO, JA, ZH, ZH_TW].map(AppAdvances::new),
            emoji_advances: EMOJI
                .iter()
                .map(|(_, data)| AppAdvances::new(data))
                .collect(),
        })
    }

    pub fn script(&self, script: Script) -> &Font {
        &self.scripts[script as usize]
    }

    pub fn script_advances(&self, script: Script) -> &AppAdvances {
        &self.script_advances[script as usize]
    }

    /// `emojiFaceName`: the first emoji font whose table has the code point.
    pub fn emoji_face(&self, code: u32) -> Option<usize> {
        self.emoji_advances
            .iter()
            .position(|font| font.get(code).is_some())
    }

    /// The `emoji` entry of `ShareFontSet`: the first advance found, and the
    /// last font's `unitsPerEm`.
    pub fn emoji_advance(&self, code: u32) -> (Option<f64>, f64) {
        let units = self
            .emoji_advances
            .last()
            .map_or(1000.0, |font| font.units_per_em);
        let advance = self.emoji_advances.iter().find_map(|font| font.get(code));
        (advance, units)
    }
}
