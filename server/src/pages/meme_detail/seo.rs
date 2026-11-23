//! Port of the Korean half of `lib/meme-seo-copy.ts`: the search title and
//! the meta description of a meme document, built from database fields only.
//!
//! Lengths are counted in code points, as `[...text].length` does.
//! A house original has its own wording; those documents stay with Next.

use crate::pages::labels::SafetyLevel;
use crate::routes::public::js;

const TITLE_TARGET_CHARS: usize = 60;
const DESCRIPTION_MIN_CHARS: usize = 110;
const DESCRIPTION_MAX_CHARS: usize = 160;
// What the `%s | 밈캐치` template adds after the page title.
const BRAND_SUFFIX: &str = " | 밈캐치";
// DEFINITE_YEAR_PRECISIONS in lib/labels.ts.
const DEFINITE_YEAR_PRECISIONS: [&str; 2] = ["exact", "year"];
const FILLERS: [&str; 2] = [
    "상황별 사용 맥락과 출처도 함께 확인하세요.",
    "밈캐치 한국 밈 사전 문서예요.",
];

fn chars(text: &str) -> usize {
    text.chars().count()
}

/// `memeSeoTitle("ko", title)`: the longest pattern whose full title, brand
/// included, stays within about 60 characters.
pub fn title(title: &str) -> String {
    let clean = js::trim(title);
    let patterns = [
        format!("{clean} 뜻·유래, 지금 써도 될까?"),
        format!("{clean} 뜻·유래"),
        format!("{clean} 뜻"),
    ];
    let fits = |candidate: &String| chars(candidate) + chars(BRAND_SUFFIX) <= TITLE_TARGET_CHARS;
    let [long, medium, short] = patterns;
    if fits(&long) {
        long
    } else if fits(&medium) {
        medium
    } else {
        short
    }
}

/// `MemeSeoDescriptionInput`, without the house-original flag.
pub struct DescriptionInput<'a> {
    pub title: &'a str,
    pub summary: &'a str,
    pub origin_year: Option<i32>,
    pub year_precision: &'a str,
    pub safety_level: &'a str,
    /// Length of the stored `usage_examples` array, valid entries or not.
    pub usage_example_count: usize,
    pub has_origin: bool,
    pub has_caution: bool,
}

/// `sentence(text, ".")`: one line, closed with a full stop unless it
/// already ends a sentence.
fn sentence(text: &str) -> String {
    let line = js::collapse_spaces(js::trim(text));
    match line.chars().last() {
        None => line,
        Some('.' | '!' | '?' | '。' | '！' | '？' | '…') => line,
        Some(_) => format!("{line}."),
    }
}

/// `truncate`: cut to `max` code points with an ellipsis, at a space when one
/// lies in the last two fifths.
fn truncate(text: &str, max: usize) -> String {
    if chars(text) <= max {
        return text.to_owned();
    }
    let cut: String = text.chars().take(max.saturating_sub(1).max(1)).collect();
    // `lastIndexOf` counts UTF-16 units; the comparison below uses that count.
    let space = cut
        .rfind(' ')
        .filter(|byte| js::utf16_len(&cut[..*byte]) * 5 > max * 3);
    let kept = space.map_or(cut.as_str(), |byte| &cut[..byte]);
    let kept = kept.trim_end_matches(|c: char| js::is_space(c) || ",.;:·、，。".contains(c));
    format!("{kept}…")
}

