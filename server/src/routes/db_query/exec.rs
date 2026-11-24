//! `executePlan` (`executePlanWithDb` on the main pool) and `shapeRows`:
//! a bounded plan in, a `QueryResult` out.

use super::compile::{Meta, Sql, attach_dotted_filters, or_empty, select_sql};
use super::js::{PlanError, as_str, get, stringify, truthy};
use super::meta::{self, MetaCache};
use super::run::{self, Mode, Rows};
use super::write::{choose_function, mutation_sql, rpc_sql};
use crate::AppState;
use crate::db::DbIdentity;
use crate::routes::request::{Json, property};

/// A `QueryResult`.
#[derive(Debug, PartialEq)]
pub enum Outcome {
    /// `{ data, error: null, count, status: 200, statusText: "OK" }`;
    /// `data` is JSON text.
    Rows {
        data: String,
        count: Option<i64>,
    },
    /// `{ data: null, error: null, count }` for `head`.
    Head {
        count: Option<i64>,
    },
    Failed(Failure),
}

/// `QueryResult.error`, the parts the route reads.
#[derive(Debug, PartialEq, Eq)]
pub struct Failure {
    pub message: String,
    pub code: Option<String>,
    pub status: u16,
}

impl Failure {
    /// `queryError(error)`.
    fn from_error(error: PlanError) -> Self {
        match error {
            PlanError::InvalidIdentifier => Self {
                message: "invalid identifier".to_owned(),
                code: Some("42602".to_owned()),
                status: 400,
            },
            PlanError::Thrown => Self {
                message: "query failed".to_owned(),
                code: None,
                status: 400,
            },
            PlanError::Database { code, message } => {
                let status = if code.as_deref() == Some("57014") {
                    408
                } else {
                    400
                };
                Self {
                    message,
                    code,
                    status,
                }
            }
        }
    }

    fn not_one_row() -> Self {
        Self {
            message: "JSON object requested, multiple (or no) rows returned".to_owned(),
            code: Some("PGRST116".to_owned()),
            status: 406,
        }
    }
}

/// `executePlan(plan, identity)`.
pub async fn execute_plan(
    state: &AppState,
    cache: &MetaCache,
    plan: &Json,
    identity: &DbIdentity,
) -> Outcome {
    match try_execute(state, cache, plan, identity).await {
        Ok(outcome) => outcome,
        Err(error) => Outcome::Failed(Failure::from_error(error)),
    }
}

async fn try_execute(
    state: &AppState,
    cache: &MetaCache,
    plan: &Json,
    identity: &DbIdentity,
) -> Result<Outcome, PlanError> {
    let meta = cache.get(state, identity).await?;
    let op = as_str(get(Some(plan), "op")?);
    let plan = attach_dotted_filters(plan)?;
    match op {
        Some("rpc") => execute_rpc(state, &meta, &plan, identity).await,
        Some("select") => execute_select(state, &meta, &plan, identity).await,
        _ => execute_write(state, &meta, &plan, identity).await,
    }
}

async fn execute_rpc(
    state: &AppState,
    meta: &Meta,
    plan: &Json,
    identity: &DbIdentity,
) -> Result<Outcome, PlanError> {
    let matches = meta::functions(state, Some(or_empty(get(Some(plan), "fn")?))).await?;
    let Some(function) = choose_function(plan, &matches) else {
        return Ok(Outcome::Failed(Failure {
            message: "function not found".to_owned(),
            code: Some("42883".to_owned()),
            status: 404,
        }));
    };
    let built = rpc_sql(meta, plan, function)?;
    let rows = json_rows(state, identity, &built).await?;
    Ok(shape_rows(plan, rows, None, !function.proretset))
}

async fn execute_select(
    state: &AppState,
    meta: &Meta,
    plan: &Json,
    identity: &DbIdentity,
) -> Result<Outcome, PlanError> {
    let data_sql = select_sql(meta, plan, false)?;
    let exact = as_str(get(Some(plan), "count")?) == Some("exact");
    let count_sql = if exact {
        Some(select_sql(meta, plan, true)?)
    } else {
        None
    };
    let rows = if truthy(get(Some(plan), "head")?) {
        Vec::new()
    } else {
        json_rows(state, identity, &data_sql).await?
    };
    let count = match count_sql {
        Some(sql) => match run::run(state, identity, &sql.sql, &sql.params, Mode::Count).await? {
            Rows::Count(count) => Some(count),
            _ => Some(0),
        },
        None => None,
    };
    Ok(shape_rows(plan, rows, count, false))
}

async fn execute_write(
    state: &AppState,
    meta: &Meta,
    plan: &Json,
    identity: &DbIdentity,
) -> Result<Outcome, PlanError> {
    let built = mutation_sql(meta, plan)?;
    // Without RETURNING there are no rows, and a WITH wrapper would be
    // rejected.
    let rows = if truthy(get(Some(plan), "returning")?) {
        json_rows(state, identity, &built).await?
    } else {
        run::run(state, identity, &built.sql, &built.params, Mode::Plain).await?;
        Vec::new()
    };
    Ok(shape_rows(plan, rows, None, false))
}

/// The rows of `sql`, each parsed as node-pg's JSON parser does.
async fn json_rows(
    state: &AppState,
    identity: &DbIdentity,
    sql: &Sql,
) -> Result<Vec<Json>, PlanError> {
    let Rows::Json(rows) = run::run(state, identity, &sql.sql, &sql.params, Mode::Json).await?
    else {
        return Ok(Vec::new());
    };
    rows.iter()
        .map(|row| {
            // `JSON.parse` takes numbers beyond a double and nesting past 128
            // levels, which serde refuses; see PLAN.md, R9 differences.
            Json::parse(row).ok_or_else(|| PlanError::Database {
                code: None,
                message: "row is not JSON this server can read".to_owned(),
            })
        })
        .collect()
}

/// `shapeRows(plan, rows, count, scalar)`.
fn shape_rows(plan: &Json, rows: Vec<Json>, count: Option<i64>, scalar: bool) -> Outcome {
    let flag = |key| truthy(get(Some(plan), key).ok().flatten());
    if flag("head") {
        return Outcome::Head { count };
    }
    let data = if scalar {
        // `rows[0]?.result ?? null`.
        match rows
            .first()
            .and_then(|row| row.as_object())
            .and_then(|row| property(row, "result"))
        {
            None | Some(Json::Null) => "null".to_owned(),
            Some(result) => stringify(result),
        }
    } else if flag("single") {
        if rows.len() != 1 {
            return Outcome::Failed(Failure::not_one_row());
        }
        stringify(&rows[0])
    } else if flag("maybeSingle") {
        if rows.len() > 1 {
            return Outcome::Failed(Failure::not_one_row());
        }
        rows.first()
            .map(stringify)
            .unwrap_or_else(|| "null".to_owned())
    } else {
        stringify(&Json::Array(rows))
    };
    Outcome::Rows { data, count }
}
