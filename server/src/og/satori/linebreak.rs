//! `LineBreaker` of the `linebreak` package (UAX #14) that Satori splits
//! text into words with (`Ss` in next/og's bundle): the same class data
//! (`linebreak_data.rs`, generated from the bundle) and the same pair-table
//! walk, including its LB8a, LB21a and LB30a state.

use super::linebreak_data::{CLASSES, PAIRS};

// The class numbers of the package.
const NS: u8 = 5;
const AL: u8 = 12;
const HL: u8 = 13;
const HY: u8 = 16;
const BA: u8 = 17;
const WJ: u8 = 22;
const RI: u8 = 28;
const ZWJ: u8 = 31;
const AI: u8 = 33;
const BK: u8 = 34;
const CJ: u8 = 35;
const CR: u8 = 36;
const LF: u8 = 37;
const NL: u8 = 38;
const SA: u8 = 39;
const SG: u8 = 40;
const SP: u8 = 41;
const XX: u8 = 42;

// Pair table entries.
const DI_BRK: u8 = 0;
const IN_BRK: u8 = 1;
const CI_BRK: u8 = 2;
const CP_BRK: u8 = 3;

fn class_of(c: char) -> u8 {
    let point = u32::from(c);
    let index = CLASSES.partition_point(|&(_, last, _)| last < point);
    CLASSES
        .get(index)
        .filter(|&&(first, _, _)| first <= point)
        .map_or(XX, |&(_, _, class)| class)
}

fn map_class(class: u8) -> u8 {
    match class {
        AI | SA | SG | XX => AL,
        CJ => NS,
        other => other,
    }
}

fn map_first(class: u8) -> u8 {
    match class {
        LF | NL => BK,
        SP => WJ,
        other => other,
    }
}

/// A break opportunity: the byte offset where the next word starts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Break {
    pub position: usize,
    pub required: bool,
}

struct Breaker<'a> {
    text: &'a str,
    pos: usize,
    last_pos: usize,
    cur: Option<u8>,
    next: u8,
    lb8a: bool,
    lb21a: bool,
    lb30a: u32,
}

impl Breaker<'_> {
    fn next_class(&mut self) -> u8 {
        let c = self.text[self.pos..].chars().next().expect("a character");
        self.pos += c.len_utf8();
        map_class(class_of(c))
    }

    fn simple_break(&mut self) -> Option<bool> {
        match self.next {
            SP => Some(false),
            BK | LF | NL => {
                self.cur = Some(BK);
                Some(false)
            }
            CR => {
                self.cur = Some(CR);
                Some(false)
            }
            _ => None,
        }
    }

    fn pair_table_break(&mut self, last: u8) -> bool {
        let cur = self.cur.expect("a current class");
        let mut should = false;
        match PAIRS[usize::from(cur)][usize::from(self.next)] {
            DI_BRK => should = true,
            IN_BRK => should = last == SP,
            CI_BRK => {
                should = last == SP;
                if !should {
                    return false;
                }
            }
            CP_BRK if last != SP => return should,
            _ => {}
        }
        if self.lb8a {
            should = false;
        }
        if self.lb21a && (cur == HY || cur == BA) {
            should = false;
            self.lb21a = false;
        } else {
            self.lb21a = cur == HL;
        }
        if cur == RI {
            self.lb30a += 1;
            if self.lb30a == 2 && self.next == RI {
                should = true;
                self.lb30a = 0;
            }
        } else {
            self.lb30a = 0;
        }
        self.cur = Some(self.next);
        should
    }

    fn next_break(&mut self) -> Option<Break> {
        if self.cur.is_none() {
            if self.text.is_empty() {
                return None;
            }
            let first = self.next_class();
            self.cur = Some(map_first(first));
            self.next = first;
            self.lb8a = first == ZWJ;
            self.lb30a = 0;
        }
        while self.pos < self.text.len() {
            self.last_pos = self.pos;
            let last = self.next;
            self.next = self.next_class();
            let cur = self.cur.expect("a current class");
            if cur == BK || (cur == CR && self.next != LF) {
                self.cur = Some(map_first(map_class(self.next)));
                return Some(Break {
                    position: self.last_pos,
                    required: true,
                });
            }
            let should = match self.simple_break() {
                Some(value) => value,
                None => self.pair_table_break(last),
            };
            self.lb8a = self.next == ZWJ;
            if should {
                return Some(Break {
                    position: self.last_pos,
                    required: false,
                });
            }
        }
        if self.last_pos < self.text.len() {
            self.last_pos = self.text.len();
            return Some(Break {
                position: self.text.len(),
                required: false,
            });
        }
        None
    }
}

/// Satori's `Ss(text, "normal")`: the words between break opportunities and,
/// for each, whether a required break precedes it (the first never does).
pub fn words(text: &str) -> (Vec<&str>, Vec<bool>) {
    let mut breaker = Breaker {
        text,
        pos: 0,
        last_pos: 0,
        cur: None,
        next: 0,
        lb8a: false,
        lb21a: false,
        lb30a: 0,
    };
    let mut words = Vec::new();
    let mut required = vec![false];
    let mut start = 0;
    while let Some(found) = breaker.next_break() {
        words.push(&text[start..found.position]);
        required.push(found.required);
        start = found.position;
    }
    (words, required)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spaces_stay_with_the_word_before_and_hangul_breaks_between_syllables() {
        assert_eq!(words("밈 캐치").0, ["밈 ", "캐", "치"]);
        assert_eq!(words("Korean Memes").0, ["Korean ", "Memes"]);
        assert_eq!(words("a\u{a0}b c").0, ["a\u{a0}b ", "c"]);
        assert_eq!(words("").0, Vec::<&str>::new());
    }
}
