//! The sources panel of the meme page (`data-detail-order="sources"` in
//! page.tsx): the category, year and tags, the first three source links,
//! `components/trust-note.tsx`, and `components/meme-contribute.tsx` (who
//! helped, and the form that sends a source or an example for review, which
//! `ui/contribute.js` posts to `POST /api/memes/contribution`).

use maud::{Markup, html};
use sqlx::Row;
use time::OffsetDateTime;

use super::MemeDocument;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::pages::content_depth::{
    SourceRow, is_context_source_url, is_public_display_source, public_source_url,
    source_document_key,
};
use crate::pages::dates::{self, korean_date};
use crate::routes::public::js;

const SHOWN_SOURCE_LINKS: usize = 3;
// DEFINITE_YEAR_PRECISIONS in lib/labels.ts.
const DEFINITE_YEAR_PRECISIONS: [&str; 2] = ["exact", "year"];
/// `ORIGIN_KIND.house_original.user`.
pub const HOUSE_ORIGINAL_LABEL: &str = "밈캐치 자체 제작";
const INPUT: &str = "w-full rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:border-signal-cyan focus:outline-none focus:ring-4 focus:ring-signal-cyan/20";
const KIND_SELECTED: &str = "border-signal-cyan bg-surface font-semibold text-foreground";
const KIND_IDLE: &str = "border-border text-muted";

/// `sourceLinksWithContent(sources, [])`: the public sources with a valid
/// link, normalized, once per document. Empty when the reviewed-media lookup
/// failed, as `resolveMemeDelivery` leaves both lists then.
pub fn public_sources(sources: &[SourceRow], lookup_ok: bool) -> Vec<SourceRow> {
    if !lookup_ok {
        return Vec::new();
    }
    let mut seen = std::collections::HashSet::new();
    sources
        .iter()
        .filter(|source| is_public_display_source(source))
        .filter_map(|source| {
            let url = public_source_url(source.source_url.as_deref())?;
            seen.insert(source_document_key(&url).to_owned())
                .then(|| SourceRow {
                    source_url: Some(url),
                    ..source.clone()
                })
        })
        .collect()
}

/// `formatOriginYear`.
pub fn origin_year_label(year: Option<i32>, precision: &str) -> Option<String> {
    let year = year?;
    Some(if DEFINITE_YEAR_PRECISIONS.contains(&precision) {
        format!("{year}년생 밈")
    } else {
        format!("{year}년생 밈 (추정)")
    })
}

/// A row of `get_meme_contributors`.
pub struct Contributor {
    pub nickname: String,
    pub source_count: i64,
    pub example_count: i64,
}

/// `getMemeContributors`: an empty list when the read fails.
pub async fn contributors(db: &Db, meme_id: &str) -> Vec<Contributor> {
    let id = meme_id.to_owned();
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(
                    "select nickname, source_count::bigint as source_count, \
                            example_count::bigint as example_count \
                       from public.get_meme_contributors($1::uuid)",
                )
                .bind(id)
                .fetch_all(tx)
                .await
            })
        })
        .await;
    let Ok(rows) = rows else {
        return Vec::new();
    };
    rows.iter()
        .filter_map(|row| {
            let nickname: Option<String> = row.try_get("nickname").ok()?;
            let count = |name: &str| {
                row.try_get::<Option<i64>, _>(name)
                    .ok()
                    .flatten()
                    .unwrap_or(0)
            };
            nickname
                .filter(|name| !name.is_empty())
                .map(|nickname| Contributor {
                    nickname,
                    source_count: count("source_count"),
                    example_count: count("example_count"),
                })
        })
        .collect()
}

/// `summarizeEvidence` over sources already deduplicated and normalized.
struct Evidence {
    total: usize,
    primary: usize,
    context: usize,
    identified_primary: usize,
}

fn summarize(sources: &[SourceRow]) -> Evidence {
    let filled = |value: &Option<String>| {
        value
            .as_deref()
            .is_some_and(|text| !js::trim(text).is_empty())
    };
    let mut evidence = Evidence {
        total: sources.len(),
        primary: 0,
        context: 0,
        identified_primary: 0,
    };
    for source in sources {
        if source
            .source_url
            .as_deref()
            .is_some_and(is_context_source_url)
        {
            evidence.context += 1;
        } else {
            evidence.primary += 1;
            if filled(&source.title) || filled(&source.creator_name) {
                evidence.identified_primary += 1;
            }
        }
    }
    evidence
}

