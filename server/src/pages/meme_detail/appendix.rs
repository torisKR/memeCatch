//! The appendix of the meme page (`data-detail-order="appendix"`):
//! `components/safety-rationale.tsx` (why the signal is what it is, with the
//! usage contexts of `components/usage-guide.tsx`) and
//! `components/meme-lifecycle-guide.tsx` (is it still used).

use maud::{Markup, PreEscaped, html};
use serde_json::Value;

use super::MemeDocument;
use crate::pages::dates::{self, korean_date};
use crate::pages::labels::{Lifecycle, SafetyLevel};
use crate::pages::meme_card::safety_badge;
use crate::routes::public::js;

/// `USAGE_CONTEXTS`, in its key order.
const CONTEXTS: [(&str, &str, &str); 4] = [
    (
        "work",
        "직장에서",
        "직장에서의 사용 맥락을 기준으로 한 판정이에요.",
    ),
    (
        "friends",
        "친구끼리",
        "친구끼리의 사용 맥락을 기준으로 한 판정이에요.",
    ),
    (
        "family",
        "자녀·가족과",
        "자녀·가족과의 사용 맥락을 기준으로 한 판정이에요.",
    ),
    (
        "sns",
        "공개 SNS에서",
        "공개 SNS에서의 사용 맥락을 기준으로 한 판정이에요.",
    ),
];
/// The order the verdict reads the levels in: least risky first.
const VERDICT_ORDER: [SafetyLevel; 4] = [
    SafetyLevel::Green,
    SafetyLevel::Yellow,
    SafetyLevel::Gray,
    SafetyLevel::Red,
];

struct Row {
    label: &'static str,
    fallback: &'static str,
    level: SafetyLevel,
}

/// `parseUsageContext`: the four contexts that hold a known level.
fn usage_rows(context: &Value) -> Vec<Row> {
    let Some(object) = context.as_object() else {
        return Vec::new();
    };
    CONTEXTS
        .iter()
        .filter_map(|(key, label, fallback)| {
            let level = SafetyLevel::parse_known(object.get(*key)?.as_str()?)?;
            Some(Row {
                label,
                fallback,
                level,
            })
        })
        .collect()
}

fn meaning(level: SafetyLevel) -> &'static str {
    match level {
        SafetyLevel::Green => {
            "커뮤니티 사용례에서 부정적 맥락 없이 널리 쓰이는 것으로 확인된 등급이에요."
        }
        SafetyLevel::Yellow => {
            "맥락에 따라 오해나 불쾌감을 줄 수 있어 상황을 가려 써야 하는 등급이에요."
        }
        SafetyLevel::Gray => "유행이 지나 지금 쓰면 어색하게 들릴 수 있는 등급이에요.",
        SafetyLevel::Red => "비하·혐오 등 부정적 맥락과 결합해 사용 자체를 권하지 않는 등급이에요.",
    }
}

fn clause(level: SafetyLevel, last: bool) -> &'static str {
    match (level, last) {
        (SafetyLevel::Green, false) => "무리 없이 통하지만",
        (SafetyLevel::Yellow, false) => "맥락을 가려야 하고",
        (SafetyLevel::Gray, false) => "지금은 한 박자 늦게 들리고",
        (SafetyLevel::Red, false) => "쓰지 않는 게 좋고",
        (SafetyLevel::Green, true) => "무리 없이 통해요",
        (SafetyLevel::Yellow, true) => "맥락을 가려야 해요",
        (SafetyLevel::Gray, true) => "지금은 한 박자 늦게 들려요",
        (SafetyLevel::Red, true) => "쓰지 않는 게 좋아요",
    }
}

