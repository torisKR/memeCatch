//! `Intl.Segmenter` as Satori uses it (`ge` in next/og's bundle): grapheme
//! clusters (UAX #29 with the Indic conjunct rule, as ICU has them), and
//! words (UAX #29 word boundaries, then Satori's merge of a no-break space
//! into the words on either side). ICU's dictionary segmentation of Han and
//! kana runs is not reproduced: Satori only segments inside one line-break
//! word, where such a run is a single ideograph or a kana with its small
//! kana, and the words there only decide where a painted run ends
//! (`text.rs`). `tests/og_text.rs` holds both to Node.

use icu_properties::props::{
    ExtendedPictographic, GraphemeClusterBreak as G, IndicConjunctBreak as InCB, WordBreak as W,
};
use icu_properties::{CodePointMapData, CodePointSetData};

fn gcb(c: char) -> G {
    CodePointMapData::<G>::new().get(c)
}

fn incb(c: char) -> InCB {
    CodePointMapData::<InCB>::new().get(c)
}

fn pictographic(c: char) -> bool {
    CodePointSetData::new::<ExtendedPictographic>().contains(c)
}

fn wb(c: char) -> W {
    CodePointMapData::<W>::new().get(c)
}

/// The state that rules GB9c, GB11 and GB12/13 carry along a cluster.
#[derive(Default)]
struct GraphemeState {
    /// GB11: an Extended_Pictographic, then Extend*, then (maybe) ZWJ.
    pictographic: bool,
    zwj_after_pictographic: bool,
    /// GB9c: a consonant, then extends and linkers, at least one linker.
    consonant: bool,
    linker: bool,
    regional_count: usize,
}

impl GraphemeState {
    fn update(&mut self, c: char) {
        let class = gcb(c);
        if pictographic(c) {
            self.pictographic = true;
            self.zwj_after_pictographic = false;
        } else if class == G::ZWJ && self.pictographic {
            self.zwj_after_pictographic = true;
        } else if class != G::Extend || self.zwj_after_pictographic {
            self.pictographic = false;
            self.zwj_after_pictographic = false;
        }
        match incb(c) {
            InCB::Consonant => {
                self.consonant = true;
                self.linker = false;
            }
            InCB::Linker if self.consonant => self.linker = true,
            InCB::Extend if self.consonant => {}
            _ => {
                self.consonant = false;
                self.linker = false;
            }
        }
        if class == G::RegionalIndicator {
            self.regional_count += 1;
        } else {
            self.regional_count = 0;
        }
    }
}

fn joins(before: char, after: char, state: &GraphemeState) -> bool {
    let (a, b) = (gcb(before), gcb(after));
    match (a, b) {
        (G::CR, G::LF) => return true,
        (G::Control | G::CR | G::LF, _) | (_, G::Control | G::CR | G::LF) => return false,
        (G::L, G::L | G::V | G::LV | G::LVT)
        | (G::LV | G::V, G::V | G::T)
        | (G::LVT | G::T, G::T)
        | (_, G::Extend | G::ZWJ | G::SpacingMark)
        | (G::Prepend, _) => return true,
        _ => {}
    }
    if incb(after) == InCB::Consonant && state.consonant && state.linker {
        return true;
    }
    if pictographic(after) && state.zwj_after_pictographic && a == G::ZWJ {
        return true;
    }
    a == G::RegionalIndicator && b == G::RegionalIndicator && state.regional_count % 2 == 1
}

/// `ge(text, "grapheme")`.
pub fn graphemes(text: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut state = GraphemeState::default();
    let mut previous: Option<char> = None;
    for (index, c) in text.char_indices() {
        if let Some(before) = previous
            && !joins(before, c, &state)
        {
            out.push(&text[start..index]);
            start = index;
            state = GraphemeState::default();
        }
        state.update(c);
        previous = Some(c);
    }
    if start < text.len() {
        out.push(&text[start..]);
    }
    out
}

fn is_hangul(c: char) -> bool {
    matches!(c, '\u{1100}'..='\u{11ff}' | '\u{3130}'..='\u{318f}' | '\u{a960}'..='\u{a97f}' | '\u{ac00}'..='\u{d7a3}' | '\u{d7b0}'..='\u{d7ff}')
}

fn ignorable(class: W) -> bool {
    matches!(class, W::Extend | W::Format | W::ZWJ)
}

fn letter(class: W) -> bool {
    matches!(class, W::ALetter | W::HebrewLetter)
}

fn mid_letter(class: W) -> bool {
    matches!(class, W::MidLetter | W::MidNumLet | W::SingleQuote)
}

fn mid_num(class: W) -> bool {
    matches!(class, W::MidNum | W::MidNumLet | W::SingleQuote)
}

fn newline(class: W) -> bool {
    matches!(class, W::Newline | W::CR | W::LF)
}

