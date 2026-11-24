//! Port of the Korean half of `lib/meme-seo-copy.ts`: the search title and
//! the meta description of a meme document, built from database fields only.
//!
//! Lengths are counted in code points, as `[...text].length` does.
//! A house original has its own wording.

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
/// `memeSeoTitle("ko", title, { houseOriginal })`: a house original's
/// title speaks of how it was made, not where it came from.
pub fn title(title: &str, house_original: bool) -> String {
    let clean = js::trim(title);
    let about = if house_original {
        "제작 배경"
    } else {
        "유래"
    };
    let patterns = [
        format!("{clean} 뜻·{about}, 지금 써도 될까?"),
        format!("{clean} 뜻·{about}"),
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

/// `MemeSeoDescriptionInput`.
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
    pub house_original: bool,
}

/// `sentence(text, terminal)`: one line, closed with `terminal` unless it
/// already ends a sentence.
fn sentence(text: &str, terminal: char) -> String {
    let line = js::collapse_spaces(js::trim(text));
    match line.chars().last() {
        None => line,
        Some('.' | '!' | '?' | '。' | '！' | '？' | '…') => line,
        Some(_) => format!("{line}{terminal}"),
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
        rest.push(if input.house_original {
            format!("제작 연도 {year}년.")
        } else {
            format!("유행 시작 {year}년{estimate}.")
        });
    }
    if let Some(level) = SafetyLevel::parse_known(input.safety_level) {
        rest.push(format!(
            "지금 써도 될까? 사용 신호는 '{}'이에요.",
            level.label()
        ));
    }
    let covered: Vec<String> = [
        input.has_origin.then(|| {
            if input.house_original {
                "제작 배경"
            } else {
                "유래"
            }
            .to_owned()
        }),
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
    let text = if summary.is_empty() {
        String::new()
    } else {
        format!("{} 뜻: {}", input.title, sentence(summary, '.'))
    };
    assemble(text, &rest, &FILLERS, " ")
}

/// The lead, then each sentence of `rest` that still fits, then the
/// fillers while the text is under the minimum. An overlong lead is cut.
fn assemble(mut text: String, rest: &[String], fillers: &[&str], joiner: &str) -> String {
    if chars(&text) > DESCRIPTION_MAX_CHARS {
        return truncate(&text, DESCRIPTION_MAX_CHARS);
    }
    let add = |text: &mut String, piece: &str| {
        let separator = if text.is_empty() { "" } else { joiner };
        if chars(text) + chars(separator) + chars(piece) <= DESCRIPTION_MAX_CHARS {
            text.push_str(separator);
            text.push_str(piece);
        }
    };
    for piece in rest {
        add(&mut text, piece);
    }
    for filler in fillers {
        if chars(&text) >= DESCRIPTION_MIN_CHARS {
            break;
        }
        add(&mut text, filler);
    }
    text
}

/// `memeSeoTitle(locale, title)` for an edition: the same choice of
/// pattern, with the edition's brand (` | MemeCatch`).
pub fn edition_title(code: &str, title: &str) -> String {
    const BRAND: &str = " | MemeCatch";
    let t = js::trim(title);
    let patterns = match code {
        "ja" => [
            format!("{t}の意味・由来｜今使っても大丈夫？"),
            format!("{t}の意味・由来"),
            format!("{t}の意味"),
        ],
        "zh" => [
            format!("{t}是什么意思？含义、由来与能不能用"),
            format!("{t}的含义与由来"),
            format!("{t}的含义"),
        ],
        "zh-tw" => [
            format!("{t}是什麼意思？含義、由來與能不能用"),
            format!("{t}的含義與由來"),
            format!("{t}的含義"),
        ],
        _ => [
            format!("{t} Meaning & Origin: Is It OK to Use?"),
            format!("{t} Meaning & Origin"),
            format!("{t} Meaning"),
        ],
    };
    let [long, medium, short] = patterns;
    let fits = |candidate: &String| chars(candidate) + chars(BRAND) <= TITLE_TARGET_CHARS;
    if fits(&long) {
        long
    } else if fits(&medium) {
        medium
    } else {
        short
    }
}

/// What an edition's description is built from (the page passes no
/// year precision, origin flag or house flag).
pub struct EditionDescription<'a> {
    pub title: &'a str,
    pub summary: &'a str,
    pub origin_year: Option<i32>,
    pub safety_level: &'a str,
    pub usage_example_count: usize,
    pub has_caution: bool,
}

/// `memeSeoDescription(locale, input)` for an edition (`localizedParts`).
pub fn edition_description(code: &str, input: &EditionDescription<'_>) -> String {
    // `year ? …`: no sentence for a missing year or the year 0.
    let year = input.origin_year.filter(|year| *year != 0);
    let n = input.usage_example_count;
    let safety = |labels: [&'static str; 4]| {
        SafetyLevel::parse_known(input.safety_level).map(|level| match level {
            SafetyLevel::Green => labels[0],
            SafetyLevel::Yellow => labels[1],
            SafetyLevel::Gray => labels[2],
            SafetyLevel::Red => labels[3],
        })
    };
    let summary = js::trim(input.summary);
    let lead = |text: String| {
        if summary.is_empty() {
            String::new()
        } else {
            text
        }
    };
    let (text, rest, fillers, joiner): (String, Vec<Option<String>>, [&str; 2], &str) = match code {
        "ja" => (
            lead(format!(
                "{}の意味：{}",
                input.title,
                sentence(summary, '。')
            )),
            vec![
                year.map(|year| format!("{year}年ごろに登場。")),
                safety(["基本的に使用可", "文脈に注意", "やや古い表現", "使用は危険"])
                    .map(|label| format!("今使っても大丈夫？使用サインは「{label}」。")),
                (n > 0).then(|| format!("使用例{n}件つき。")),
                input
                    .has_caution
                    .then(|| "使ってはいけない場面も解説。".to_owned()),
            ],
            [
                "MemeCatchの韓国ミーム辞典の解説です。",
                "韓国語の原文ページへのリンクつき。",
            ],
            "",
        ),
        "zh" => (
            lead(format!(
                "{}是什么意思：{}",
                input.title,
                sentence(summary, '。')
            )),
            vec![
                year.map(|year| format!("约在{year}年出现。")),
                safety([
                    "通常可以使用",
                    "需要注意语境",
                    "大多已经过时",
                    "使用风险较高",
                ])
                .map(|label| format!("现在还能用吗？使用信号：{label}。")),
                (n > 0).then(|| format!("附{n}个用法示例。")),
                input
                    .has_caution
                    .then(|| "也说明了不该使用的场合。".to_owned()),
            ],
            ["来自MemeCatch韩国迷因词典。", "附韩文原文页面链接。"],
            "",
        ),
        "zh-tw" => (
            lead(format!(
                "{}是什麼意思：{}",
                input.title,
                sentence(summary, '。')
            )),
            vec![
                year.map(|year| format!("約在{year}年出現。")),
                safety([
                    "通常可以使用",
                    "需要注意語境",
                    "大多已經過時",
                    "使用風險較高",
                ])
                .map(|label| format!("現在還能用嗎？使用信號：{label}。")),
                (n > 0).then(|| format!("附{n}個用法範例。")),
                input
                    .has_caution
                    .then(|| "也說明了不該使用的場合。".to_owned()),
            ],
            ["來自MemeCatch韓國迷因詞典。", "附韓文原文頁面連結。"],
            "",
        ),
        _ => (
            lead(format!(
                "{} meaning: {}",
                input.title,
                sentence(summary, '.')
            )),
            vec![
                year.map(|year| format!("Originated around {year}.")),
                safety([
                    "generally safe to use",
                    "context matters",
                    "mostly dated",
                    "risky to use",
                ])
                .map(|label| format!("Is it OK to use now? Usage signal: {label}.")),
                (n > 0).then(|| {
                    format!(
                        "Includes {n} usage example{}.",
                        if n == 1 { "" } else { "s" }
                    )
                }),
                input
                    .has_caution
                    .then(|| "Notes when not to use it.".to_owned()),
            ],
            [
                "From the MemeCatch Korean meme dictionary.",
                "Links to the original Korean entry.",
            ],
            " ",
        ),
    };
    let rest: Vec<String> = rest.into_iter().flatten().collect();
    assemble(text, &rest, &fillers, joiner)
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
            house_original: false,
        }
    }

    #[test]
    fn title_and_description_match_next_for_the_seeded_meme() {
        // Both strings are those of the seeded meme pgrich01.
        assert_eq!(
            title(" 패리티 리치 ", false),
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
    fn an_edition_has_its_own_patterns_and_sentences() {
        // The strings are what lib/meme-seo-copy.ts returns for these inputs (Node).
        assert_eq!(
            edition_title("en", " Edition art1 "),
            "Edition art1 Meaning & Origin: Is It OK to Use?"
        );
        assert_eq!(
            edition_title("ja", "版 art1"),
            "版 art1の意味・由来｜今使っても大丈夫？"
        );
        let input = EditionDescription {
            title: "Edition art1",
            summary: "Edition summary of pgb2art1",
            origin_year: Some(2026),
            safety_level: "green",
            usage_example_count: 1,
            has_caution: false,
        };
        assert_eq!(
            edition_description("en", &input),
            "Edition art1 meaning: Edition summary of pgb2art1. Originated around 2026. Is it OK to use now? Usage signal: generally safe to use. Includes 1 usage example."
        );
        let ja = EditionDescription {
            title: "版 art1",
            summary: "版 summary",
            usage_example_count: 0,
            ..input
        };
        assert_eq!(
            edition_description("ja", &ja),
            "版 art1の意味：版 summary。2026年ごろに登場。今使っても大丈夫？使用サインは「基本的に使用可」。MemeCatchの韓国ミーム辞典の解説です。韓国語の原文ページへのリンクつき。"
        );
    }

    #[test]
    fn a_long_title_falls_back_to_a_shorter_pattern() {
        let long = "가".repeat(45);
        assert_eq!(title(&long, false), format!("{long} 뜻·유래"));
        let longer = "가".repeat(52);
        assert_eq!(title(&longer, false), format!("{longer} 뜻"));
        // Nothing fits: the shortest pattern is still used.
        let longest = "가".repeat(80);
        assert_eq!(title(&longest, false), format!("{longest} 뜻"));
        assert_eq!(title("자작", true), "자작 뜻·제작 배경, 지금 써도 될까?");
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