/// What the panel needs besides the row.
pub struct Panel<'a> {
    pub meme: &'a MemeDocument,
    /// `delivery.sourceLinks`.
    pub source_links: &'a [SourceRow],
    /// `delivery.publicSources`.
    pub public_sources: &'a [SourceRow],
    pub tag_names: &'a [String],
    pub contributors: &'a [Contributor],
    /// `flags.submissionsOpen`.
    pub submissions_open: bool,
    pub now: OffsetDateTime,
}

pub fn panel(view: &Panel<'_>) -> Markup {
    let meme = view.meme;
    let house = meme.origin_kind == "house_original";
    let reviewed = meme
        .content_reviewed_at
        .as_deref()
        .filter(|value| !value.is_empty());
    html! {
        section aria-labelledby="meme-about" data-detail-order="sources" class="glass-panel relative overflow-hidden rounded-2xl p-5" {
            div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {}
            div class="relative space-y-4" {
                h2 id="meme-about" class="sr-only" { (if house { "뜻과 제작" } else { "뜻과 유래" }) }
                h2 class="text-lg font-bold [word-break:keep-all]" { "출처" }
                @if let Some(reviewed) = reviewed {
                    p class="text-sm text-muted" {
                        "최종 검토일: "
                        time datetime=(reviewed) { (dates::parse(reviewed).map(korean_date).unwrap_or_else(|| "Invalid Date".to_owned())) }
                    }
                }
                p class="flex flex-wrap items-center gap-2 text-sm text-muted" {
                    span class="rounded-full bg-surface-2 px-2.5 py-1 font-medium" { (meme.category_label().unwrap_or_default()) }
                    @if let Some(year) = origin_year_label(meme.origin_year, &meme.year_precision) {
                        span class="rounded-full bg-surface-2 px-2.5 py-1 font-medium" { (year) }
                    }
                    @for name in view.tag_names {
                        span class="rounded-full bg-surface-2 px-2.5 py-1 font-medium" { "#" (name) }
                    }
                }
                @if !view.source_links.is_empty() {
                    p class="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-muted" {
                        span class="font-semibold uppercase tracking-[0.1em]" { "출처" }
                        @for (index, source) in view.source_links.iter().take(SHOWN_SOURCE_LINKS).enumerate() {
                            a href=(source.source_url.as_deref().unwrap_or("#")) target="_blank" rel="noopener noreferrer" class="inline-flex min-h-6 items-center gap-1 underline decoration-border underline-offset-2 transition-colors hover:text-foreground" {
                                span aria-hidden="true" class="tabular-nums text-muted/70" { "0" (index + 1) }
                                (source_label(source))
                                span aria-hidden="true" class="text-xs" { "↗" }
                            }
                        }
                    }
                }
                (trust_note(meme, view.public_sources, view.now))
                (contribute(meme, view.contributors, view.submissions_open))
            }
        }
    }
}

fn source_label(source: &SourceRow) -> &str {
    if source
        .source_url
        .as_deref()
        .is_some_and(|url| url.contains("namu.wiki"))
    {
        return "나무위키";
    }
    source
        .platform
        .as_deref()
        .filter(|platform| !platform.is_empty())
        .unwrap_or("원문")
}