/// `contextVerdict`: the contexts grouped by level into one sentence.
fn verdict(rows: &[Row]) -> Option<String> {
    let groups: Vec<(SafetyLevel, Vec<&str>)> = VERDICT_ORDER
        .iter()
        .map(|level| {
            let names = rows
                .iter()
                .filter(|row| row.level == *level)
                .map(|row| row.label)
                .collect::<Vec<_>>();
            (*level, names)
        })
        .filter(|(_, names)| !names.is_empty())
        .collect();
    if groups.is_empty() {
        return None;
    }
    let last = groups.len() - 1;
    let parts: Vec<String> = groups
        .iter()
        .enumerate()
        .map(|(index, (level, names))| {
            format!("{}는 {}", names.join("·"), clause(*level, index == last))
        })
        .collect();
    Some(format!("{}.", parts.join(", ")))
}

fn status_code(level: SafetyLevel) -> &'static str {
    match level {
        SafetyLevel::Green => "OK",
        SafetyLevel::Yellow => "CTN",
        SafetyLevel::Gray => "OLD",
        SafetyLevel::Red => "NG",
    }
}

fn trimmed(value: Option<&str>) -> Option<&str> {
    value.map(js::trim).filter(|text| !text.is_empty())
}

/// `SafetyRationale`: nothing when the meme has no signal of its own (usage
/// contexts, a note or a caution).
fn safety_rationale(meme: &MemeDocument) -> Markup {
    let level = SafetyLevel::parse(&meme.safety_level);
    let parsed = usage_rows(&meme.usage_context);
    // Four contexts all green is the generator's default, not a check.
    let unverified = parsed.len() >= 2 && parsed.iter().all(|row| row.level == SafetyLevel::Green);
    let rows = if unverified { Vec::new() } else { parsed };
    let note = trimmed(meme.usage_note.as_deref());
    let caution = trimmed(meme.caution.as_deref());
    let verdict = verdict(&rows);
    if verdict.is_none() && note.is_none() && caution.is_none() {
        return html! {};
    }
    let reviewed = meme
        .safety_reviewed_at
        .as_deref()
        .filter(|value| !value.is_empty())
        .and_then(|value| dates::parse(value).map(|time| (value, korean_date(time))));
    let caution_tone = if level == SafetyLevel::Red {
        "bg-safety-red-bg text-safety-red"
    } else {
        "bg-safety-yellow-bg text-safety-yellow"
    };
    html! {
        section aria-labelledby="safety-rationale-title" class="space-y-4 rounded-2xl border border-border bg-surface p-5" {
            h2 id="safety-rationale-title" class="text-lg font-bold" { "이 판정의 근거" }
            div {
                p class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5" {
                    span class="stat-mono" { (safety_badge(level)) }
                    span class="text-base leading-relaxed" { (verdict.as_deref().unwrap_or(meaning(level))) }
                }
                @if let Some(note) = note {
                    p class="mt-2 whitespace-pre-line text-base leading-relaxed text-muted" { (note) }
                }
            }
            @if unverified {
                div class="rounded-xl bg-surface-2 p-4" {
                    h3 class="flex items-center gap-2 text-base font-bold" {
                        span aria-hidden="true" { "◌" } " 상황별 판정은 아직 확인 전이에요"
                    }
                    p class="mt-1.5 text-base leading-relaxed text-muted" { "직장·친구·가족·공개 SNS를 나눠서 확인한 기록이 아직 없어요. 위 등급은 문서 전체에 대한 판정이라 특정 상황에 그대로 적용된다고 보장하지 않아요. 확인이 끝나면 상황별로 나눠 보여드릴게요." }
                }
            } @else if !rows.is_empty() {
                div {
                    h3 class="text-base font-bold" { "어디서 써도 될까요?" }
                    ul class="mt-3 divide-y divide-border" {
                        @for row in &rows {
                            @let reason = if row.level == SafetyLevel::Green { note.unwrap_or(row.fallback) } else { caution.or(note).unwrap_or(row.fallback) };
                            li class="hover-glow-flame flex min-h-11 items-center justify-between gap-3 rounded-lg py-2" {
                                span {
                                    span class="text-base font-medium" { (row.label) }
                                    span class="mt-0.5 block text-sm text-muted" { (reason) }
                                }
                                span class={"inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold " (row.level.tone())} {
                                    span aria-hidden="true" class="stat-mono text-[10px] font-bold tracking-wider" { (status_code(row.level)) }
                                    span aria-hidden="true" class="leading-none" { (row.level.icon("size-4")) }
                                    (row.level.label())
                                }
                            }
                        }
                    }
                    p class="mt-3 text-sm text-muted" {
                        "최근 검수일: "
                        @match &reviewed {
                            Some((value, day)) => time datetime=(value) { (day) },
                            None => "확인된 기록 없음",
                        }
                    }
                }
            }
            @if meme.sentiment == "controversial" {
                p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" {
                    span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold" style="color:var(--sent-controversial);background:color-mix(in srgb, var(--sent-controversial) 12%, var(--surface))" {
                        span aria-hidden="true" { "◆" }
                        "논쟁 중"
                    }
                    span class="text-muted" { "커뮤니티 안에서도 평가가 갈리는 상태가 판정에 반영됐어요." }
                }
            }
            @if let Some(caution) = caution {
                div class={"hover-glow-flame rounded-xl border border-transparent p-4 " (caution_tone)} {
                    h3 class="flex items-center gap-2 text-base font-bold" {
                        span aria-hidden="true" { "▲" } " 이건 조심해 주세요"
                    }
                    p class="mt-1.5 whitespace-pre-line text-base leading-relaxed" { (caution) }
                }
            }
        }
    }
}

