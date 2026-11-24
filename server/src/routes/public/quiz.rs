//! The pure logic behind `/api/daily-quiz` and `/api/quiz`: `buildQuestions`,
//! `buildQuestionsForSet`, `seededRng` and their helpers from `lib/quiz.ts`,
//! and the date key, hash, generator and pivot from `lib/daily-quiz.ts`.
//!
//! Everyone must get the same question on the same day from either server,
//! and a shared quiz link must show the same options, so this follows the
//! JavaScript to the bit: 32-bit integer wrap-around, lengths in UTF-16 code
//! units, JavaScript's whitespace class, stable sorts, and the exact number
//! and order of generator calls (a shuffle draws even when its result goes
//! unused). `server/tests/daily_quiz_parity.rs` and `quiz_parity.rs` check it
//! against output of the real TypeScript.

use std::cmp::Reverse;
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::js;

const OPTION_COUNT: usize = 4;
/// A shorter summary says too little to be an answer or a wrong option.
const MIN_SUMMARY_LENGTH: usize = 20;
const NEAR_WINDOW: usize = 9;
const MASK: &str = "○○";
const MASK_CHAR: char = '○';
const SHORT_ID_ALPHABET: &[u8; 31] = b"abcdefghjkmnpqrstuvwxyz23456789";
const KST_OFFSET_SECONDS: i64 = 9 * 3600;

/// Genre and format words in a title. They are common across options, so
/// they are not masked.
const GENERIC_TITLE_WORDS: [&str; 20] = [
    "챌린지",
    "챌린지송",
    "댄스챌린지",
    "밈",
    "댄스",
    "짤",
    "유행어",
    "신조어",
    "커버",
    "커버챌린지",
    "열풍",
    "시리즈",
    "안무",
    "챌",
    "송",
    "패러디",
    "브이로그",
    "예능",
    "영상",
    "노래",
];

/// `QuizPoolMeme`: the columns the route selects from `memes`.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
pub struct PoolMeme {
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub category: String,
    pub origin_year: Option<i32>,
    pub safety_level: String,
}

/// `QuizQuestion`. Field order is the key order of the JSON.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub question: String,
    pub options: Vec<String>,
    /// `options.indexOf(maskedAnswer)`.
    pub answer_index: i64,
    pub meme: QuestionMeme,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuestionMeme {
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub origin_year: Option<i32>,
    pub safety_level: String,
}

/// `kstDayKey`: the date in Korea as `YYYY-MM-DD`. Korea has been at UTC+9
/// with no daylight saving time since 1988.
pub fn kst_day_key(now: SystemTime) -> String {
    let seconds = match now.duration_since(UNIX_EPOCH) {
        Ok(since) => i64::try_from(since.as_secs()).unwrap_or(i64::MAX - KST_OFFSET_SECONDS),
        Err(before) => -i64::try_from(before.duration().as_secs()).unwrap_or(0),
    };
    let (year, month, day) = civil_from_days((seconds + KST_OFFSET_SECONDS).div_euclid(86_400));
    format!("{year:04}-{month:02}-{day:02}")
}

/// Days since 1970-01-01 to a proleptic Gregorian date (Howard Hinnant's
/// `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    (year_of_era + era * 400 + i64::from(month <= 2), month, day)
}

/// `hashCode`: `h = (h * 31 + code unit) | 0`, then `Math.abs`. The absolute
/// value of -2^31 is 2^31, which fits `u32` and is what `seed >>> 0` keeps.
pub fn hash_code(value: &str) -> u32 {
    value
        .encode_utf16()
        .fold(0i32, |hash, unit| {
            hash.wrapping_mul(31).wrapping_add(i32::from(unit))
        })
        .unsigned_abs()
}

/// The `rng` argument of the TypeScript: a seeded mulberry32, or
/// `Math.random`.
pub struct Rng(Source);

enum Source {
    Mulberry(u32),
    System,
}

impl Rng {
    /// `seededRng(seed: number)` of lib/daily-quiz.ts.
    pub fn seeded(seed: u32) -> Self {
        Self(Source::Mulberry(seed))
    }

    /// `seededRng(seed: string)` of lib/quiz.ts: the FNV-1a hash of the
    /// seed's UTF-16 code units starts the same generator.
    pub fn from_text(seed: &str) -> Self {
        let hash = seed.encode_utf16().fold(0x811c_9dc5_u32, |hash, unit| {
            (hash ^ u32::from(unit)).wrapping_mul(0x0100_0193)
        });
        Self::seeded(hash)
    }

    /// `Math.random`: a new quiz on every call.
    pub fn random() -> Self {
        Self(Source::System)
    }