/// `components/trust-note.tsx`.
fn trust_note(meme: &MemeDocument, sources: &[SourceRow], now: OffsetDateTime) -> Markup {
    let stored = dates::evidence_timestamp(meme.updated_at.as_deref(), now);
    let updated = html! {
        @match stored.and_then(|text| dates::parse(text).map(|time| (text, time))) {
            Some((text, time)) => time datetime=(text) { (korean_date(time)) },
            None => span { "기록 미확인" },
        }
    };
    let live_dot = html! {
        span aria-hidden="true" class="signal-live inline-block size-1.5 rounded-full bg-(--signal-cyan) align-middle" {}
    };
    if meme.origin_kind == "house_original" {
        return html! {
            div class="border-t border-border pt-3 text-sm text-muted" {
                p {
                    (live_dot) " "
                    span class="font-semibold text-foreground" { (HOUSE_ORIGINAL_LABEL) }
                    " — 밈캐치가 만들고 권리를 보유한 표현이에요. 마지막 업데이트 " (updated)
                }
                div data-track="correction_report_started" data-track-from="trust_note_house_original" data-track-short-id=(meme.short_id) {
                    a href=(format!("/submit?name={}", js::encode_uri_component(&meme.title))) rel="nofollow" class="mt-2 inline-flex min-h-11 items-center underline underline-offset-2 transition-colors hover:text-foreground" { "다른 곳에서 이 표현이 무단으로 쓰이면 알려 주세요" }
                }
            }
        };
    }
    let evidence = summarize(sources);
    if evidence.total == 0 {
        return html! {
            div class="border-t border-border pt-3 text-sm text-muted" {
                p {
                    span aria-hidden="true" { "–" } " "
                    span class="font-semibold text-foreground" { "근거 출처 준비 중" }
                    " — 이 문서는 아직 확인된 출처가 연결되지 않았어요. 마지막 업데이트 " (updated)
                }
                div data-track="correction_report_started" data-track-from="trust_note" data-track-short-id=(meme.short_id) {
                    a href="#contribute-source" class="mt-2 inline-flex min-h-11 items-center underline underline-offset-2 transition-colors hover:text-foreground" { "출처를 아시면 알려 주세요" }
                }
            }
        };
    }
    let context_only = evidence.primary == 0;
    let bare_only = !context_only && evidence.identified_primary == 0;
    html! {
        p class="border-t border-border pt-3 text-sm text-muted" {
            @if context_only || bare_only { span aria-hidden="true" { "▲" } } @else { (live_dot) }
            " "
            @if context_only {
                span class="font-semibold text-foreground" { "맥락 자료 " (evidence.context) "개 연결" }
                " — 원본은 아직 찾는 중이에요."
            } @else if bare_only {
                span class="font-semibold text-foreground" { "출처 링크 " (evidence.total) "개 수집" }
                " — 어떤 자료인지 서지 확인 중이에요."
            } @else {
                span class="stat-mono font-semibold text-foreground" { "근거 링크 " (evidence.total) "개 연결" }
                @if evidence.total > evidence.identified_primary {
                    " (서지 정보가 있는 일반 자료 " (evidence.identified_primary) "개)"
                }
            }
            @if meme.moderation_status == "limited" { " · 출처 확인 중인 문서예요." }
            " · 마지막 업데이트 " (updated)
        }
    }
}

fn contribution_label(contributor: &Contributor) -> String {
    let mut parts = Vec::new();
    if contributor.source_count > 0 {
        parts.push(format!("출처 {}", contributor.source_count));
    }
    if contributor.example_count > 0 {
        parts.push(format!("예문 {}", contributor.example_count));
    }
    parts.join("·")
}

