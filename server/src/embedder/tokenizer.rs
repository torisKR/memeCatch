//! The tokenizer transformers.js 3.8.1 builds from the model's
//! `tokenizer.json` (an XLM-R SentencePiece Unigram), ported as it behaves
//! rather than as SentencePiece defines it: `node_modules/@huggingface/
//! transformers/src/tokenizers.js` and `src/utils/data-structures.js`.
//!
//! What differs from the `tokenizers` crate, and is kept on purpose:
//!
//! - The `Precompiled` normalizer is not the model's character map but
//!   transformers.js's stand-in for it (`Precompiled.normalize`): control
//!   characters removed, a fixed set of spaces mapped to U+0020, then NFKC
//!   except for U+FF5E.
//! - `Metaspace` ignores `add_prefix_space` and always prefixes U+2581, and
//!   does not split on it.
//! - Truncation cuts the ids after `<s>` and `</s>` were added, so an input
//!   longer than the limit loses its `</s>`.

use std::collections::HashMap;

use serde::Deserialize;
use unicode_normalization::UnicodeNormalization;

/// `model_max_length`, which the runtime sets to 512 on the tokenizer.
pub const MAX_LENGTH: usize = 512;
const REPLACEMENT: char = '\u{2581}';
const FULLWIDTH_TILDE: char = '\u{ff5e}';

#[derive(Deserialize)]
struct TokenizerJson {
    added_tokens: Vec<AddedToken>,
    model: UnigramJson,
}

#[derive(Deserialize)]
struct AddedToken {
    id: u32,
    content: String,
    lstrip: bool,
    rstrip: bool,
}

#[derive(Deserialize)]
struct UnigramJson {
    unk_id: usize,
    vocab: Vec<(String, f64)>,
}

/// The pieces of `tokenizer.json` this tokenizer uses. The normalizer,
/// pre-tokenizer and template of the pinned model are built in, so a file
/// whose other sections differ is not detected here: the model manifest
/// check pins the file.
pub struct Tokenizer {
    ids: HashMap<String, u32>,
    scores: Vec<f64>,
    unk_id: u32,
    unk_score: f64,
    max_piece_chars: usize,
    added: Vec<AddedToken>,
}

impl Tokenizer {
    pub fn from_json(text: &str) -> Result<Self, String> {
        let json: TokenizerJson =
            serde_json::from_str(text).map_err(|error| format!("tokenizer.json: {error}"))?;
        let UnigramJson { unk_id, vocab } = json.model;
        if unk_id >= vocab.len() {
            return Err("tokenizer.json: unk_id out of range".to_owned());
        }
        // `minScore` includes the special pieces' 0.0.
        let min_score = vocab
            .iter()
            .map(|(_, score)| *score)
            .fold(f64::INFINITY, f64::min);
        let unk_score = min_score - 10.0;
        let mut scores: Vec<f64> = vocab.iter().map(|(_, score)| *score).collect();
        scores[unk_id] = unk_score;
        let max_piece_chars = vocab.iter().map(|(piece, _)| piece.chars().count()).max();
        // `new Map(vocab.map((x, i) => [x, i]))`: a repeated piece keeps its
        // last index. The added tokens are set over it afterwards.
        let mut ids = HashMap::with_capacity(vocab.len());
        for (index, (piece, _)) in vocab.into_iter().enumerate() {
            ids.insert(piece, index as u32);
        }
        for token in &json.added_tokens {
            ids.insert(token.content.clone(), token.id);
        }
        Ok(Self {
            ids,
            scores,
            unk_id: unk_id as u32,
            unk_score,
            max_piece_chars: max_piece_chars.unwrap_or(0),
            added: json.added_tokens,
        })
    }

    /// `tokenizer(text, { padding: true, truncation: true })` of one text:
    /// the `input_ids`. The attention mask is all ones and as long.
    pub fn encode(&self, text: &str) -> Vec<u32> {
        let mut pieces = vec!["<s>".to_owned()];
        for section in self.sections(text) {
            match section {
                Section::Added(content) => pieces.push(content),
                Section::Text(text) => pieces.extend(self.encode_section(&text)),
            }
        }
        pieces.push("</s>".to_owned());
        let mut ids: Vec<u32> = pieces.iter().map(|piece| self.id_of(piece)).collect();
        ids.truncate(MAX_LENGTH);
        ids
    }