struct LifecycleDetail {
    title: &'static str,
    description: &'static str,
    recommendation: &'static str,
    /// The lucide icon's children, as lucide-react renders them.
    icon: (&'static str, &'static str),
    tone: &'static str,
}

fn lifecycle_detail(status: Lifecycle) -> LifecycleDetail {
    match status {
        Lifecycle::Rising => LifecycleDetail {
            title: "지금 막 뜨고 있는 최신 유행 밈",
            description: "SNS 릴스, 쇼츠, 커뮤니티에서 급격히 확산 중인 가장 핫한 신조어입니다.",
            recommendation: "친구들과의 대화나 트렌디한 SNS 댓글에 가장 적극적으로 활용할 수 있습니다. 단, 어른들이나 격식 있는 자리에서는 모르는 사람이 많을 수 있습니다.",
            icon: (
                "trending-up",
                r#"<path d="M16 7h6v6"></path><path d="m22 7-8.5 8.5-5-5L2 17"></path>"#,
            ),
            tone: "border-accent/30 bg-accent/10 text-accent",
        },
        Lifecycle::Active => LifecycleDetail {
            title: "일상과 커뮤니티에서 활발히 쓰이는 밈",
            description: "대중적인 인지도를 확보하여 일상 대화와 온라인 소통에서 자연스럽게 통용되는 시기입니다.",
            recommendation: "대다수가 맥락을 이해하므로 편하게 쓰셔도 좋습니다. 직장 내에서는 친밀한 동료와의 슬랙이나 티타임에 유쾌하게 쓸 수 있습니다.",
            icon: (
                "flame",
                r#"<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"></path>"#,
            ),
            tone: "border-safety-green/30 bg-safety-green/10 text-safety-green",
        },
        Lifecycle::Cooling => LifecycleDetail {
            title: "유행 정점을 지나 사용 빈도가 낮아진 밈",
            description: "전성기만큼 자주 쓰이지는 않으며, 무분별하게 남발할 경우 다소 올드하게 느껴질 수 있습니다.",
            recommendation: "무리하게 유행어로 쓰기보다는 가벼운 추억 공유나 특정한 맥락이 맞아떨어질 때 위트 있게 사용하는 것을 권장합니다.",
            icon: (
                "clock",
                r#"<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>"#,
            ),
            tone: "border-safety-yellow/30 bg-safety-yellow/10 text-safety-yellow",
        },
        Lifecycle::Archived => LifecycleDetail {
            title: "시대의 명언·관용구로 안착한 클래식 밈",
            description: "반짝 유행을 넘어 한국 인터넷 문화와 현대 구어의 한 페이지로 완전히 정착한 고전 밈입니다.",
            recommendation: "‘사어’라기보다는 누구나 알고 있는 상징적 표현으로, 적절한 순간에 인용하면 세대를 불문하고 깊은 공감과 유머를 이끌어낼 수 있습니다.",
            icon: (
                "archive",
                r#"<rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>"#,
            ),
            tone: "border-blue-400/30 bg-blue-400/10 text-blue-400",
        },
    }
}