/// The class of the base before index `i` (WB4 skips the ignorables), and
/// of the base before that.
fn bases_before(classes: &[W], i: usize) -> (Option<W>, Option<W>) {
    let mut found = classes[..i]
        .iter()
        .rev()
        .copied()
        .filter(|c| !ignorable(*c));
    (found.next(), found.next())
}

/// UAX #29 word boundary between `chars[i - 1]` and `chars[i]`.
fn word_joins(chars: &[char], classes: &[W], i: usize) -> bool {
    let (raw_a, b) = (classes[i - 1], classes[i]);
    if raw_a == W::CR && b == W::LF {
        return true;
    }
    if newline(raw_a) || newline(b) {
        return false;
    }
    if raw_a == W::ZWJ && pictographic(chars[i]) {
        return true;
    }
    if raw_a == W::WSegSpace && b == W::WSegSpace {
        return true;
    }
    if ignorable(b) {
        return true;
    }
    let (Some(a), a_prev) = bases_before(classes, i) else {
        return false;
    };
    // ICU keeps Hangul to itself: it joins Hangul only.
    let base = (0..i).rev().find(|&j| !ignorable(classes[j]));
    let (hangul_a, hangul_b) = (
        base.is_some_and(|j| is_hangul(chars[j])),
        is_hangul(chars[i]),
    );
    if hangul_a || hangul_b {
        return hangul_a && hangul_b;
    }
    let b_next = classes[i + 1..].iter().copied().find(|c| !ignorable(*c));
    let regional = classes[..i]
        .iter()
        .rev()
        .filter(|c| !ignorable(**c))
        .take_while(|c| **c == W::RegionalIndicator)
        .count();
    match (a, b) {
        _ if letter(a) && letter(b) => true,
        _ if letter(a) && mid_letter(b) && b_next.is_some_and(letter) => true,
        _ if a_prev.is_some_and(letter) && mid_letter(a) && letter(b) => true,
        (W::HebrewLetter, W::SingleQuote) => true,
        (W::HebrewLetter, W::DoubleQuote) => b_next == Some(W::HebrewLetter),
        (W::DoubleQuote, W::HebrewLetter) => a_prev == Some(W::HebrewLetter),
        (W::Numeric, W::Numeric) => true,
        _ if letter(a) && b == W::Numeric => true,
        _ if a == W::Numeric && letter(b) => true,
        _ if a_prev == Some(W::Numeric) && mid_num(a) && b == W::Numeric => true,
        _ if a == W::Numeric && mid_num(b) && b_next == Some(W::Numeric) => true,
        (W::Katakana, W::Katakana) => true,
        (
            W::ALetter | W::HebrewLetter | W::Numeric | W::Katakana | W::ExtendNumLet,
            W::ExtendNumLet,
        ) => true,
        (W::ExtendNumLet, W::ALetter | W::HebrewLetter | W::Numeric | W::Katakana) => true,
        (W::RegionalIndicator, W::RegionalIndicator) => regional % 2 == 1,
        _ => false,
    }
}

/// UAX #29 words.
fn uax29_words(text: &str) -> Vec<&str> {
    let offsets: Vec<usize> = text.char_indices().map(|(i, _)| i).collect();
    let chars: Vec<char> = text.chars().collect();
    let classes: Vec<W> = chars.iter().map(|c| wb(*c)).collect();
    let mut out = Vec::new();
    let mut start = 0;
    for i in 1..chars.len() {
        if !word_joins(&chars, &classes, i) {
            out.push(&text[start..offsets[i]]);
            start = offsets[i];
        }
    }
    if start < text.len() {
        out.push(&text[start..]);
    }
    out
}

/// `ge(text, "word")`: the words, a no-break space joined with the word
/// before and the word after it.
pub fn words(text: &str) -> Vec<String> {
    let parts = uax29_words(text);
    let mut out: Vec<String> = Vec::new();
    let mut index = 0;
    while index < parts.len() {
        if parts[index] == "\u{a0}" {
            let before = if index == 0 {
                String::new()
            } else {
                out.pop().unwrap_or_default()
            };
            let after = parts.get(index + 1).copied().unwrap_or_default();
            out.push(format!("{before}\u{a0}{after}"));
            index += 2;
        } else {
            out.push(parts[index].to_owned());
            index += 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clusters_keep_emoji_sequences_and_jamo_together() {
        assert_eq!(graphemes("a👍🏽b"), ["a", "👍🏽", "b"]);
        assert_eq!(graphemes("🇰🇷🇯🇵"), ["🇰🇷", "🇯🇵"]);
        assert_eq!(graphemes("\u{1100}\u{1161}x"), ["\u{1100}\u{1161}", "x"]);
        assert_eq!(graphemes("👨\u{200d}👩"), ["👨\u{200d}👩"]);
    }

    #[test]
    fn a_no_break_space_joins_its_neighbours() {
        assert_eq!(words("a\u{a0}b c"), ["a\u{a0}b", " ", "c"]);
        assert_eq!(words("hello, world"), ["hello", ",", " ", "world"]);
    }
}
