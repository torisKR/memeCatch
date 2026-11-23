//! `GET /llms-full.txt`: `app/llms-full.txt/route.ts`, the full text of the
//! 400 approved, indexable memes with the highest trend score, grouped by
//! category. `force-dynamic` in Next: rendered on every request.

use axum::extract::State;
use axum::response::Response;

use super::js;
use super::labels::{self, CONTACT_EMAIL, DISPLAY_CATEGORIES, SAFETY_LEVELS, SEO_CONTENT_LOCALES};
use super::llms::text_response;
use super::publication_export::{self, ExportRow, PrimaryOrder};
use crate::AppState;

const MAX_MEMES: usize = 400;

pub async fn full(State(state): State<AppState>) -> Response {
    let loaded = publication_export::load_approved_indexable(
        &state.db,
        PrimaryOrder::TrendScore,
        MAX_MEMES,
        true,
    )
    .await;
    match loaded {
        Ok((memes, eligible_count)) => text_response(
            "ko-KR",
            render(
                labels::site_url(&state.config.site_url),
                &memes,
                eligible_count,
            ),
        ),
        Err(error) => {
            tracing::error!("[llms-full.txt] publication export failed: {error}");
            publication_export::unavailable_response()
        }
    }
}

/// `oneLine`.
fn one_line(value: Option<&str>) -> String {
    js::trim(&js::collapse_spaces(value.unwrap_or_default())).to_owned()
}

/// `memeBlock`.
fn meme_block(meme: &ExportRow, site: &str) -> String {
    let safety = SAFETY_LEVELS
        .iter()
        .find(|(key, _, _)| *key == meme.safety_level);
    let (icon, wording) = safety.map_or(("", meme.safety_level.as_str()), |(_, icon, user)| {
        (*icon, *user)
    });
    let mut lines = vec![
        format!("### {}", meme.title),
        format!(
            "- URL: {site}{}",
            labels::meme_path(&meme.short_id, &meme.slug)
        ),
        format!("- 사용 안전도: {icon} {wording}"),
    ];
    // `if (m.origin_year)`: neither null nor 0.
    if let Some(year) = meme.origin_year.filter(|year| *year != 0) {
        lines.push(format!("- 시기: {year}"));
    }
    if !meme.aliases.is_empty() {
        let aliases: Vec<String> = meme
            .aliases
            .iter()
            .map(|alias| one_line(alias.as_deref()))
            .filter(|alias| !alias.is_empty())
            .collect();
        lines.push(format!("- 별칭: {}", aliases.join(", ")));
    }
    for (label, value) in [
        ("한 줄 뜻", Some(meme.summary.as_str())),
        ("설명", Some(meme.description.as_str())),
        ("유래", Some(meme.origin.as_str())),
        ("사용법·주의", meme.usage_note.as_deref()),
    ] {
        let text = one_line(value);
        if !text.is_empty() {
            lines.push(format!("- {label}: {text}"));
        }
    }
    lines.join("\n")
}