    /// A value in `[0, 1)`. Every `| 0`, `>>> 0` and `Math.imul` in the
    /// JavaScript is arithmetic modulo 2^32, which is `u32` wrapping here.
    pub fn next_value(&mut self) -> f64 {
        let Source::Mulberry(state) = &mut self.0 else {
            return rand::random::<f64>();
        };
        *state = state.wrapping_add(0x6d2b_79f5);
        let a = *state;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0
    }

    /// `Math.floor(rng() * bound)`.
    fn below(&mut self, bound: usize) -> usize {
        (self.next_value() * bound as f64).floor() as usize
    }
}

fn daily_rng(day: &str) -> Rng {
    Rng::seeded(hash_code(&format!("daily-quiz:{day}")))
}

/// `dailyPivot`: the short id the day's pool starts from.
pub fn daily_pivot(day: &str) -> String {
    short_id_pivot(&mut daily_rng(day))
}

/// Eight characters of the short id alphabet, one draw each: `dailyPivot`,
/// and `randomShortId` of app/api/quiz/route.ts with `Rng::random()`.
pub fn short_id_pivot(rng: &mut Rng) -> String {
    (0..8)
        .map(|_| char::from(SHORT_ID_ALPHABET[rng.below(SHORT_ID_ALPHABET.len())]))
        .collect()
}

/// The response body for `day` given the pool rows in the order the route
/// reads them: `JSON.stringify({ date, question })`. `None` when no question
/// can be built ("insufficient pool").
pub fn daily_quiz_json(day: &str, pool: &[PoolMeme]) -> Option<String> {
    #[derive(Serialize)]
    struct DailyQuiz<'a> {
        date: &'a str,
        question: Question,
    }
    let question = build_questions(pool, 1, &mut daily_rng(day))
        .into_iter()
        .next()?;
    Some(
        serde_json::to_string(&DailyQuiz {
            date: day,
            question,
        })
        .expect("strings and numbers"),
    )
}

/// A pool row that can be an answer or a wrong option, with its summary
/// normalized once.
struct Eligible<'a> {
    meme: &'a PoolMeme,
    summary: String,
}

/// `eligiblePool`.
fn eligible_pool<'a>(pool: impl Iterator<Item = &'a PoolMeme>) -> Vec<Eligible<'a>> {
    pool.filter(|meme| !meme.short_id.is_empty() && !meme.slug.is_empty() && !meme.title.is_empty())
        .map(|meme| Eligible {
            meme,
            summary: normalize_summary(&meme.summary),
        })
        .filter(|candidate| js::utf16_len(&candidate.summary) >= MIN_SUMMARY_LENGTH)
        .collect()
}

/// `buildQuestions(pool, count, rng)`: up to `count` questions, answers in
/// shuffled order. No answer is tried once `count` questions exist, so the
/// generator is not advanced past that point.
pub fn build_questions(pool: &[PoolMeme], count: usize, rng: &mut Rng) -> Vec<Question> {
    let eligible = eligible_pool(pool.iter());
    let mut questions = Vec::new();
    for answer in shuffle(eligible.iter().collect(), rng) {
        if questions.len() >= count {
            break;
        }
        questions.extend(build_question_for(answer, &eligible, rng));
    }
    questions
}

/// `buildQuestionsForSet(targets, pool, rng)`: one question per target, in
/// the order given. Wrong options come from the targets and the pool; a
/// target that cannot be asked is skipped.
pub fn build_questions_for_set(
    targets: &[PoolMeme],
    pool: &[PoolMeme],
    rng: &mut Rng,
) -> Vec<Question> {
    // The first row of each short id is kept: a target, then the pool's.
    let mut seen = HashSet::new();
    let merged = targets
        .iter()
        .chain(pool)
        .filter(|meme| seen.insert(meme.short_id.as_str()));
    let eligible = eligible_pool(merged);
    targets
        .iter()
        .filter_map(|target| {
            let answer = eligible
                .iter()
                .find(|candidate| candidate.meme.short_id == target.short_id)?;
            build_question_for(answer, &eligible, rng)
        })
        .collect()
}