/// `memeSeoDescription("ko", input)`: the summary first, then the year, the
/// safety signal and what the page covers. A sentence that does not fit is
/// dropped; neutral site sentences pad a short result.
pub fn description(input: &DescriptionInput<'_>) -> String {
    let mut rest = Vec::new();
    if let Some(year) = input.origin_year {
        let estimate = if DEFINITE_YEAR_PRECISIONS.contains(&input.year_precision) {
            ""
        } else {
            "(추정)"
        };
        rest.push(format!("유행 시작 {year}년{estimate}."));
    }
    if let Some(level) = SafetyLevel::parse_known(input.safety_level) {
        rest.push(format!(
            "지금 써도 될까? 사용 신호는 '{}'이에요.",
            level.label()
        ));
    }
    let covered: Vec<String> = [
        input.has_origin.then(|| "유래".to_owned()),
        (input.usage_example_count > 0).then(|| format!("예문 {}개", input.usage_example_count)),
        input.has_caution.then(|| "쓰면 안 되는 상황".to_owned()),
    ]
    .into_iter()
    .flatten()
    .collect();
    if !covered.is_empty() {
        rest.push(format!("{}까지 정리했어요.", covered.join("·")));
    }

    let summary = js::trim(input.summary);
    let mut text = if summary.is_empty() {
        String::new()
    } else {
        format!("{} 뜻: {}", input.title, sentence(summary))
    };
    if chars(&text) > DESCRIPTION_MAX_CHARS {
        return truncate(&text, DESCRIPTION_MAX_CHARS);
    }
    let add = |text: &mut String, piece: &str| {
        let separator = if text.is_empty() { "" } else { " " };
        if chars(text) + chars(separator) + chars(piece) <= DESCRIPTION_MAX_CHARS {
            text.push_str(separator);
            text.push_str(piece);
        }
    };
    for piece in &rest {
        add(&mut text, piece);
    }
    for filler in FILLERS {
        if chars(&text) >= DESCRIPTION_MIN_CHARS {
            break;
        }
        add(&mut text, filler);
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input<'a>(title: &'a str, summary: &'a str) -> DescriptionInput<'a> {
        DescriptionInput {
            title,
            summary,
            origin_year: Some(2022),
            year_precision: "unknown",
            safety_level: "green",
            usage_example_count: 2,
            has_origin: true,
            has_caution: true,
        }
    }

    #[test]
    fn title_and_description_match_next_for_the_seeded_meme() {
        // Both strings are from the page Next renders for pgrich01 (parity/pages/seed.sql).
        assert_eq!(
            title(" 패리티 리치 "),
            "패리티 리치 뜻·유래, 지금 써도 될까?"
        );
        assert_eq!(
            description(&input(
                "패리티 리치",
                "검증용으로 만든 충실한 문서로, 뜻과 유래와 예문과 출처를 모두 갖춘 밈이에요",
            )),
            "패리티 리치 뜻: 검증용으로 만든 충실한 문서로, 뜻과 유래와 예문과 출처를 모두 갖춘 밈이에요. 유행 시작 2022년(추정). 지금 써도 될까? 사용 신호는 '써도 됨'이에요. 유래·예문 2개·쓰면 안 되는 상황까지 정리했어요."
        );
    }

    #[test]
    fn a_long_title_falls_back_to_a_shorter_pattern() {
        let long = "가".repeat(45);
        assert_eq!(title(&long), format!("{long} 뜻·유래"));
        let longer = "가".repeat(52);
        assert_eq!(title(&longer), format!("{longer} 뜻"));
        // Nothing fits: the shortest pattern is still used.
        let longest = "가".repeat(80);
        assert_eq!(title(&longest), format!("{longest} 뜻"));
    }

    #[test]
    fn a_thin_document_gets_site_sentences_up_to_the_minimum() {
        let thin = DescriptionInput {
            origin_year: None,
            safety_level: "unknown",
            usage_example_count: 0,
            has_origin: false,
            has_caution: false,
            ..input("밈", "짧은 요약!")
        };
        assert_eq!(
            description(&thin),
            "밈 뜻: 짧은 요약! 상황별 사용 맥락과 출처도 함께 확인하세요. 밈캐치 한국 밈 사전 문서예요."
        );
        // No summary: the lead is left out, the facts remain.
        let no_summary = DescriptionInput {
            year_precision: "year",
            ..input("밈", "  ")
        };
        assert!(description(&no_summary).starts_with("유행 시작 2022년. 지금 써도 될까?"));
    }

    #[test]
    fn an_overlong_summary_is_cut_at_a_space_with_an_ellipsis() {
        let summary = format!("{} 끝", "가나다 ".repeat(50));
        let text = description(&input("밈", &summary));
        assert!(chars(&text) <= DESCRIPTION_MAX_CHARS);
        assert!(text.ends_with("가나다…"), "{text}");
        // A sentence that would pass 160 characters is dropped, not cut.
        let fits = "가".repeat(120);
        let text = description(&input("밈", &fits));
        assert!(text.ends_with("유행 시작 2022년(추정)."), "{text}");
    }
}