    fn id_of(&self, piece: &str) -> u32 {
        self.ids.get(piece).copied().unwrap_or(self.unk_id)
    }

    /// `added_tokens_splitter.split` with the strip rules of `_encode_text`.
    fn sections(&self, text: &str) -> Vec<Section> {
        let mut sections = split_added(text, &self.added);
        for index in 0..sections.len() {
            let Section::Added(content) = &sections[index] else {
                continue;
            };
            let token = self.added.iter().find(|token| &token.content == content);
            let (lstrip, rstrip) = token.map_or((false, false), |t| (t.lstrip, t.rstrip));
            if lstrip && index > 0 {
                sections[index - 1].map_text(|text| text.trim_end_matches(is_js_space));
            }
            if rstrip && index + 1 < sections.len() {
                sections[index + 1].map_text(|text| text.trim_start_matches(is_js_space));
            }
        }
        sections
    }

    /// Normalizer, `Metaspace`, then the Unigram model and `fuse_unk`.
    fn encode_section(&self, text: &str) -> Vec<String> {
        if text.is_empty() {
            return Vec::new();
        }
        let normalized = collapse_spaces(&precompiled(text));
        if normalized.is_empty() {
            return Vec::new();
        }
        let mut metaspaced = normalized.replace(' ', "\u{2581}");
        if !metaspaced.starts_with(REPLACEMENT) {
            metaspaced.insert(0, REPLACEMENT);
        }
        fuse_unk(self.viterbi(&metaspaced), |piece| {
            self.id_of(piece) == self.unk_id
        })
    }

    /// `Unigram.tokenize`: the lattice of `populateNodes` and its `viterbi`.
    fn viterbi(&self, text: &str) -> Vec<String> {
        let chars: Vec<char> = text.chars().collect();
        let mut lattice = Lattice::new(chars.len());
        for begin in 0..chars.len() {
            let mut has_single = false;
            let longest = self.max_piece_chars.min(chars.len() - begin);
            let mut prefix = String::new();
            for (length, ch) in (1..=longest).zip(&chars[begin..]) {
                prefix.push(*ch);
                if let Some(&id) = self.ids.get(&prefix) {
                    lattice.insert(begin, length, self.scores[id as usize]);
                    has_single |= length == 1;
                }
            }
            if !has_single {
                lattice.insert(begin, 1, self.unk_score);
            }
        }
        lattice
            .best_path()
            .into_iter()
            .map(|(pos, length)| chars[pos..pos + length].iter().collect())
            .collect()
    }
}

enum Section {
    Added(String),
    Text(String),
}

impl Section {
    fn map_text(&mut self, change: impl FnOnce(&str) -> &str) {
        if let Self::Text(text) = self {
            *text = change(text).to_owned();
        }
    }
}

/// `DictionarySplitter.split`: at each position the longest added token
/// that starts there, scanning left to right.
fn split_added(text: &str, added: &[AddedToken]) -> Vec<Section> {
    let mut sections = Vec::new();
    let (mut start, mut index) = (0, 0);
    while index < text.len() {
        let rest = &text[index..];
        let longest = added
            .iter()
            .filter(|token| rest.starts_with(token.content.as_str()))
            .max_by_key(|token| token.content.len());
        match longest {
            Some(token) => {
                if index > start {
                    sections.push(Section::Text(text[start..index].to_owned()));
                }
                sections.push(Section::Added(token.content.clone()));
                index += token.content.len();
                start = index;
            }
            None => index += rest.chars().next().map_or(1, char::len_utf8),
        }
    }
    if start < text.len() {
        sections.push(Section::Text(text[start..].to_owned()));
    }
    sections
}