/// The meme sections: one per display category that has memes, in the order
/// of `DISPLAY_CATEGORY_LIST`, the AI category left out.
fn sections(memes: &[ExportRow], site: &str) -> String {
    DISPLAY_CATEGORIES[1..]
        .iter()
        .filter_map(|(_, user, categories)| {
            let blocks: Vec<String> = categories
                .iter()
                .flat_map(|category| memes.iter().filter(move |meme| meme.category == *category))
                .map(|meme| meme_block(meme, site))
                .collect();
            (!blocks.is_empty()).then(|| format!("## {user}\n\n{}", blocks.join("\n\n")))
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// The body of `/llms-full.txt`.
pub fn render(site: &str, memes: &[ExportRow], eligible_count: usize) -> String {
    let count = labels::en_us_count(eligible_count);
    let translations = SEO_CONTENT_LOCALES
        .map(|locale| format!("- {locale}: {site}/{locale}/llms-full.txt"))
        .join("\n");
    let safety_legend = SAFETY_LEVELS
        .map(|(_, icon, user)| format!("- {icon} {user}"))
        .join("\n");
    let mut body_memes = sections(memes, site);
    if body_memes.is_empty() {
        body_memes = "- (본문은 사이트에서 확인하세요)".to_owned();
    }
    format!(
        r#"# 밈캐치 (MemeCatch) — 전체 본문

> 한국 밈·유행어·챌린지 {count}건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전.
> 이 문서는 답변엔진이 링크 크롤링 없이도 인용할 수 있도록, 트렌드 상위 밈의 본문을 그대로 담은 것입니다.
> 공개 승인 상태이고 사이트의 콘텐츠 충실도 기준을 통과한 항목만 포함합니다. 이는 독립적인 사실 검증 완료를 뜻하지 않으며, 제3자 원본 영상·이미지는 저장하지 않고 출처 링크로만 제공합니다.
> 언어: 한국어(ko). 전체 밈 URL 목록은 {site}/sitemap.xml 을, 요약 인덱스는 {site}/llms.txt 를 참고하세요.

## Reviewed translations
{translations}

## 사용 안전도(신호등) 범례
{safety_legend}

## 인용 안내
- 밈 상세 페이지 URL 형식: {site}/memes/{{short_id}}-{{밈이름}}
- 각 페이지는 JSON-LD(DefinedTerm·WebPage)로 구조화되어 있습니다.
- 문의: {CONTACT_EMAIL}

{body_memes}
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meme(json: serde_json::Value) -> ExportRow {
        let mut row = serde_json::json!({
            "short_id": "r1aaaa01", "slug": "slug", "title": "제목", "summary": "",
            "category": "phrase", "origin_year": null, "published_at": null,
            "updated_at": "2026-01-01T00:00:00+00:00", "description": "", "origin": "",
            "usage_note": null, "caution": null, "usage_examples": null, "aliases": [],
            "safety_level": "green", "moderation_status": "approved",
            "meme_sources": [], "meme_contents": [], "meme_tags_map": [],
        });
        row.as_object_mut()
            .unwrap()
            .extend(json.as_object().unwrap().clone());
        serde_json::from_value(row).unwrap()
    }

    #[test]
    fn a_block_lists_only_the_fields_that_have_text() {
        let bare = meme(serde_json::json!({}));
        let full = meme(serde_json::json!({
            "origin_year": 2022, "aliases": ["별칭 하나", "   ", "두\n줄", null],
            "summary": " 요약\t둘 ", "description": "설명", "origin": "유래",
            "usage_note": " 사용법 ", "safety_level": "red",
        }));

        assert_eq!(
            meme_block(&bare, "https://memes.example"),
            "### 제목\n- URL: https://memes.example/memes/r1aaaa01-slug\n- 사용 안전도: ● 써도 됨"
        );
        assert_eq!(
            meme_block(&full, "https://memes.example"),
            "### 제목\n- URL: https://memes.example/memes/r1aaaa01-slug\n- 사용 안전도: ✕ 쓰면 위험\n- 시기: 2022\n- 별칭: 별칭 하나, 두 줄\n- 한 줄 뜻: 요약 둘\n- 설명: 설명\n- 유래: 유래\n- 사용법·주의: 사용법"
        );
    }

    #[test]
    fn year_zero_is_left_out_and_blank_aliases_leave_an_empty_list() {
        let block = meme_block(
            &meme(serde_json::json!({ "origin_year": 0, "aliases": ["  "] })),
            "",
        );

        assert!(!block.contains("시기"));
        assert!(block.ends_with("\n- 별칭: "));
    }

    #[test]
    fn sections_follow_the_display_categories_and_skip_the_empty_ones() {
        let memes = [
            meme(serde_json::json!({ "title": "챌린지", "category": "challenge" })),
            meme(serde_json::json!({ "title": "영상", "category": "image" })),
            meme(serde_json::json!({ "title": "댄스", "category": "dance" })),
            meme(serde_json::json!({ "title": "유행어", "category": "phrase" })),
        ];

        let rendered = sections(&memes, "");
        let headings: Vec<&str> = rendered
            .lines()
            .filter(|line| line.starts_with('#'))
            .collect();

        // Dance before challenge inside the section, whatever the row order.
        assert_eq!(
            headings,
            [
                "## 밈 용어(유행어)",
                "### 유행어",
                "## 챌린지 댄스",
                "### 댄스",
                "### 챌린지",
                "## 밈 영상",
                "### 영상",
            ]
        );
    }

    #[test]
    fn an_empty_corpus_has_the_placeholder_line() {
        let body = render("https://memes.example", &[], 0);

        assert!(body.ends_with("- 문의: toris@toris.kr\n\n- (본문은 사이트에서 확인하세요)\n"));
    }
}
