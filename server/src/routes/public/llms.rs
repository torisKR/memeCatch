//! `GET /llms.txt`: `app/llms.txt/route.ts`, the site guide for AI systems
//! (llmstxt.org). `force-dynamic` in Next: rendered on every request.
//!
//! Every approved, indexable meme is counted on each request (the export
//! scans the whole corpus) and the fifteen with the highest trend score are
//! listed.

use std::sync::Arc;

use axum::extract::State;
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};

use super::labels::{self, CONTACT_EMAIL, DISPLAY_CATEGORIES, SEO_CONTENT_LOCALES};
use super::publication_export::{self, ExportRow, PrimaryOrder};
use super::rankings::RankingsVisibility;
use super::{csp_report, js};
use crate::AppState;

const TRENDING_LIMIT: usize = 15;

/// `COLLECTIONS` in lib/collections.ts: slug, title, description.
const COLLECTIONS: [(&str, &str, &str); 12] = [
    (
        "2020s",
        "2020년대 밈 모음",
        "코로나 시대부터 지금까지 — 2020년대를 정의한 한국 밈 총정리.",
    ),
    (
        "2010s",
        "2010년대 밈 모음",
        "급식체·페북 감성·초기 유튜브 — 2010년대 한국 밈 총정리.",
    ),
    (
        "2000s",
        "2000년대 밈 모음",
        "싸이월드·디시·플래시 시대 — 2000년대 추억의 한국 밈 총정리.",
    ),
    (
        "classic",
        "1990년대 클래식 밈 모음",
        "TV·CF·초기 PC통신 — 1990년대에 태어난 원조 유행어 총정리.",
    ),
    (
        "phrase",
        "유행어 모음",
        "지금 도는 한국 유행어 — 뜻·유래·사용 안전도까지 한 번에.",
    ),
    (
        "challenge",
        "챌린지 모음",
        "틱톡·쇼츠를 달군 한국 챌린지 — 원본 영상과 함께 총정리.",
    ),
    (
        "song",
        "밈송·노래 밈 모음",
        "한 소절만 들어도 아는 밈송 — 원곡과 유행 맥락 총정리.",
    ),
    (
        "image",
        "짤 모음",
        "대화방 필수 짤 — 유래와 쓰는 상황까지 정리한 한국 짤 사전.",
    ),
    (
        "streamer",
        "스트리머 밈 모음",
        "아프리카TV·트위치·치지직에서 태어난 인터넷 방송 밈 총정리.",
    ),
    (
        "game",
        "게임 밈 모음",
        "스타크래프트부터 롤·배그까지 — 한국 게임 커뮤니티 밈 총정리.",
    ),
    (
        "beginner",
        "밈 입문 — 왕초보 필수 밈",
        "요즘 대화를 따라가기 위한 최소한의 밈 — 입문자용 큐레이션.",
    ),
    (
        "latest",
        "신규 등록 밈 — 최근 추가된 사전 수록 항목",
        "밈캐치 사전에 최근 새롭게 수록·검수된 밈 및 유행어 목록입니다.",
    ),
];

/// The headers of every llms export that renders.
pub fn text_response(content_language: &'static str, body: String) -> Response {
    (
        [
            (CONTENT_TYPE, "text/plain; charset=utf-8"),
            (CONTENT_LANGUAGE, content_language),
            (CACHE_CONTROL, "public, max-age=3600"),
        ],
        body,
    )
        .into_response()
}

pub async fn index(State(state): State<AppState>, rankings: Arc<RankingsVisibility>) -> Response {
    let loaded = publication_export::load_approved_indexable(
        &state.db,
        PrimaryOrder::TrendScore,
        TRENDING_LIMIT,
        true,
    )
    .await;
    let (trending, eligible_count) = match loaded {
        Ok(loaded) => loaded,
        Err(error) => {
            tracing::error!("[llms.txt] publication export failed: {error}");
            return publication_export::unavailable_response();
        }
    };
    let show_rankings = rankings.visible(&state.db, csp_report::now_ms()).await;
    text_response(
        "ko-KR",
        render(
            labels::site_url(&state.config.site_url),
            &trending,
            eligible_count,
            show_rankings,
        ),
    )
}

/// `inlineMarkdown`: one line, with `\`, `[` and `]` escaped.
fn inline_markdown(value: &str) -> String {
    let collapsed = js::collapse_spaces(value);
    let mut out = String::with_capacity(collapsed.len());
    for c in js::trim(&collapsed).chars() {
        if matches!(c, '\\' | '[' | ']') {
            out.push('\\');
        }
        out.push(c);
    }
    out
}

fn lines<T>(items: &[T], line: impl Fn(&T) -> String) -> String {
    items.iter().map(line).collect::<Vec<_>>().join("\n")
}