/// `Precompiled.normalize` of transformers.js (its stand-in for the
/// `nmt_nfkc` map).
fn precompiled(text: &str) -> String {
    let mapped: String = text
        .chars()
        .filter(|ch| !is_removed_control(*ch))
        .map(|ch| if is_mapped_space(ch) { ' ' } else { ch })
        .collect();
    // NFKC would turn U+FF5E into "~"; transformers.js keeps it.
    let parts: Vec<String> = mapped
        .split(FULLWIDTH_TILDE)
        .map(|part| part.nfkc().collect())
        .collect();
    parts.join("\u{ff5e}")
}

/// `/[\u0001-\u0008\u000B\u000E-\u001F\u007F\u008F\u009F]/`.
fn is_removed_control(ch: char) -> bool {
    matches!(ch, '\u{1}'..='\u{8}' | '\u{b}' | '\u{e}'..='\u{1f}' | '\u{7f}' | '\u{8f}' | '\u{9f}')
}

/// `/[\u0009\u000A\u000C\u000D   -‏    ▁　﻿�]/`.
fn is_mapped_space(ch: char) -> bool {
    matches!(
        ch,
        '\t' | '\n' | '\u{c}' | '\r' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200f}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{2581}'
                | '\u{3000}'
                | '\u{feff}'
                | '\u{fffd}'
    )
}

/// The `Replace` normalizer of the model: `/ {2,}/gu` to one space.
fn collapse_spaces(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut previous_space = false;
    for ch in text.chars() {
        if ch == ' ' && previous_space {
            continue;
        }
        previous_space = ch == ' ';
        out.push(ch);
    }
    out
}

