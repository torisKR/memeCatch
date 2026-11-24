//! `sortDirectory` in lib/meme-directory.ts: 가나다순 by
//! `Intl.Collator("ko", { sensitivity: "base", numeric: true })`, then by
//! short id. Here the collator is ICU4X with the same locale and options;
//! `tests/directory_order.rs` holds it to the order the real TypeScript gives
//! 3,562 titles on the Node of the Next image (ICU 78.3).

use std::cmp::Ordering;
use std::sync::LazyLock;

use icu_collator::options::{CollatorOptions, Strength};
use icu_collator::preferences::CollationNumericOrdering;
use icu_collator::{Collator, CollatorBorrowed, CollatorPreferences};
use icu_locale_core::locale;

use crate::routes::public::js;

static KOREAN: LazyLock<CollatorBorrowed<'static>> = LazyLock::new(|| {
    let mut prefs = CollatorPreferences::from(&locale!("ko"));
    prefs.numeric_ordering = Some(CollationNumericOrdering::True);
    let mut options = CollatorOptions::default();
    // `sensitivity: "base"`.
    options.strength = Some(Strength::Primary);
    Collator::try_new(prefs, options).expect("the compiled collation data has Korean")
});

/// The comparison `sortDirectory` sorts with. The tie-break is
/// `a.short_id.localeCompare(b.short_id)`; short ids are lower-case letters
/// and digits (`gen_short_id()`), which every locale orders as their bytes.
pub fn compare(a_title: &str, a_short_id: &str, b_title: &str, b_short_id: &str) -> Ordering {
    KOREAN
        .compare(js::trim(a_title), js::trim(b_title))
        .then_with(|| a_short_id.cmp(b_short_id))
}

/// `row.title?.trim() || row.slug` in `loadMemeDirectory`.
pub fn listed_title<'a>(title: Option<&'a str>, slug: &'a str) -> &'a str {
    match title.map(js::trim) {
        Some(title) if !title.is_empty() => title,
        _ => slug,
    }
}