/// The body of `/llms.txt`.
pub fn render(
    site: &str,
    trending: &[ExportRow],
    eligible_count: usize,
    show_rankings: bool,
) -> String {
    let count = labels::en_us_count(eligible_count);
    let languages = lines(&SEO_CONTENT_LOCALES, |locale| {
        format!(
            "- [{locale} index]({site}/{locale}/llms.txt) · [{locale} reviewed corpus]({site}/{locale}/llms-full.txt)"
        )
    });
    let rankings = if show_rankings {
        format!("- [오늘의 랭킹]({site}/rankings)\n")
    } else {
        String::new()
    };
    let categories = lines(&DISPLAY_CATEGORIES, |(key, user, _)| {
        format!("- [{user}]({site}/explore?category={key})")
    });
    let collections = lines(&COLLECTIONS, |(slug, title, description)| {
        format!("- [{title}]({site}/collections/{slug}): {description}")
    });
    let trending = if trending.is_empty() {
        "- (실시간 목록은 사이트에서 확인)".to_owned()
    } else {
        lines(trending, |meme| {
            format!(
                "- [{}]({site}{}): {}",
                inline_markdown(&meme.title),
                labels::meme_path(&meme.short_id, &meme.slug),
                inline_markdown(&meme.summary)
            )
        })
    };
    format!(
        r#"# 밈캐치 (MemeCatch)

> 한국 밈·유행어·챌린지 {count}건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전.
> 각 밈은 "무슨 뜻인가 / 어디서 시작됐나 / 지금 써도 되는가(신호등)" 구조로 정리되어 있으며,
> 공개 승인 상태이고 사이트의 콘텐츠 충실도 기준을 통과한 항목만 포함합니다. 이는 독립적인 사실 검증 완료를 뜻하지 않습니다. 언어: 한국어(ko).
> English summary: MemeCatch explains Korean memes, slang, and challenges with meaning, origin, usage context, safety signals, and source attribution.

## 다국어 / Languages
{languages}

주요 진입점:
- [전체 밈 탐색]({site}/explore): 카테고리·연도·난이도 필터 + 검색
- [검색]({site}/search): 키워드·초성·별칭 검색
- [밈 연표]({site}/timeline): 1990년대부터 지금까지 연대별 대표 밈
- [줄임말·유행어 사전]({site}/slang): 요즘 신조어부터 1990년대 유행어까지 연대별 표제어·뜻·사용 안전도
- [밈력고사]({site}/quiz): 사전 데이터로 매번 새로 출제되는 10문항 밈 지식 퀴즈
- [이번 주 밈 결산]({site}/weekly): 매주 자동 갱신되는 급상승·신규 정리
{rankings}- [전체 사이트맵]({site}/sitemap.xml): 밈 상세 페이지 전체 URL
- [RSS 피드]({site}/feed.xml): 최신 등록 밈
- [RSS 피드 (최근 수정)]({site}/feed/updated.xml): 내용이 최근 보강·수정된 밈

## 카테고리
{categories}

## 테마별 모음
{collections}

## 지금 뜨는 밈
{trending}

## 인용 안내
- 밈 상세 페이지 URL 형식: {site}/memes/{{short_id}}-{{밈이름}}
- 각 페이지는 JSON-LD(DefinedTerm·WebPage)로 구조화되어 있습니다.
- 제3자 원본 영상·이미지는 저장하지 않고 출처 링크·임베드로만 제공합니다.
- 문의: {CONTACT_EMAIL}

## 정책
- [소개 및 검수 원칙]({site}/about)
- [개인정보처리방침]({site}/privacy)
- [이용약관]({site}/terms)
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values are what the function of app/llms.txt/route.ts returns.
    #[test]
    fn inline_markdown_is_one_trimmed_line_with_brackets_and_backslashes_escaped() {
        assert_eq!(
            inline_markdown("  꺾이지   않는\n마음\t이라는 [뜻] & <요약>  "),
            r"꺾이지 않는 마음 이라는 \[뜻\] & <요약>"
        );
        assert_eq!(inline_markdown(r"a\b [c](d)"), r"a\\b \[c\](d)");
        // U+FEFF and U+3000 are whitespace to JavaScript.
        assert_eq!(inline_markdown("\u{feff}밈\u{3000}캐치\u{feff}"), "밈 캐치");
        assert_eq!(inline_markdown(" \n "), "");
    }

    #[test]
    fn an_empty_corpus_has_the_placeholder_line_and_no_rankings_link() {
        let body = render("https://memes.example", &[], 0, false);

        assert!(body.contains("챌린지 0건의 뜻"));
        assert!(
            body.contains("\n## 지금 뜨는 밈\n- (실시간 목록은 사이트에서 확인)\n\n## 인용 안내\n")
        );
        assert!(
            body.contains("급상승·신규 정리\n- [전체 사이트맵](https://memes.example/sitemap.xml)")
        );
        assert!(body.contains("URL 형식: https://memes.example/memes/{short_id}-{밈이름}\n"));
        assert!(body.ends_with("- [이용약관](https://memes.example/terms)\n"));
    }

    #[test]
    fn the_rankings_link_sits_between_weekly_and_the_sitemap() {
        let body = render("https://memes.example", &[], 1_234, true);

        assert!(body.contains("챌린지 1,234건의 뜻"));
        assert!(body.contains(
            "급상승·신규 정리\n- [오늘의 랭킹](https://memes.example/rankings)\n- [전체 사이트맵]"
        ));
    }
}