/// `buildQuestionFor`.
fn build_question_for(answer: &Eligible, eligible: &[Eligible], rng: &mut Rng) -> Option<Question> {
    let mut same_category = Vec::new();
    let mut others = Vec::new();
    for candidate in eligible {
        if candidate.meme.short_id == answer.meme.short_id || candidate.summary == answer.summary {
            continue;
        }
        if candidate.meme.category == answer.meme.category {
            same_category.push(candidate.summary.as_str());
        } else {
            others.push(candidate.summary.as_str());
        }
    }
    let distractors = pick_distractors(&answer.summary, [&same_category, &others], rng);
    if distractors.len() < OPTION_COUNT - 1 {
        return None;
    }

    // The title's own words are masked so the title does not give the answer
    // away. The options are shuffled before the checks below, as in the
    // TypeScript: a rejected answer still advances the generator.
    let name_tokens = title_name_tokens(&answer.meme.title);
    let masked_answer = mask_title_words(&answer.summary, &name_tokens);
    let masked: Vec<String> = std::iter::once(answer.summary.as_str())
        .chain(distractors.iter().map(String::as_str))
        .map(|summary| mask_title_words(summary, &name_tokens))
        .collect();
    let options = shuffle(masked, rng);
    if js::utf16_len(js::trim(&masked_answer.replace(MASK_CHAR, ""))) < 10 {
        return None;
    }
    if options.iter().collect::<HashSet<_>>().len() < OPTION_COUNT {
        return None;
    }

    let answer_index = options.iter().position(|option| *option == masked_answer);
    let meme = answer.meme;
    Some(Question {
        question: format!("「{}」, 무슨 뜻일까요?", meme.title),
        answer_index: answer_index.map_or(-1, |index| index as i64),
        options,
        meme: QuestionMeme {
            short_id: meme.short_id.clone(),
            slug: meme.slug.clone(),
            title: meme.title.clone(),
            origin_year: meme.origin_year,
            safety_level: meme.safety_level.clone(),
        },
    })
}

/// `pickDistractors`: three wrong options, same category first, summaries of
/// a length close to the answer's first.
fn pick_distractors(answer_summary: &str, sources: [&Vec<&str>; 2], rng: &mut Rng) -> Vec<String> {
    let answer_length = js::utf16_len(answer_summary);
    let mut picked: Vec<String> = Vec::new();
    for source in sources {
        if picked.len() >= OPTION_COUNT - 1 {
            break;
        }
        let mut seen = HashSet::new();
        let mut candidates: Vec<String> = source
            .iter()
            .filter(|summary| seen.insert(**summary))
            .filter(|summary| **summary != answer_summary && !picked.iter().any(|p| p == *summary))
            .map(|summary| (*summary).to_owned())
            .collect();
        // Stable, like Array.prototype.sort.
        candidates.sort_by_key(|summary| js::utf16_len(summary).abs_diff(answer_length));
        let far = candidates.split_off(candidates.len().min(NEAR_WINDOW));
        let room = (OPTION_COUNT - 1).saturating_sub(picked.len());
        picked.extend(shuffle(candidates, rng).into_iter().chain(far).take(room));
    }
    picked
}

/// `shuffle`: Fisher–Yates from the end, one draw per position.
fn shuffle<T>(mut items: Vec<T>, rng: &mut Rng) -> Vec<T> {
    for i in (1..items.len()).rev() {
        let j = rng.below(i + 1);
        items.swap(i, j);
    }
    items
}

/// `value.trim().replace(/\s+/g, " ")`.
fn normalize_summary(value: &str) -> String {
    js::collapse_spaces(js::trim(value))
}

fn is_open_paren(c: char) -> bool {
    matches!(c, '(' | '（')
}

fn is_close_paren(c: char) -> bool {
    matches!(c, ')' | '）')
}

/// The class in `base.split(/[\s·,/’'"“”!?]+/)`.
fn is_title_separator(c: char) -> bool {
    js::is_space(c)
        || matches!(
            c,
            '·' | ',' | '/' | '’' | '\'' | '"' | '“' | '”' | '!' | '?'
        )
}

/// `titleNameTokens`: the words that identify a title (song, group, person).
pub fn title_name_tokens(title: &str) -> Vec<String> {
    // /[(（][^)）]*[)）]/g: from an opening bracket to the first closing one.
    let chars: Vec<char> = title.chars().collect();
    let mut tokens: Vec<String> = Vec::new();
    let mut base = String::new();
    let mut i = 0;
    while i < chars.len() {
        let close = chars[i + 1..].iter().position(|c| is_close_paren(*c));
        match close {
            Some(length) if is_open_paren(chars[i]) => {
                let inside: String = chars[i + 1..i + 1 + length]
                    .iter()
                    .filter(|c| !is_open_paren(**c))
                    .collect();
                tokens.push(js::trim(&inside).to_owned());
                base.push(' ');
                i += length + 2;
            }
            _ => {
                base.push(chars[i]);
                i += 1;
            }
        }
    }
    let base = js::trim(&base);
    tokens.push(base.to_owned());
    // A run of separators gives empty tokens here and one split in
    // JavaScript; empty tokens are dropped below either way.
    tokens.extend(base.split(is_title_separator).map(str::to_owned));

    // [...new Set(tokens)].map(trim).filter(...)
    let mut seen = HashSet::new();
    tokens
        .into_iter()
        .filter(|token| seen.insert(token.clone()))
        .map(|token| js::trim(&token).to_owned())
        .filter(|token| js::utf16_len(token) >= 2 && !GENERIC_TITLE_WORDS.contains(&token.as_str()))
        .collect()
}

