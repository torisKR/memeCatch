//! `components/meme-market-passport.tsx` with `getMemeMarketPassport(id, "ko")`
//! (lib/meme-market-passport.server.ts) and `buildMemeMarketPassport`
//! (lib/meme-market-passport.ts): the markets a meme is reviewed in and its
//! reviewed variants. Nothing is drawn without reviewed data or when a read
//! fails. The Korean copy of `MARKET_PASSPORT_COPY` is written here.
//!
//! Next keeps the passport for a day and drops it on a catalog edit; it is
//! read for each document here (`PLAN.md` B3).

use maud::{Markup, html};
use sqlx::{AssertSqlSafe, Row};

use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::pages::content_depth::{DEPTH_COLUMNS, row_depth};
use crate::routes::public::js;
use crate::routes::public::labels::meme_path;

const ROLES: [&str; 3] = ["origin", "adopted", "active"];
const RELATIONS: [&str; 3] = ["derived_from", "local_variant", "local_equivalent"];

pub struct Profile {
    market_code: String,
    language_tag: String,
    role: String,
    local_title: String,
    usage_note: Option<String>,
    caution: Option<String>,
}

pub struct Variant {
    target_title: String,
    target_href: String,
    relation: String,
}

pub struct Passport {
    profiles: Vec<Profile>,
    variants: Vec<Variant>,
}

const PROFILES: &str = "\
select meme_id::text as meme_id, market_code, language_tag, role, local_title, usage_note, caution, review_state \
  from public.meme_market_profiles where meme_id = $1::uuid and review_state = 'reviewed'";
const VARIANTS: &str = "\
select id::text as id, target_meme_id::text as target_meme_id, relation_kind, review_state \
  from public.meme_variant_links where source_meme_id = $1::uuid and review_state = 'reviewed'";

async fn rows(
    db: &Db,
    sql: String,
    bind: String,
) -> Result<Vec<sqlx::postgres::PgRow>, sqlx::Error> {
    db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
        Box::pin(async move {
            sqlx::query(AssertSqlSafe(sql))
                .bind(bind)
                .fetch_all(tx)
                .await
        })
    })
    .await
}

/// `getMemeMarketPassport(memeId, "ko")`, built. `None` when there is
/// nothing reviewed to show or a read failed ("empty", "unavailable").
pub async fn load(db: &Db, meme_id: &str) -> Option<Passport> {
    let (profiles, variants) = tokio::join!(
        rows(db, PROFILES.to_owned(), meme_id.to_owned()),
        rows(db, VARIANTS.to_owned(), meme_id.to_owned()),
    );
    let (profiles, variants) = (profiles.ok()?, variants.ok()?);
    let mut links = Vec::new();
    for row in &variants {
        let target: String = row.try_get("target_meme_id").ok()?;
        let relation: String = row.try_get("relation_kind").ok()?;
        let state: String = row.try_get("review_state").ok()?;
        links.push((target, relation, state));
    }
    let mut target_ids: Vec<&String> = Vec::new();
    for (target, _, _) in &links {
        if !target_ids.contains(&target) {
            target_ids.push(target);
        }
    }
    // The targets that pass the index test, with their Korean path.
    let mut targets = std::collections::HashMap::new();
    if !target_ids.is_empty() {
        let sql = format!(
            "select m.id::text as id, m.short_id, m.slug, m.title, {DEPTH_COLUMNS} from public.memes m \
              where m.id = any(string_to_array($1, ',')::uuid[]) \
                and m.moderation_status in ('approved', 'limited')"
        );
        let ids = target_ids
            .iter()
            .map(|id| id.as_str())
            .collect::<Vec<_>>()
            .join(",");
        for row in rows(db, sql, ids).await.ok()? {
            if !row_depth(&row).ok()?.is_indexable() {
                continue;
            }
            let id: String = row.try_get("id").ok()?;
            let short_id: String = row.try_get("short_id").ok()?;
            let slug: String = row.try_get("slug").ok()?;
            let title: String = row.try_get("title").ok()?;
            targets.insert(id, (meme_path(&short_id, &slug), title));
        }
    }

    let mut visible = Vec::new();
    for row in &profiles {
        let text = |name: &str| row.try_get::<Option<String>, _>(name).ok().flatten();
        let (
            Some(owner),
            Some(market_code),
            Some(language_tag),
            Some(role),
            Some(local_title),
            Some(state),
        ) = (
            text("meme_id"),
            text("market_code"),
            text("language_tag"),
            text("role"),
            text("local_title"),
            text("review_state"),
        )
        else {
            continue;
        };
        let valid = state == "reviewed"
            && ROLES.contains(&role.as_str())
            && !market_code.is_empty()
            && !language_tag.is_empty()
            && !js::trim(&local_title).is_empty()
            && owner == meme_id;
        if valid {
            visible.push(Profile {
                market_code,
                language_tag,
                role,
                local_title,
                usage_note: text("usage_note"),
                caution: text("caution"),
            });
        }
    }
    // Active markets first, then by market code; a stable sort.
    visible.sort_by(|a, b| {
        (b.role == "active")
            .cmp(&(a.role == "active"))
            .then_with(|| a.market_code.cmp(&b.market_code))
    });
    let variants: Vec<Variant> = links
        .into_iter()
        .filter(|(target, relation, state)| {
            state == "reviewed" && RELATIONS.contains(&relation.as_str()) && target != meme_id
        })
        .filter_map(|(target, relation, _)| {
            let (href, title) = targets.get(&target)?;
            (!js::trim(href).is_empty()).then(|| Variant {
                target_title: title.clone(),
                target_href: js::trim(href).to_owned(),
                relation,
            })
        })
        .collect();
    (!visible.is_empty() || !variants.is_empty()).then_some(Passport {
        profiles: visible,
        variants,
    })
}

