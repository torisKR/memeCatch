//! `GET /about` (`app/(default)/about/page.tsx`): who runs the site and how
//! content is reviewed. Static copy, except for the number of indexed memes.
//!
//! The markup is what Next renders (`scripts/html-to-maud.mjs`), including
//! the missing space in "1990년대부터오늘까지": JSX drops the line break
//! between the two, and this port reproduces the page, not the intent.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde_json::Value;
use sqlx::Row;

use super::content_depth::{ContentRow, DepthInput, SourceRow, content_depth};
use super::document::{self, Head, ShareImage};
use super::{Pages, html as html_response, meme_detail};
use crate::AppState;
use crate::db::{Db, DbIdentity, IdentityOptions};

// The columns of DEPTH_SELECT in app/sitemap.ts that the index test reads.
const INDEX_CANDIDATES: &str = "\
select m.short_id, m.description, m.origin, m.usage_note, m.caution, \
       m.usage_examples::text as usage_examples, \
       (select coalesce(json_agg(json_build_object('source_url', s.source_url, \
               'hidden_from_public', s.hidden_from_public)), '[]'::json)::text \
          from public.meme_sources s where s.meme_id = m.id) as sources, \
       (select coalesce(json_agg(json_build_object('availability', c.availability, \
               'moderation_status', c.moderation_status)), '[]'::json)::text \
          from public.meme_contents c where c.meme_id = m.id) as contents, \
       (select count(*) from public.meme_tags_map t where t.meme_id = m.id) as tag_count \
  from public.memes m \
 where m.moderation_status in ('approved', 'limited')";

/// `getIndexableKoreanMemeCount`: the public memes the sitemap lists, that
/// is, every one that passes the index test and is not an alias of another.
/// `None` when the catalog cannot be read.
async fn indexable_meme_count(pages: &Pages, db: &Db) -> Option<i64> {
    pages
        .indexable_count
        .get_or_load(|| count_indexable_memes(db))
        .await
        .inspect_err(|error| tracing::warn!(%error, "indexable meme count failed"))
        .ok()
}

async fn count_indexable_memes(db: &Db) -> Result<i64, sqlx::Error> {
    // About 4,000 rows of prose: read once per cache period, counted, dropped.
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(INDEX_CANDIDATES).fetch_all(tx).await })
        })
        .await?;
    let decode = |error: serde_json::Error| sqlx::Error::Decode(Box::new(error));
    let mut count = 0;
    for row in rows {
        let short_id: String = row.try_get("short_id")?;
        if meme_detail::is_canonical_alias(&short_id) {
            continue;
        }
        let sources: Vec<SourceRow> =
            serde_json::from_str(row.try_get("sources")?).map_err(decode)?;
        let contents: Vec<ContentRow> =
            serde_json::from_str(row.try_get("contents")?).map_err(decode)?;
        let usage_examples: Option<String> = row.try_get("usage_examples")?;
        let usage_examples = usage_examples
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(Value::Null);
        let tag_count: i64 = row.try_get("tag_count")?;
        let description: String = row.try_get("description")?;
        let origin: String = row.try_get("origin")?;
        let usage_note: Option<String> = row.try_get("usage_note")?;
        let caution: Option<String> = row.try_get("caution")?;
        let depth = content_depth(&DepthInput {
            description: &description,
            origin: &origin,
            usage_note: usage_note.as_deref(),
            caution: caution.as_deref(),
            usage_examples: &usage_examples,
            sources: &sources,
            contents: &contents,
            tag_count: usize::try_from(tag_count).unwrap_or_default(),
        });
        count += i64::from(depth.is_indexable());
    }
    Ok(count)
}

/// `Number.prototype.toLocaleString("ko-KR")` for a count: groups of three.
fn grouped(count: i64) -> String {
    let digits = count.unsigned_abs().to_string();
    let mut out = String::new();
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            out.push(',');
        }
        out.push(digit);
    }
    out
}

/// `aboutDescription` in lib/about-copy.ts.
fn description(count: Option<i64>) -> String {
    let subject = count.map_or_else(
        || "한국 밈·유행어".to_owned(),
        |count| format!("한국 밈·유행어 {}건", grouped(count)),
    );
    format!(
        "밈캐치는 {subject}의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전입니다. 콘텐츠 검수 원칙과 운영 방침을 소개합니다."
    )
}

