//! `boundPlan` of app/api/db/query/route.ts: the shape and size limits a
//! browser plan must keep. Like the TypeScript it fills in the default row
//! limits (500 rows, 50 per embed) on the way, so it returns the plan with
//! them.
//!
//! The TypeScript walks the embeds with a stack; this walks them depth
//! first. Every check is a count, a sum or a test of one node, so both
//! refuse the same plans.

use super::js::{as_str, integer};
use crate::routes::request::{Json, property};

const MAX_ROWS: f64 = 1000.0;
const DEFAULT_ROWS: f64 = 500.0;
const MAX_EMBED_ROWS: f64 = 100.0;
const DEFAULT_EMBED_ROWS: f64 = 50.0;
const MAX_DEPTH: usize = 2;
const MAX_FIELDS: usize = 50;
const MAX_NODES: usize = 100;
const MAX_ROW_BUDGET: f64 = 100_000.0;
const MAX_FILTERS: usize = 50;
const MAX_OR_GROUPS: usize = 20;
const MAX_ORDERS: usize = 20;
const MAX_GROUP_FILTERS: usize = 50;
/// The protocol's parameter count is 16 bits; sqlx and node-pg fail above it.
const MAX_PARAMETERS: usize = 65_535;

/// The plan with its default limits, or `None` where `boundPlan` is false.
/// `plan` is the object of the request body's `plan`, whose `op` is known.
pub fn bound_plan(plan: &Json) -> Option<Json> {
    let mut plan = plan.clone();
    let Json::Object(entries) = &mut plan else {
        return None;
    };
    if !["fields", "filters", "orGroups", "orders"]
        .iter()
        .all(|key| matches!(property(entries, key), Some(Json::Array(_))))
    {
        return None;
    }
    let reads_rows = matches!(as_str(property(entries, "op")), Some("select" | "rpc"));
    let mut row_budget = DEFAULT_ROWS;
    if reads_rows {
        row_budget = default_limit(entries, DEFAULT_ROWS, MAX_ROWS)?;
    }
    let mut budget = Budget {
        nodes: 0,
        rows: row_budget,
    };
    let Some(Json::Array(fields)) = property_mut(entries, "fields") else {
        return None;
    };
    if !fields_ok(fields, 0, row_budget, &mut budget) {
        return None;
    }
    (filters_ok(entries) && write_parameters(entries) <= MAX_PARAMETERS).then_some(plan)
}

/// An insert or upsert binds one parameter per record and column of the
/// first record (`write_rows` and `insert_sql` in write.rs). Counted here,
/// before the compiler builds them: cheap empty records multiply a wide one.
fn write_parameters(entries: &[(String, Json)]) -> usize {
    if !matches!(as_str(property(entries, "op")), Some("insert" | "upsert")) {
        return 0;
    }
    let records: Vec<&Vec<(String, Json)>> = match property(entries, "values") {
        Some(Json::Array(rows)) => rows
            .iter()
            .filter_map(|row| match row {
                Json::Object(record) => Some(record),
                _ => None,
            })
            .collect(),
        Some(Json::Object(record)) => vec![record],
        _ => Vec::new(),
    };
    records.len() * records.first().map_or(0, |record| record.len())
}

struct Budget {
    nodes: usize,
    rows: f64,
}

/// `if (x.limit == null) x.limit = default;` then the integer range check.
fn default_limit(entries: &mut Vec<(String, Json)>, default: f64, max: f64) -> Option<f64> {
    match property_mut(entries, "limit") {
        Some(limit @ Json::Null) => *limit = Json::Number(default),
        Some(_) => {}
        None => entries.push(("limit".to_owned(), Json::Number(default))),
    }
    integer(property(entries, "limit")).filter(|limit| (0.0..=max).contains(limit))
}

fn fields_ok(fields: &mut [Json], depth: usize, parents: f64, budget: &mut Budget) -> bool {
    if depth > MAX_DEPTH || fields.len() > MAX_FIELDS {
        return false;
    }
    for field in fields.iter_mut() {
        budget.nodes += 1;
        // `!field || typeof field !== "object"`: arrays are objects too.
        if !matches!(field, Json::Object(_) | Json::Array(_)) || budget.nodes > MAX_NODES {
            return false;
        }
        let Json::Object(entries) = field else {
            continue;
        };
        if as_str(property(entries, "kind")) != Some("embed") {
            continue;
        }
        let Some(Json::Object(embed)) = property_mut(entries, "embed") else {
            return false;
        };
        let Some(limit) = embed_ok(embed) else {
            return false;
        };
        let rows = parents * limit;
        budget.rows += rows;
        if budget.rows > MAX_ROW_BUDGET {
            return false;
        }
        let Some(Json::Array(children)) = property_mut(embed, "fields") else {
            return false;
        };
        if !fields_ok(children, depth + 1, rows, budget) {
            return false;
        }
    }
    true
}

/// The checks of one embed; its limit when they pass.
fn embed_ok(embed: &mut Vec<(String, Json)>) -> Option<f64> {
    let arrays = ["fields", "filters", "orGroups", "orders"]
        .iter()
        .all(|key| matches!(property(embed, key), Some(Json::Array(_))));
    if !arrays || !filters_ok(embed) {
        return None;
    }
    default_limit(embed, DEFAULT_EMBED_ROWS, MAX_EMBED_ROWS)
}