/// What `String.prototype.trimStart`/`trimEnd` remove: WhiteSpace and
/// LineTerminator of ECMAScript.
pub fn is_js_space(ch: char) -> bool {
    matches!(
        ch,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

/// `fuse_unk`: a run of unknown pieces becomes one piece, their text joined.
/// The test is on the fused piece so far, as in transformers.js: a literal
/// `<unk>` piece swallows the unknown pieces after it.
fn fuse_unk(pieces: Vec<String>, is_unk: impl Fn(&str) -> bool) -> Vec<String> {
    let mut fused: Vec<String> = Vec::with_capacity(pieces.len());
    let mut index = 0;
    while index < pieces.len() {
        fused.push(pieces[index].clone());
        if !is_unk(&pieces[index]) {
            index += 1;
            continue;
        }
        index += 1;
        while index < pieces.len() && is_unk(&pieces[index]) {
            let last = fused.last_mut().expect("a piece was pushed");
            if !is_unk_literal(last, &is_unk) {
                last.push_str(&pieces[index]);
            }
            index += 1;
        }
    }
    fused
}

/// `tokens_to_ids.get(fused.at(-1)) !== unk_token_id`, negated: only a
/// piece that is in the vocabulary with the unknown id (`<unk>` itself)
/// counts; text that is merely unknown (`get` gives `undefined`) does not.
fn is_unk_literal(piece: &str, is_unk: &impl Fn(&str) -> bool) -> bool {
    piece == "<unk>" && is_unk(piece)
}

/// `TokenLattice`: nodes by begin and end position, BOS and EOS at the ends.
struct Lattice {
    len: usize,
    nodes: Vec<Node>,
    begin: Vec<Vec<usize>>,
    end: Vec<Vec<usize>>,
}

struct Node {
    pos: usize,
    length: usize,
    score: f64,
    backtrace: f64,
    prev: Option<usize>,
}

const BOS: usize = 0;
const EOS: usize = 1;

impl Lattice {
    fn new(len: usize) -> Self {
        let node = |pos| Node {
            pos,
            length: 0,
            score: 0.0,
            backtrace: 0.0,
            prev: None,
        };
        let mut begin = vec![Vec::new(); len + 1];
        let mut end = vec![Vec::new(); len + 1];
        begin[len].push(EOS);
        end[0].push(BOS);
        Self {
            len,
            nodes: vec![node(0), node(len)],
            begin,
            end,
        }
    }

    fn insert(&mut self, pos: usize, length: usize, score: f64) {
        let id = self.nodes.len();
        self.nodes.push(Node {
            pos,
            length,
            score,
            backtrace: 0.0,
            prev: None,
        });
        self.begin[pos].push(id);
        self.end[pos + length].push(id);
    }

    /// `viterbi`: for each node the best of the nodes ending where it
    /// begins, the first one on a tie; then the path back from EOS.
    fn best_path(mut self) -> Vec<(usize, usize)> {
        for pos in 0..=self.len {
            for index in 0..self.begin[pos].len() {
                let right = self.begin[pos][index];
                let mut best: Option<(usize, f64)> = None;
                for &left in &self.end[pos] {
                    let score = self.nodes[left].backtrace + self.nodes[right].score;
                    if best.is_none_or(|(_, best_score)| score > best_score) {
                        best = Some((left, score));
                    }
                }
                let Some((left, score)) = best else {
                    return Vec::new();
                };
                self.nodes[right].prev = Some(left);
                self.nodes[right].backtrace = score;
            }
        }
        let mut path = Vec::new();
        let mut node = self.nodes[EOS].prev;
        while let Some(id) = node {
            let Some(prev) = self.nodes[id].prev else {
                break;
            };
            path.push((self.nodes[id].pos, self.nodes[id].length));
            node = Some(prev);
        }
        path.reverse();
        path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A small vocabulary in the shape of the real one.
    fn tokenizer() -> Tokenizer {
        let vocab = r#"[["<s>",0.0],["<pad>",0.0],["</s>",0.0],["<unk>",0.0],
            ["▁",-2.0],["▁밈",-5.0],["밈",-6.0],["▁a",-4.0],["a",-5.0],["b",-5.0],
            ["ab",-7.0],["▁ab",-6.5],["~",-6.0],["c",-9.0],["<mask>",0.0]]"#;
        let json = format!(
            r#"{{"added_tokens":[
                {{"id":0,"content":"<s>","lstrip":false,"rstrip":false}},
                {{"id":1,"content":"<pad>","lstrip":false,"rstrip":false}},
                {{"id":2,"content":"</s>","lstrip":false,"rstrip":false}},
                {{"id":3,"content":"<unk>","lstrip":false,"rstrip":false}},
                {{"id":14,"content":"<mask>","lstrip":false,"rstrip":false}}],
              "model":{{"unk_id":3,"vocab":{vocab}}}}}"#
        );
        Tokenizer::from_json(&json).expect("a tokenizer")
    }

    #[test]
    fn wraps_the_pieces_in_bos_and_eos() {
        // "▁ab" (-6.5) beats "▁a" + "b" (-9) and "▁" + "ab" (-9).
        assert_eq!(tokenizer().encode("ab"), vec![0, 11, 2]);
        assert_eq!(tokenizer().encode("밈 a"), vec![0, 5, 7, 2]);
    }

    #[test]
    fn unknown_characters_fuse_into_one_unk() {
        // "▁" then "xyz" as one fused unknown piece, then "a".
        assert_eq!(tokenizer().encode("xyza"), vec![0, 4, 3, 8, 2]);
    }

    #[test]
    fn added_tokens_split_the_text_and_each_section_gets_a_prefix() {
        assert_eq!(tokenizer().encode("a<mask>b"), vec![0, 7, 14, 4, 9, 2]);
        assert_eq!(tokenizer().encode("<s>"), vec![0, 0, 2]);
    }

    #[test]
    fn the_normalizer_is_the_transformers_js_stand_in() {
        // Controls go, spaces collapse, NFKC applies except to U+FF5E.
        assert_eq!(precompiled("a\u{1}b\tc"), "ab c");
        assert_eq!(precompiled("～ ＡＢ①"), "～ AB1");
        assert_eq!(collapse_spaces("a   b  c"), "a b c");
    }

    #[test]
    fn truncation_drops_the_closing_token() {
        let long = "a ".repeat(600);
        let ids = tokenizer().encode(&long);
        assert_eq!(ids.len(), MAX_LENGTH);
        assert_eq!(*ids.last().expect("ids"), 7);
    }
}