fn role_label(role: &str) -> &'static str {
    match role {
        "origin" => "원본 시장",
        "active" => "현재 사용 시장",
        _ => "도입 시장",
    }
}

fn market_name(code: &str) -> &str {
    match code {
        "KR" => "한국",
        "US" => "미국",
        "JP" => "일본",
        "TW" => "대만",
        "CN" => "중국",
        "GLOBAL" => "글로벌",
        other => other,
    }
}

fn relation_label(relation: &str) -> &'static str {
    match relation {
        "derived_from" => "에서 파생",
        "local_variant" => "현지 변형",
        _ => "현지 대응 표현",
    }
}

pub fn section(passport: Option<&Passport>) -> Markup {
    let Some(passport) = passport else {
        return html! {};
    };
    html! {
        section aria-labelledby="meme-market-passport-title" data-market-passport="reviewed" data-market-profile-count=(passport.profiles.len()) data-market-variant-count=(passport.variants.len()) class="rounded-2xl border border-border bg-surface-2 p-5 sm:p-7" {
            h2 id="meme-market-passport-title" class="text-xl font-black tracking-tight" { "이 밈은 어디에서 어떻게 쓰이나요?" }
            p class="mt-2 text-sm leading-relaxed text-muted" { "화면 언어와 밈의 원산지·사용 시장은 다를 수 있어요. 검수된 시장 정보만 보여드려요." }
            div class="mt-5 grid gap-3 sm:grid-cols-2" {
                @for profile in &passport.profiles {
                    article class="rounded-xl border border-border bg-surface p-4" {
                        div class="flex items-start justify-between gap-3" {
                            div {
                                p class="text-xs font-semibold text-muted" { (role_label(&profile.role)) }
                                h3 class="mt-1 font-bold" { (market_name(&profile.market_code)) }
                            }
                            span class="rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-text" { (profile.market_code) }
                        }
                        p class="mt-3 text-sm font-semibold" { (profile.local_title) }
                        p class="mt-1 text-xs text-muted" { "언어: " (profile.language_tag) }
                        @if let Some(note) = profile.usage_note.as_deref().filter(|note| !note.is_empty()) {
                            p class="mt-3 text-sm leading-relaxed" { strong { "현지 사용 메모:" } " " (note) }
                        }
                        @if let Some(caution) = profile.caution.as_deref().filter(|caution| !caution.is_empty()) {
                            p class="mt-2 text-sm leading-relaxed text-safety-yellow" { strong { "현지 주의사항:" } " " (caution) }
                        }
                    }
                }
            }
            div class="mt-6 border-t border-border pt-5" {
                h3 class="font-bold" { "연결된 현지 변형" }
                p class="mt-1 text-sm text-muted" { "같은 밈 계보로 검수된 다른 문서를 확인하세요." }
                @if passport.variants.is_empty() {
                    p class="mt-3 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-muted" { "아직 검수된 현지 변형 연결이 없어요." }
                } @else {
                    ul class="mt-3 grid gap-2 sm:grid-cols-2" {
                        @for variant in &passport.variants {
                            li {
                                a href=(variant.target_href) class="block rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" {
                                    span class="block text-xs font-semibold text-muted" { (relation_label(&variant.relation)) }
                                    span class="mt-1 block font-semibold" { (variant.target_title) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
