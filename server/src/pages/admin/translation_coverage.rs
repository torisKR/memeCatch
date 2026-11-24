//! The read-only panels of `/admin/translations`:
//! `TranslationSupplyControlTower` and `TranslationCoveragePanel` over
//! `getTranslationCoverage` (`translations.rs` has the rest of the screen).

use maud::{Markup, html};
use sqlx::Row;

use super::translations::{PUBLIC, language, rows};
use crate::AppState;
use crate::auth::SessionUser;
use crate::routes::admin::translations::{LOCALES, same_instant};

pub(super) struct Coverage {
    locale: &'static str,
    total: i64,
    reviewed: i64,
    review_needed: i64,
    stale: i64,
    missing: i64,
    percentage: i64,
}

/// `getTranslationCoverage` (`computeTranslationCoverage`): per locale, the
/// public memes by the state of their translation.
pub(super) async fn coverage(
    state: &AppState,
    user: &SessionUser,
) -> Result<Vec<Coverage>, String> {
    let memes = rows(
        state,
        user,
        format!("select m.id::text, to_json(m.updated_at) #>> '{{}}' from public.memes m where {PUBLIC} order by m.id"),
        Vec::new(),
    )
    .await
    .map_err(|error| crate::routes::admin::db_message(&error))?;
    let translations = rows(
        state,
        user,
        format!(
            "select t.meme_id::text, t.locale, t.status, to_json(t.source_updated_at) #>> '{{}}' \
             from public.meme_translations t join public.memes m on m.id = t.meme_id \
             where t.locale in ('en', 'ja', 'zh', 'zh-tw') and {PUBLIC}"
        ),
        Vec::new(),
    )
    .await
    .map_err(|error| crate::routes::admin::db_message(&error))?;
    let revisions: std::collections::HashMap<String, String> = memes
        .iter()
        .filter_map(|row| Some((row.try_get(0).ok()?, row.try_get(1).ok()?)))
        .collect();
    // Bucket per (locale, meme): 1 stale, 2 machine and current, 3 reviewed and current.
    let mut buckets: std::collections::HashMap<(String, String), u8> =
        std::collections::HashMap::new();
    for row in &translations {
        let (Ok(meme), Ok(locale), Ok(status), Ok(source)) = (
            row.try_get::<String, _>(0),
            row.try_get::<String, _>(1),
            row.try_get::<String, _>(2),
            row.try_get::<String, _>(3),
        ) else {
            continue;
        };
        let Some(current) = revisions.get(&meme) else {
            continue;
        };
        let bucket = if status == "stale" || !same_instant(&source, current) {
            1
        } else if status == "reviewed" {
            3
        } else {
            2
        };
        let slot = buckets.entry((locale, meme)).or_insert(bucket);
        *slot = (*slot).max(bucket);
    }
    let total = i64::try_from(revisions.len()).unwrap_or_default();
    Ok(LOCALES
        .iter()
        .map(|&locale| {
            let mut counts = [0_i64; 4];
            for meme in revisions.keys() {
                let bucket = buckets
                    .get(&(locale.to_owned(), meme.clone()))
                    .copied()
                    .unwrap_or(0);
                counts[usize::from(bucket)] += 1;
            }
            let percentage = if total == 0 {
                0
            } else {
                // `Math.round`.
                (counts[3] as f64 / total as f64 * 100.0 + 0.5).floor() as i64
            };
            Coverage {
                locale,
                total,
                reviewed: counts[3],
                review_needed: counts[2],
                stale: counts[1],
                missing: counts[0],
                percentage,
            }
        })
        .collect())
}

fn review_href(locale: &str, status: &str) -> String {
    format!("/admin/translations?locale={locale}&status={status}")
}

