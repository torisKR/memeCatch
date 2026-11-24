//! The statements of every plan the browser sends, against the text Next
//! sent for them (`tests/fixtures/db_query_sql.json`, read from the Postgres
//! log by `parity/db-query.mjs --write-sql`, with the metadata of the tables
//! those plans name). No database: a change to the compiler that changes
//! the text of any app plan fails here.

use serde_json::Value;

use super::bound::bound_plan;
use super::compile::{ForeignKey, Meta, attach_dotted_filters, select_sql};
use super::js::{as_str, get};
use super::run::as_json_rows;
use super::write::{PgFunction, mutation_sql, rpc_sql};
use crate::routes::request::{Json, property};

fn expected() -> Value {
    serde_json::from_str(include_str!("../../../tests/fixtures/db_query_sql.json"))
        .expect("fixture")
}

/// The plans with their keys in order (`serde_json::Value` sorts them, and
/// the order of an RPC's arguments is the order of its parameters).
fn plans() -> Vec<(String, Json)> {
    let text = include_str!("../../../tests/fixtures/db_query_plans.json");
    let Some(Json::Array(items)) = Json::parse(text) else {
        panic!("plans")
    };
    items
        .into_iter()
        .map(|item| {
            let entries = item.as_object().expect("a case");
            let id = property(entries, "id")
                .and_then(Json::as_str)
                .expect("id")
                .to_owned();
            (id, property(entries, "plan").expect("plan").clone())
        })
        .collect()
}

fn strings(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

fn meta(value: &Value) -> Meta {
    let mut meta = Meta::default();
    for (table, columns) in value["columns"].as_object().expect("columns") {
        let columns = columns.as_object().expect("a table's columns");
        let entries = columns
            .iter()
            .map(|(name, udt)| (name.clone(), udt.as_str().expect("udt").to_owned()));
        meta.columns.insert(table.clone(), entries.collect());
    }
    meta.foreign_keys = value["foreignKeys"]
        .as_array()
        .expect("foreign keys")
        .iter()
        .map(|fk| ForeignKey {
            name: fk["name"].as_str().expect("name").to_owned(),
            src_table: fk["srcTable"].as_str().expect("src").to_owned(),
            src_cols: strings(&fk["srcCols"]),
            dst_table: fk["dstTable"].as_str().expect("dst").to_owned(),
            dst_cols: strings(&fk["dstCols"]),
        })
        .collect();
    meta
}

/// The statements `executePlan` runs for a bounded plan, as the log shows
/// them.
fn statements(meta: &Meta, functions: &Value, plan: &Json) -> Vec<String> {
    let plan = attach_dotted_filters(plan).expect("dotted filters");
    match as_str(get(Some(&plan), "op").expect("op")) {
        Some("rpc") => {
            let name = as_str(get(Some(&plan), "fn").expect("fn")).expect("a name");
            let function = &functions[name];
            let function = PgFunction {
                proretset: function["proretset"].as_bool().expect("proretset"),
                names: Some(strings(&function["names"])),
            };
            vec![as_json_rows(
                &rpc_sql(meta, &plan, &function).expect("rpc").sql,
            )]
        }
        Some("select") => {
            let mut sql = vec![as_json_rows(
                &select_sql(meta, &plan, false).expect("select").sql,
            )];
            if as_str(get(Some(&plan), "count").expect("count")) == Some("exact") {
                sql.push(select_sql(meta, &plan, true).expect("count").sql);
            }
            sql
        }
        _ => vec![mutation_sql(meta, &plan).expect("write").sql],
    }
}

#[test]
fn every_app_plan_compiles_to_the_statement_next_sent() {
    let expected = expected();
    let meta = meta(&expected["meta"]);
    let plans = plans();
    let cases = expected["cases"].as_array().expect("cases");
    assert_eq!(plans.len(), cases.len());
    for ((id, plan), case) in plans.iter().zip(cases) {
        assert_eq!(case["id"], id.as_str());
        let plan = bound_plan(plan).expect("a plan the route accepts");
        let compiled = statements(&meta, &expected["meta"]["functions"], &plan);
        let sent = strings(&case["sql"]);
        // A value Postgres cannot parse stops the statement before it runs,
        // and Postgres logs only what runs (one case: an unknown reaction).
        if sent.is_empty() {
            assert_eq!(id, "reaction-toggle-bad-enum");
            continue;
        }
        assert_eq!(compiled, sent, "{id}");
    }
}

/// R9 review H2: a record's values were looked up by a scan of the record
/// per column, so one insert of 1 MiB of distinct columns compiled in
/// quadratic time. `row[column]` in the TypeScript is a hash lookup.
#[test]
fn an_insert_of_many_columns_compiles_in_linear_time() {
    let meta = meta(&expected()["meta"]);
    let columns: Vec<String> = (0..80_000).map(|n| format!(r#""c{n:x}":0"#)).collect();
    let text = format!(
        r#"{{"op":"insert","table":"memes","fields":[],"filters":[],"orGroups":[],"orders":[],"values":{{{}}}}}"#,
        columns.join(",")
    );
    let plan = Json::parse(&text).expect("plan");
    let started = std::time::Instant::now();
    let sql = mutation_sql(&meta, &plan).expect("insert");
    let elapsed = started.elapsed();
    assert_eq!(sql.params.len(), 80_000);
    assert!(elapsed < std::time::Duration::from_secs(1), "{elapsed:?}");
}