/// `maskTitleWords`: replaces each token with ○○, longest token first, then
/// tidies quotes and repeats around the masks.
pub fn mask_title_words(text: &str, tokens: &[String]) -> String {
    let mut longest_first: Vec<&String> = tokens.iter().collect();
    // Stable, like `[...tokens].sort((a, b) => b.length - a.length)`.
    longest_first.sort_by_key(|token| Reverse(js::utf16_len(token)));

    let mut units: Vec<u16> = text.encode_utf16().collect();
    for token in longest_first {
        units = replace_ignoring_case(&units, &token.encode_utf16().collect::<Vec<u16>>());
    }
    let masked = String::from_utf16_lossy(&units);
    let masked = merge_repeated_masks(&unquote_masks(&masked));
    js::trim(&js::collapse_spaces(&masked)).to_owned()
}

/// `text.replace(new RegExp(escapeRegExp(token), "gi"), "○○")`.
fn replace_ignoring_case(text: &[u16], token: &[u16]) -> Vec<u16> {
    if token.is_empty() {
        return text.to_vec();
    }
    let needle: Vec<u16> = token.iter().map(|unit| canonicalize(*unit)).collect();
    let folded: Vec<u16> = text.iter().map(|unit| canonicalize(*unit)).collect();
    let mut out = Vec::with_capacity(text.len());
    let mut i = 0;
    while i < text.len() {
        if folded[i..].starts_with(&needle) {
            out.extend(MASK.encode_utf16());
            i += needle.len();
        } else {
            out.push(text[i]);
            i += 1;
        }
    }
    out
}

/// How a regex with the `i` flag and no `u` flag compares one UTF-16 code
/// unit (ECMA-262, Canonicalize): its uppercase form, unless that is more
/// than one code unit or would turn a non-ASCII character into an ASCII one.
/// Node and Rust can differ only on case pairs newer than the Unicode version
/// of one of them.
fn canonicalize(unit: u16) -> u16 {
    let Some(c) = char::from_u32(u32::from(unit)) else {
        return unit; // half of a surrogate pair
    };
    let mut upper = c.to_uppercase();
    match (upper.next().map(u32::from), upper.next()) {
        (Some(single), None) if single <= 0xffff && !(unit >= 128 && single < 128) => single as u16,
        _ => unit,
    }
}

fn is_quote(c: char) -> bool {
    matches!(c, '’' | '\'' | '"' | '“' | '”')
}

/// `.replace(/[’'"“”]?○○[’'"“”]?/g, "○○")`.
fn unquote_masks(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let is_mask_at = |at: usize| chars[at..].starts_with(&[MASK_CHAR, MASK_CHAR]);
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        let mask_start = if is_quote(chars[i]) && is_mask_at(i + 1) {
            Some(i + 1)
        } else if is_mask_at(i) {
            Some(i)
        } else {
            None
        };
        match mask_start {
            Some(start) => {
                out.push_str(MASK);
                i = start + 2;
                if chars.get(i).is_some_and(|c| is_quote(*c)) {
                    i += 1;
                }
            }
            None => {
                out.push(chars[i]);
                i += 1;
            }
        }
    }
    out
}

/// `.replace(/(?:○○[\s]*){2,}/g, "○○ ")`.
fn merge_repeated_masks(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        let mut end = i;
        let mut repeats = 0;
        while chars[end..].starts_with(&[MASK_CHAR, MASK_CHAR]) {
            end += 2;
            while chars.get(end).is_some_and(|c| js::is_space(*c)) {
                end += 1;
            }
            repeats += 1;
        }
        if repeats >= 2 {
            out.push_str(MASK);
            out.push(' ');
            i = end;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    // The comparison with the TypeScript is in tests/daily_quiz_parity.rs.
    // These pin the two rules that are easiest to get wrong in a port.

    #[test]
    fn hash_wraps_like_32_bit_javascript_arithmetic() {
        assert_eq!(hash_code(""), 0);
        assert_eq!(hash_code("a"), 97);
        // What Node prints for hashCode("daily-quiz:2026-11-23").
        assert_eq!(hash_code("daily-quiz:2026-11-23"), 589_776_660);
        // Math.abs(-2^31) is 2^31, not a wrapped negative.
        assert_eq!(i32::MIN.unsigned_abs(), 2_147_483_648);
    }

    #[test]
    fn canonicalize_follows_the_non_unicode_regex_rules() {
        let fold = |c: char| canonicalize(c as u16);

        assert_eq!(fold('a'), fold('A'));
        assert_eq!(fold('é'), fold('É'));
        // ß uppercases to two code units, so it only matches itself.
        assert_eq!(fold('ß'), 'ß' as u16);
        // ı uppercases to ASCII I, which the rule forbids.
        assert_eq!(fold('ı'), 'ı' as u16);
        assert_eq!(canonicalize(0xd83d), 0xd83d);
    }
}