/// `TranslationSupplyControlTower` without request rows (`priorityRows={[]}`).
pub(super) fn tower(rows: &[Coverage], error: Option<&str>) -> Markup {
    let next = |row: &Coverage| -> (&str, &str, i64, String) {
        if row.review_needed > 0 {
            (
                "기계 번역 검수부터",
                "bg-safety-yellow-bg text-safety-yellow",
                row.review_needed,
                review_href(row.locale, "machine"),
            )
        } else if row.stale > 0 {
            (
                "원문 변경 재검수부터",
                "bg-safety-red-bg text-safety-red",
                row.stale,
                review_href(row.locale, "stale"),
            )
        } else if row.missing > 0 {
            (
                "누락 번역 보충부터",
                "bg-surface-2 text-muted",
                row.missing,
                format!("/admin/translations?locale={}", row.locale),
            )
        } else {
            (
                "현재 검수 완료",
                "bg-surface-2 text-muted",
                0,
                review_href(row.locale, "reviewed"),
            )
        }
    };
    html! {
        section aria-labelledby="translation-supply-control-tower-title" class="rounded-2xl border border-accent/30 bg-accent-soft/15 p-5" data-translation-supply-control-tower="true" {
            div {
                p class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text" { "GLOBAL SUPPLY CONTROL TOWER" }
                h2 id="translation-supply-control-tower-title" class="mt-1 text-xl font-bold" { "글로벌 번역 공급 다음 행동" }
                p class="mt-1 text-sm leading-relaxed text-muted" { "공개 원문 품질과 번역 요청을 함께 보고, 로케일별로 지금 열어야 할 검수 큐를 결정합니다. 이 표면은 읽기 전용이며 초안 생성·저장·공개 발행을 자동으로 실행하지 않습니다." }
            }
            @if let Some(error) = error {
                p class="mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red" role="alert" { "번역 공급 현황을 불러오지 못했어요. 0건으로 간주하지 않았습니다: " (error) }
            }
            @if error.is_none() && rows.is_empty() {
                p class="mt-4 rounded-xl border border-border bg-surface p-4 text-sm text-muted" { "표시할 글로벌 공급 현황이 아직 없어요." }
            } @else {
                div class="mt-4 grid gap-3 md:grid-cols-2" {
                    @for row in rows {
                        @let (label, style, count, href) = next(row);
                        article class="rounded-xl border border-border bg-surface p-4" {
                            div class="flex flex-wrap items-start justify-between gap-3" {
                                div {
                                    p class="text-xs font-bold uppercase tracking-[0.1em] text-muted" { (language(row.locale)) " " span class="font-mono" { (row.locale) } }
                                    p class="mt-1 text-base font-bold" { (label) }
                                }
                                span class=(format!("rounded-full px-2.5 py-1 text-xs font-bold {style}")) { (count) "건" }
                            }
                            div class="mt-3 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-5" {
                                span { "최신 " (row.reviewed) "/" (row.total) }
                                span { "검토 " (row.review_needed) }
                                span { "변경 " (row.stale) }
                                span { "누락 " (row.missing) }
                                span { "요청 0" }
                            }
                            a href=(href) class="mt-3 inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4" {
                                (if count == 0 && row.missing == 0 && row.stale == 0 && row.review_needed == 0 { "완료 상태 확인" } else { "이 로케일 작업 열기" })
                            }
                        }
                    }
                }
            }
        }
    }
}

const COUNT_LINK: &str = "inline-flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-4 hover:text-accent";

fn count_link(count: i64, href: String, label: String) -> Markup {
    html! {
        @if count == 0 {
            span class="tabular-nums" { "0" }
        } @else {
            a href=(href) aria-label=(label) class=(COUNT_LINK) { (count) }
        }
    }
}

/// `TranslationCoveragePanel`.
pub(super) fn coverage_panel(rows: &[Coverage], error: Option<&str>) -> Markup {
    const TH: &str = "px-4 py-3 text-right font-semibold";
    const TD: &str = "px-4 py-3 text-right";
    html! {
        section aria-labelledby="translation-coverage-title" class="rounded-2xl border border-border bg-surface p-5" data-translation-coverage-panel="true" {
            div {
                p class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text" { "GLOBAL TRANSLATION DESK" }
                h2 id="translation-coverage-title" class="mt-1 text-xl font-bold" { "로케일별 번역 완성도" }
                p class="mt-1 text-sm leading-relaxed text-muted" { "공개 밈을 기준으로 최신 검수본과 후속 작업 대상을 비교합니다." }
            }
            @if error.is_some() {
                p class="mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red" role="alert" { "번역 현황을 불러오지 못했어요. 0건으로 간주하지 않았습니다. 잠시 후 새로고침해 주세요." }
            } @else if rows.is_empty() {
                p class="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted" { "표시할 로케일별 번역 현황이 없어요." }
            } @else {
                div class="mt-4 overflow-x-auto rounded-xl border border-border" {
                    table class="w-full min-w-[760px] text-left text-sm" {
                        thead {
                            tr class="border-b border-border text-muted" {
                                th scope="col" class="px-4 py-3 font-semibold" { "로케일" }
                                th scope="col" class=(TH) { "전체 공개" }
                                th scope="col" class=(TH) { "검수 완료·최신" }
                                th scope="col" class=(TH) { "검토 필요" }
                                th scope="col" class=(TH) { "원문 변경" }
                                th scope="col" class=(TH) { "누락" }
                                th scope="col" class=(TH) { "완료율" }
                            }
                        }
                        tbody {
                            @for row in rows {
                                @let name = language(row.locale);
                                tr class="border-b border-border last:border-b-0" {
                                    th scope="row" class="px-4 py-3 font-semibold" {
                                        (name)
                                        span class="ml-1.5 font-mono text-xs font-normal text-muted" { (row.locale) }
                                    }
                                    td class="px-4 py-3 text-right tabular-nums" { (row.total) }
                                    td class="px-4 py-3 text-right tabular-nums" { (row.reviewed) }
                                    td class=(TD) { (count_link(row.review_needed, review_href(row.locale, "machine"), format!("{name} 검토 필요 {}건 보기", row.review_needed))) }
                                    td class=(TD) { (count_link(row.stale, review_href(row.locale, "stale"), format!("{name} 원문 변경 {}건 보기", row.stale))) }
                                    td class=(TD) { (count_link(row.missing, format!("/admin/translations?locale={}", row.locale), format!("{name} 누락 번역 {}건 작업 열기", row.missing))) }
                                    td class="px-4 py-3 text-right font-semibold tabular-nums" { (row.percentage) "%" }
                                }
                            }
                        }
                    }
                }
            }
            p class="mt-4 rounded-xl bg-safety-yellow-bg px-4 py-3 text-sm leading-relaxed text-safety-yellow" { "누락 행은 오프라인에서 번역 초안을 생성한 뒤 사람의 검토를 거쳐야 합니다. 이 화면에서는 자동 생성하거나 공개하지 않습니다." }
        }
    }
}