/// `aboutRecordedSentence`.
fn recorded_sentence(count: Option<i64>) -> String {
    count.map_or_else(
        || "오늘까지 공개된 한국 밈을 기록하고 있습니다.".to_owned(),
        |count| format!("오늘까지 {}건의 밈을 기록하고 있습니다.", grouped(count)),
    )
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let count = indexable_meme_count(&state.pages, &state.db).await;
    let site = &state.pages.site;
    let head = Head {
        title: "소개".to_owned(),
        description: Some(description(count)),
        robots: None,
        canonical: Some("/about".to_owned()),
        languages: Vec::new(),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    html_response(
        StatusCode::OK,
        document::page(site, &head, super::path_and_query(&request), main(count)),
    )
}

const LINK: &str = "text-accent-text underline underline-offset-2";
const STEP: &str = "rounded-xl border border-border bg-surface p-4 text-base leading-relaxed";
const STEP_NUMBER: &str = "stat-mono text-sm font-bold text-accent";
const PARAGRAPH: &str = "mt-4 text-base leading-relaxed";
const LEAD_PARAGRAPH: &str = "mt-3 text-base leading-relaxed";

fn main(count: Option<i64>) -> Markup {
    html! {
        main class="mx-auto max-w-site px-4 pb-16 pt-10" {
            div class="max-w-3xl" {
                h1 class="page-title" { "밈캐치 소개" }
                p class="mt-3 text-lg leading-relaxed text-muted" {
                    "밈캐치는 한국 밈·유행어·챌린지의 "
                    strong class="text-foreground" { "뜻·유래·지금 써도 되는지" }
                    "를 한 번에 알려주는 실시간 밈 사전입니다. 1990년대부터" (recorded_sentence(count))
                }
                section class="mt-10" {
                    h2 class="text-xl font-bold" { "왜 만들었나" }
                    p class=(LEAD_PARAGRAPH) {
                        "밈의 뜻을 알려주는 곳은 이미 많습니다. 정작 아쉬웠던 건 뜻을 알고 난 다음이었습니다. 뜻을 알아도 “이걸 회사 단톡방에서 써도 되나”는 여전히 알 수 없었고, 유행이 지난 줄 모르고 썼다가 분위기가 식는 일도 흔했습니다. 밈은 뜻보다 "
                        strong { "쓸 자리" }
                        "에서 사고가 납니다. 밈캐치는 그 지점에 답하려고 만든 사전입니다."
                    }
                    p class=(PARAGRAPH) {
                        "사전을 만들며 정리한 판단 기준은 "
                        a class=(LINK) href="/guides" { "가이드" }
                        "에 긴 글로 풀어 두었습니다. 사용 신호 읽는 법, 단톡방에 보내기 전 점검, 출처 확인 방법 같은 내용입니다."
                    }
                }
                section class="mt-10" {
                    h2 class="text-xl font-bold" { "다른 밈 위키와 무엇이 다른가요" }
                    p class=(LEAD_PARAGRAPH) {
                        "기존 밈 위키는 대체로 “이 밈이 무엇인가”를 설명하는 데서 멈춥니다. 밈캐치는 거기에 "
                        strong { "지금 써도 되는지에 대한 판단" }
                        "을 근거와 함께 붙입니다."
                    }
                    ul class="mt-4 space-y-3 text-base leading-relaxed" {
                        li {
                            strong { "🚦 사용 안전 신호등" }
                            " — 밈마다 “써도 됨 / 맥락 주의 / 이미 늦음 / 쓰면 위험”을 표시합니다. 직장·친구·가족·SNS 상황별 가이드도 함께 제공합니다. 등급만 던지지 않고 상세의 ‘이 판정의 근거’에서 왜 그렇게 판정했는지를 밝히며, 어떤 기준으로 등급을 나누는지는 "
                            a class=(LINK) href="/editorial" { "편집 원칙" }
                            "에 공개해 두었습니다."
                        }
                        li {
                            strong { "🔥 밈 생명 게이지" }
                            " — 급상승부터 추억 밈까지, 밈의 생애주기를 실시간 조회 데이터 기반으로 보여줍니다. “아직 뜨거운 밈인지, 이미 식은 밈인지”를 감이 아니라 추이로 확인할 수 있습니다."
                        }
                        li {
                            strong { "출처 중심" }
                            " — 원본 영상·이미지를 무단 저장하지 않고 유튜브 임베드·출처 링크로만 연결합니다. 공개한 뒤에도 링크가 살아 있는지 주기적으로 확인해, 원저작자가 내린 영상은 저희 화면에서도 자동으로 내려갑니다."
                        }
                    }
                }
                section class="mt-10" {
                    h2 class="text-xl font-bold" { "콘텐츠는 이렇게 검수됩니다" }
                    ol class="instrument-grid mt-4 grid gap-3 rounded-2xl border border-border/60 p-4 sm:grid-cols-2 sm:p-5" {
                        li class=(STEP) {
                            p aria-hidden="true" class=(STEP_NUMBER) { "01" }
                            p class="mt-1.5" {
                                strong { "제보 접수" }
                                " — 누구나 "
                                a rel="nofollow" class=(LINK) href="/submit" { "밈 제보" }
                                "로 새 밈을 알려줄 수 있습니다."
                            }
                        }
                        li class=(STEP) {
                            p aria-hidden="true" class=(STEP_NUMBER) { "02" }
                            p class="mt-1.5" {
                                strong { "사실 확인" }
                                " — 유래·연도·의미를 복수 출처로 교차 확인합니다. 확인되지 않는 항목은 공개하지 않습니다."
                            }
                        }
                        li class=(STEP) {
                            p aria-hidden="true" class=(STEP_NUMBER) { "03" }
                            p class="mt-1.5" {
                                strong { "저작권 확인" }
                                " — 임베드·링크가 원저작자 권리를 침해하지 않는지 확인합니다."
                            }
                        }
                        li class=(STEP) {
                            p aria-hidden="true" class=(STEP_NUMBER) { "04" }
                            p class="mt-1.5" {
                                strong { "공개 및 갱신" }
                                " — 공개 후에도 유행 상태와 사용 안전도를 계속 갱신합니다. 제보는 보통 24~48시간 안에 등록 여부를 회신하며, 유래 확인에 자료가 더 필요하면 사흘까지 걸릴 수 있습니다."
                            }
                        }
                    }
                    p class=(PARAGRAPH) { "검색 결과와 목록에는 뜻·유래·사용법·예문을 합친 설명이 250자 이상이고 확인한 출처가 붙은 문서만 올립니다. 아직 설명이 짧은 문서는 주소로는 열리지만, 보강할 때까지 목록과 검색 노출에서 뺍니다." }
                    p class=(PARAGRAPH) {
                        "어떤 밈을 수록하고 무엇을 수록하지 않는지, 사용 안전 등급을 어떤 근거로 매기는지, 출처의 권리를 어떻게 확인하는지는 "
                        a class=(LINK) href="/editorial" { "편집 원칙" }
                        "에 전부 공개해 두었습니다."
                    }
                }
                section class="mt-10" {
                    h2 class="text-xl font-bold" { "누가 만드나요" }
                    p class=(LEAD_PARAGRAPH) {
                        "밈캐치는 온라인 커뮤니티와 인터넷 방송 문화를 오래 지켜본 개인 개발자("
                        strong { "toris-dev" }
                        ")가 기획·개발·편집을 모두 맡아 운영합니다. 편집을 맡는 팀이 따로 있지 않고, 수록 여부와 사용 안전 등급 판정도 같은 사람이 직접 확인합니다. 회사가 아니라 1인이 만드는 사전이라는 점을 먼저 밝히는 것이 맞다고 생각합니다. 코드는 "
                        a href="https://github.com/toris-dev/memeCatch" target="_blank" rel="noopener noreferrer" class=(LINK) { "GitHub" }
                        "에 공개되어 있습니다."
                    }
                    p class=(PARAGRAPH) { "밈캐치는 누구나 무료로 쓰는 커뮤니티이며, 운영비는 광고로만 충당합니다. 유료 멤버십이나 결제 기능은 없고, 광고주는 밈의 수록 여부나 안전 등급에 관여하지 않습니다." }
                }
                section class="mt-10" {
                    h2 class="text-xl font-bold" { "문의·정정·삭제 요청" }
                    p class=(LEAD_PARAGRAPH) { "틀린 내용이나 저작권 문제를 발견하셨다면 알려 주세요. 확인 후 정정하거나 내립니다." }
                    ul class="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed" {
                        li {
                            strong { "이메일" }
                            " "
                            a href="mailto:toris@toris.kr" class=(LINK) { "toris@toris.kr" }
                            " — 문의·제휴·저작권 삭제 요청. 로그인 없이 보낼 수 있습니다."
                        }
                        li {
                            strong {
                                a class=(LINK) href="/support" { "고객센터" }
                            }
                            " — 로그인 후 1:1 문의. 답변이 같은 화면에 기록돼 진행 상황을 확인할 수 있습니다."
                        }
                        li {
                            strong {
                                a rel="nofollow" class=(LINK) href="/submit" { "밈 제보" }
                            }
                            " — 아직 없는 밈이나 빠진 정보 알려주기."
                        }
                    }
                    p class=(PARAGRAPH) {
                        "요청별 처리 방식은 "
                        a class=(LINK) href="/editorial" { "편집 원칙" }
                        "의 정정·삭제 항목에 정리해 두었습니다."
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_count_is_grouped_as_korean_locale_numbers_are() {
        assert_eq!(grouped(0), "0");
        assert_eq!(grouped(13), "13");
        assert_eq!(grouped(999), "999");
        assert_eq!(grouped(1000), "1,000");
        assert_eq!(grouped(3905), "3,905");
        assert_eq!(grouped(1234567), "1,234,567");
    }

    #[test]
    fn copy_states_the_count_only_when_the_catalog_was_read() {
        assert_eq!(
            description(Some(3905)),
            "밈캐치는 한국 밈·유행어 3,905건의 뜻·유래·사용 안전도를 기록하는 실시간 밈 사전입니다. 콘텐츠 검수 원칙과 운영 방침을 소개합니다."
        );
        assert!(description(None).starts_with("밈캐치는 한국 밈·유행어의 뜻"));
        assert_eq!(
            recorded_sentence(None),
            "오늘까지 공개된 한국 밈을 기록하고 있습니다."
        );
        let body = main(Some(13)).into_string();
        assert!(body.contains("1990년대부터오늘까지 13건의 밈을 기록하고 있습니다."));
    }
}
