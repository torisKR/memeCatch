//! `components/meme-market-passport.tsx` with `getMemeMarketPassport(id, "ko")`
//! (lib/meme-market-passport.server.ts) and `buildMemeMarketPassport`
//! (lib/meme-market-passport.ts): the markets a meme is reviewed in and its
//! reviewed variants. Nothing is drawn without reviewed data or when a read
//! fails. An edition's passport (`load_in`) links a variant through its
//! reviewed translation only.
//!
//! It is read for each document (`PLAN.md` B3).

use std::collections::HashMap;

use maud::{Markup, html};
use sqlx::{AssertSqlSafe, Row};

use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::pages::content_depth::{DEPTH_COLUMNS, row_depth};
use crate::routes::public::js;
use crate::routes::public::labels::meme_path;
use crate::routes::public::localized;

use super::edition_copy;

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
    load_in(db, meme_id, None).await
}

/// An edition's passport (`getMemeMarketPassport(memeId, locale)`): its
/// code and the discovery index (`None`: not read, so the passport is
/// unavailable). A variant is linked only through its reviewed translation
/// (`buildLocalizedTargetRows`).
pub struct Edition<'a> {
    pub code: &'static str,
    pub discovery: Option<&'a [String]>,
}

pub async fn load_in(db: &Db, meme_id: &str, edition: Option<Edition<'_>>) -> Option<Passport> {
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
    // The targets that pass the index test: short id, slug and title by id.
    let mut targets: Vec<(String, String, String, String)> = Vec::new();
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
            targets.push((id, short_id, slug, title));
        }
    }
    let targets = route_ready(db, targets, edition).await?;

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

/// The targets by id, each with its path and title: the Korean ones, or
/// for an edition the reviewed translations (`None` when they cannot be read).
async fn route_ready(
    db: &Db,
    targets: Vec<(String, String, String, String)>,
    edition: Option<Edition<'_>>,
) -> Option<HashMap<String, (String, String)>> {
    let Some(edition) = edition else {
        return Some(
            targets
                .into_iter()
                .map(|(id, short_id, slug, title)| (id, (meme_path(&short_id, &slug), title)))
                .collect(),
        );
    };
    if targets.is_empty() {
        return Some(HashMap::new());
    }
    let ids: Vec<&str> = targets
        .iter()
        .map(|(_, short_id, _, _)| short_id.as_str())
        .collect();
    let translated = localized::search(db, edition.code, &ids, edition.discovery?, false)
        .await
        .ok()?;
    Some(
        targets
            .iter()
            .filter_map(|(id, short_id, _, _)| {
                let meme = translated.get(short_id)?;
                let path = format!("/{}{}", edition.code, meme_path(&meme.short_id, &meme.slug));
                Some((id.clone(), (path, meme.title.clone())))
            })
            .collect(),
    )
}

/// `MemeMarketPassport` in `code`'s copy (Korean or an edition).
pub fn section(passport: Option<&Passport>, code: &str) -> Markup {
    let Some(passport) = passport else {
        return html! {};
    };
    let copy = edition_copy::passport(code);
    let role_label = |role: &str| match role {
        "origin" => &copy.origin_role,
        "active" => &copy.active,
        _ => &copy.adopted,
    };
    let market_name = |code: &str| {
        copy.market_names
            .get(code)
            .map_or(code.to_owned(), Clone::clone)
    };
    let relation_label = |relation: &str| copy.relations.get(relation).cloned().unwrap_or_default();
    html! {
        section aria-labelledby="meme-market-passport-title" data-market-passport="reviewed" data-market-profile-count=(passport.profiles.len()) data-market-variant-count=(passport.variants.len()) class="rounded-2xl border border-border bg-surface-2 p-5 sm:p-7" {
            h2 id="meme-market-passport-title" class="text-xl font-black tracking-tight" { (copy.title) }
            p class="mt-2 text-sm leading-relaxed text-muted" { (copy.description) }
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
                        p class="mt-1 text-xs text-muted" { (copy.language) ": " (profile.language_tag) }
                        @if let Some(note) = profile.usage_note.as_deref().filter(|note| !note.is_empty()) {
                            p class="mt-3 text-sm leading-relaxed" { strong { (copy.usage) ":" } " " (note) }
                        }
                        @if let Some(caution) = profile.caution.as_deref().filter(|caution| !caution.is_empty()) {
                            p class="mt-2 text-sm leading-relaxed text-safety-yellow" { strong { (copy.caution) ":" } " " (caution) }
                        }
                    }
                }
            }
            div class="mt-6 border-t border-border pt-5" {
                h3 class="font-bold" { (copy.variant_title) }
                p class="mt-1 text-sm text-muted" { (copy.variant_description) }
                @if passport.variants.is_empty() {
                    p class="mt-3 rounded-xl border border-border bg-surface px-3 py-3 text-sm text-muted" { (copy.no_variants) }
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