/// The filter, `or` group and order counts, for the plan or an embed.
fn filters_ok(entries: &[(String, Json)]) -> bool {
    let len = |key| match property(entries, key) {
        Some(Json::Array(items)) => items.len(),
        _ => usize::MAX,
    };
    let groups_ok = match property(entries, "orGroups") {
        Some(Json::Array(groups)) => groups
            .iter()
            .all(|group| matches!(group, Json::Array(items) if items.len() <= MAX_GROUP_FILTERS)),
        _ => false,
    };
    len("filters") <= MAX_FILTERS
        && len("orGroups") <= MAX_OR_GROUPS
        && len("orders") <= MAX_ORDERS
        && groups_ok
}

fn property_mut<'a>(entries: &'a mut [(String, Json)], key: &str) -> Option<&'a mut Json> {
    entries
        .iter_mut()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bound(text: &str) -> Option<Json> {
        bound_plan(&Json::parse(text).expect("json"))
    }

    fn select(fields: &str, extra: &str) -> String {
        format!(
            r#"{{"op":"select","table":"memes","fields":{fields},"filters":[],"orGroups":[],"orders":[]{extra}}}"#
        )
    }

    fn embed(fields: &str, limit: &str) -> String {
        format!(
            r#"{{"kind":"embed","embed":{{"alias":"e","table":"t","fields":{fields},"filters":[],"orGroups":[],"orders":[]{limit}}}}}"#
        )
    }

    #[test]
    fn default_limits_are_filled_in() {
        let plan = bound(&select(
            &format!("[{}]", embed("[]", "")),
            r#","limit":null"#,
        ))
        .unwrap();
        let Json::Object(entries) = &plan else {
            panic!()
        };
        assert_eq!(property(entries, "limit"), Some(&Json::Number(500.0)));
        let text = crate::routes::js_json::stringify_parsed(&plan);
        assert!(text.contains(r#""limit":50}"#), "{text}");
        // Writes keep whatever limit they had.
        let write = r#"{"op":"delete","table":"t","fields":[],"filters":[],"orGroups":[],"orders":[],"limit":"x"}"#;
        assert!(bound(write).is_some());
    }

    #[test]
    fn the_limits_of_the_route_refuse_what_it_refuses() {
        assert!(bound(&select("[]", r#","limit":1000"#)).is_some());
        assert!(bound(&select("[]", r#","limit":1001"#)).is_none());
        assert!(bound(&select("[]", r#","limit":-1"#)).is_none());
        assert!(bound(&select("[]", r#","limit":1.5"#)).is_none());
        assert!(bound(&select("[]", r#","limit":"5""#)).is_none());
        assert!(bound(&select("[1]", "")).is_none());
        assert!(bound(&select("[null]", "")).is_none());
        assert!(bound(&select("[[]]", "")).is_some());
        let two = embed(
            &format!("[{}]", embed("[]", r#","limit":1"#)),
            r#","limit":1"#,
        );
        assert!(bound(&select(&format!("[{two}]"), "")).is_some());
        let three = embed(&format!("[{two}]"), r#","limit":1"#);
        assert!(bound(&select(&format!("[{three}]"), "")).is_none());
        let many = vec![r#"{"kind":"star"}"#; 51].join(",");
        assert!(bound(&select(&format!("[{many}]"), "")).is_none());
        // The budget counts the plan's rows and each embed's: 900 + 90,000
        // fits in 100,000, a second such embed does not.
        let wide = embed("[]", r#","limit":100"#);
        assert!(bound(&select(&format!("[{wide}]"), r#","limit":900"#)).is_some());
        assert!(bound(&select(&format!("[{wide},{wide}]"), r#","limit":900"#)).is_none());
        assert!(
            bound(&select(
                &format!("[{}]", embed("[]", r#","limit":101"#)),
                ""
            ))
            .is_none()
        );
    }

    /// R9 review N1: an insert binds one parameter per record and column of
    /// the first record, so 3-byte `{}` records multiplied a wide first
    /// record into millions of parameters before anything refused them.
    #[test]
    fn writes_of_more_than_65535_parameters_are_refused() {
        let wide: Vec<String> = (0..1000).map(|n| format!(r#""c{n}":0"#)).collect();
        let write = |op: &str, records: usize, extra: &str| {
            let rest = vec!["{}"; records - 1].join(",");
            format!(
                r#"{{"op":"{op}","table":"memes","fields":[],"filters":[],"orGroups":[],"orders":[],"values":[{{{}}},{rest}{extra}]}}"#,
                wide.join(",")
            )
        };
        assert!(bound(&write("insert", 4001, "")).is_none());
        assert!(bound(&write("upsert", 66, "")).is_none());
        // 65 x 1,000 = 65,000 fits; rows that are not objects are not records.
        assert!(bound(&write("insert", 65, r#",1,null,[{}]"#)).is_some());
        assert!(bound(&write("upsert", 65, "")).is_some());
        // Other writes bind no record values.
        assert!(bound(&write("delete", 4001, "")).is_some());
    }
}