/// `MemeLifecycleGuide`.
fn lifecycle_guide(meme: &MemeDocument) -> Markup {
    let status = Lifecycle::parse(&meme.lifecycle_status);
    let detail = lifecycle_detail(status);
    let (icon, paths) = detail.icon;
    html! {
        section aria-labelledby="meme-lifecycle-heading" class="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-xs" {
            div class="flex items-center justify-between" {
                h2 id="meme-lifecycle-heading" class="text-lg font-bold text-foreground" { "지금도 쓰이나요? · 트렌드 수명 분석" }
                div class={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold " (detail.tone)} {
                    svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={"lucide lucide-" (icon) " h-3.5 w-3.5"} aria-hidden="true" {
                        (PreEscaped(paths))
                    }
                    span { (status.label()) }
                }
            }
            div class="space-y-2" {
                h3 class="text-base font-semibold text-foreground" { (detail.title) }
                p class="text-sm leading-relaxed text-muted" {
                    (detail.description)
                    // `{originYear && ...}`: a year of 0 is falsy.
                    @if let Some(year) = meme.origin_year.filter(|year| *year != 0) {
                        (format!(" ({year}년 최초 등장)"))
                    }
                }
            }
            div class="rounded-xl border border-border/80 bg-surface-2 p-3.5 text-xs sm:text-sm text-foreground space-y-2" {
                div class="font-bold text-accent-text flex items-center justify-between" {
                    div class="flex items-center gap-1.5" {
                        span { "💡" }
                        span { "밈캐치 실전 사용 제안" }
                    }
                    button type="button" aria-label="실전 사용 제안 복사" title="실전 사용 제안 복사" class="inline-flex items-center justify-center font-medium transition-all active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent h-7 px-2 text-[11px] rounded-md border border-border/80 bg-surface text-muted hover:text-foreground hover:border-accent/50" data-copy=(detail.recommendation) {
                        svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" {
                            rect width="14" height="14" x="8" y="8" rx="2" ry="2" {}
                            path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" {}
                        }
                        span class="ml-1" { "제안 복사" }
                    }
                }
                p class="leading-relaxed text-muted" { (detail.recommendation) }
            }
        }
    }
}

pub fn appendix(meme: &MemeDocument) -> Markup {
    html! {
        div data-detail-order="appendix" class="space-y-5" {
            (safety_rationale(meme))
            (lifecycle_guide(meme))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_verdict_groups_contexts_from_the_least_risky_level() {
        let rows = usage_rows(
            &json!({"work": "yellow", "friends": "green", "family": "red", "sns": "gray", "x": "green"}),
        );
        assert_eq!(
            verdict(&rows).as_deref(),
            Some(
                "친구끼리는 무리 없이 통하지만, 직장에서는 맥락을 가려야 하고, 공개 SNS에서는 지금은 한 박자 늦게 들리고, 자녀·가족과는 쓰지 않는 게 좋아요."
            )
        );
        let rows = usage_rows(&json!({"work": "red", "sns": "red", "family": "blue"}));
        assert_eq!(
            verdict(&rows).as_deref(),
            Some("직장에서·공개 SNS에서는 쓰지 않는 게 좋아요.")
        );
        assert_eq!(verdict(&usage_rows(&json!([]))), None);
    }
}