/// `components/meme-contribute.tsx` before anyone touches it: closed, on the
/// source tab, nothing typed, the button disabled. The example fields are a
/// template `ui/contribute.js` swaps in.
fn contribute(meme: &MemeDocument, contributors: &[Contributor], enabled: bool) -> Markup {
    html! {
        div class="space-y-3" {
            @if !contributors.is_empty() {
                p class="text-sm text-muted" data-testid="meme-contributors" {
                    span class="font-semibold text-foreground" { "함께 채운 사람" }
                    " "
                    @for (index, contributor) in contributors.iter().enumerate() {
                        span {
                            @if index > 0 { ", " }
                            (contributor.nickname)
                            span class="text-muted/80" { " (" (contribution_label(contributor)) ")" }
                        }
                    }
                }
            }
            @if enabled {
                details id="contribute" class="scroll-mt-24 rounded-xl border border-border bg-surface-2" data-contribute=(meme.id) data-contribute-short-id=(meme.short_id) data-kind-selected=(KIND_SELECTED) data-kind-idle=(KIND_IDLE) {
                    summary class="flex min-h-11 cursor-pointer items-center px-4 text-base font-semibold" { "이 문서에 출처·예문 보태기" }
                    form class="space-y-3 px-4 pb-4" aria-describedby="contribute-help" {
                        p id="contribute-help" class="text-sm text-muted" { "이 밈을 처음 본 곳의 링크나 실제로 써 본 문장을 알려 주세요. 검수를 거쳐 이 문서에 바로 붙어요." }
                        fieldset class="flex flex-wrap gap-2" {
                            legend class="sr-only" { "무엇을 보탤까요" }
                            label class={"flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-base " (KIND_SELECTED)} {
                                input type="radio" class="sr-only" name="contribute-kind" checked value="source";
                                "출처 링크"
                            }
                            label class={"flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-base " (KIND_IDLE)} {
                                input type="radio" class="sr-only" name="contribute-kind" value="example";
                                "사용 예문"
                            }
                        }
                        label class="block" data-contribute-field="source" {
                            span class="mb-1 block text-sm font-medium" { "링크" }
                            input type="url" inputmode="url" placeholder="https://" maxlength="500" class=(INPUT) value="" data-contribute-input="sourceUrl";
                        }
                        label class="block" data-contribute-field="source" {
                            span class="mb-1 block text-sm font-medium" { "어떤 자료인가요? (선택)" }
                            input placeholder="예: 처음 퍼진 유튜브 영상, 관련 기사" maxlength="300" class=(INPUT) value="" data-contribute-input="note";
                        }
                        template data-contribute-example {
                            label class="block" data-contribute-field="example" {
                                span class="mb-1 block text-sm font-medium" { "어떤 상황에서 썼나요?" }
                                input placeholder="예: 친구 단톡방에서 시험이 끝났을 때" maxlength="120" class=(INPUT) value="" data-contribute-input="situation";
                            }
                            label class="block" data-contribute-field="example" {
                                span class="mb-1 block text-sm font-medium" { "실제로 쓴 문장" }
                                textarea rows="3" maxlength="500" class={(INPUT) " resize-y"} data-contribute-input="text" {}
                            }
                        }
                        label class="flex min-h-11 items-center gap-2 text-sm" {
                            input type="checkbox" class="size-4" data-contribute-input="creditPublic";
                            "반영되면 내 닉네임을 기여자로 표시해 주세요"
                        }
                        button type="submit" disabled class="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" { "검수 요청 보내기" }
                    }
                }
            }
        }
    }
}

/// `tagNames`: the stored tag names, in their order.
pub fn tag_names(meme: &MemeDocument) -> Vec<String> {
    meme.tags
        .iter()
        .filter_map(|tag| tag.name.clone())
        .filter(|name| !name.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn source(url: &str, title: Option<&str>) -> SourceRow {
        SourceRow {
            source_url: Some(url.to_owned()),
            title: title.map(str::to_owned),
            ..SourceRow::default()
        }
    }

    #[test]
    fn public_sources_drop_hidden_invalid_and_repeated_links_and_need_the_lookup() {
        let hidden = SourceRow {
            hidden_from_public: Some(true),
            ..source("https://hidden.example.org/a", None)
        };
        let sources = [
            source("https://news.example.org/a", Some("기사")),
            hidden,
            source("http://127.0.0.1/x", None),
            source("https://news.example.org/a#again", None),
            source("https://namu.wiki/w/x", None),
        ];
        let kept: Vec<String> = public_sources(&sources, true)
            .into_iter()
            .filter_map(|source| source.source_url)
            .collect();
        assert_eq!(
            kept,
            ["https://news.example.org/a", "https://namu.wiki/w/x"]
        );
        assert!(public_sources(&sources, false).is_empty());
        let evidence = summarize(&public_sources(&sources, true));
        assert_eq!(
            (
                evidence.total,
                evidence.primary,
                evidence.context,
                evidence.identified_primary
            ),
            (2, 1, 1, 1)
        );
    }

    #[test]
    fn the_year_is_an_estimate_unless_its_precision_says_otherwise() {
        assert_eq!(
            origin_year_label(Some(2022), "unknown").as_deref(),
            Some("2022년생 밈 (추정)")
        );
        assert_eq!(
            origin_year_label(Some(2019), "exact").as_deref(),
            Some("2019년생 밈")
        );
        assert_eq!(origin_year_label(None, "year"), None);
    }
}
