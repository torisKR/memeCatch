//! `mutationSql` and `rpcSql` of lib/db/execute.ts, in the TypeScript's
//! order of work (see compile.rs).

use std::collections::HashMap;

use super::compile::{
    Compiler, Meta, Sql, attach_dotted_filters, bind_value, cast_for, items_of, or_empty,
};
use super::js::{
    PlanError, Result, as_str, entries, get, is_ident_text, quote_ident, quote_ident_text,
    string_method_target, trim, truthy,
};
use crate::routes::request::Json;

/// A function `loadFunctions` found: whether it returns a set, and its
/// argument names.
///
/// The TypeScript also reads the argument types, but node-pg hands them over
/// as the text of a `name[]`, so `types[index]` is one character of
/// `"{uuid,…}"` and never a type name. No argument gets a cast, an array is
/// sent as `text[]`, and an object as its JSON text (docs/axum-migration/
/// PLAN.md, section 10, behaviour 1). Leaving the types out here gives
/// exactly that.
#[derive(Debug, Clone)]
pub struct PgFunction {
    pub proretset: bool,
    pub names: Option<Vec<String>>,
}

/// `mutationSql(plan, meta)` for insert, upsert, update and delete.
pub fn mutation_sql(meta: &Meta, plan: &Json) -> Result<Sql> {
    let mut compiler = Compiler::new(meta);
    let (table, types) = compiler.table_columns(Some(or_empty(get(Some(plan), "table")?)))?;
    let returning = if truthy(get(Some(plan), "returning")?) {
        " RETURNING *"
    } else {
        ""
    };
    let op = as_str(get(Some(plan), "op")?);
    if matches!(op, Some("insert" | "upsert")) {
        let (columns, inserted) = insert_sql(&mut compiler, plan, table, types)?;
        let sql = if op == Some("insert") {
            format!("{inserted}{returning}")
        } else {
            let conflict = on_conflict(meta, plan, table, &columns)?;
            format!("{inserted} {conflict}{returning}")
        };
        return Ok(Sql {
            sql,
            params: compiler.params,
        });
    }
    compiler.reset_aliases();
    let alias = compiler.next_alias();
    let filters = items_of(plan, "filters");
    let condition = compiler.where_sql(filters, items_of(plan, "orGroups"), &alias, types)?;
    let quoted = quote_ident_text(table)?;
    let sql = if op == Some("delete") {
        format!("DELETE FROM public.{quoted} {alias} WHERE {condition}{returning}")
    } else {
        let assignments = assignments(&mut compiler, plan, types)?;
        format!("UPDATE public.{quoted} {alias} SET {assignments} WHERE {condition}{returning}")
    };
    Ok(Sql {
        sql,
        params: compiler.params,
    })
}

/// The `INSERT INTO … VALUES …` of an insert or upsert, and its columns.
fn insert_sql(
    compiler: &mut Compiler,
    plan: &Json,
    table: &str,
    types: &HashMap<String, String>,
) -> Result<(Vec<String>, String)> {
    let (columns, records) = write_rows(plan)?;
    let quoted: Vec<String> = columns
        .iter()
        .map(|column| quote_ident_text(column))
        .collect::<Result<_>>()?;
    let mut rows = Vec::new();
    for record in &records {
        let record: HashMap<&str, &Json> = record
            .iter()
            .map(|(name, value)| (name.as_str(), value))
            .collect();
        let mut slots = Vec::new();
        for column in &columns {
            let udt = types.get(column).map(String::as_str);
            // `record[column] ?? null`.
            let value = Some(record.get(column.as_str()).copied().unwrap_or(&NULL));
            compiler.params.push(bind_value(value, udt));
            slots.push(format!(
                "${}{}",
                compiler.params.len(),
                cast_for(udt, value)
            ));
        }
        rows.push(format!("({})", slots.join(", ")));
    }
    let inserted = format!(
        "INSERT INTO public.{} ({}) VALUES {}",
        quote_ident_text(table)?,
        quoted.join(", "),
        rows.join(", ")
    );
    Ok((columns, inserted))
}

/// The `SET` list of an update: `values` must be an object of identifiers.
fn assignments(
    compiler: &mut Compiler,
    plan: &Json,
    types: &HashMap<String, String>,
) -> Result<String> {
    let Some(Json::Object(values)) = get(Some(plan), "values")? else {
        return Err(PlanError::InvalidIdentifier);
    };
    if values.is_empty() || values.iter().any(|(column, _)| !is_ident_text(column)) {
        return Err(PlanError::InvalidIdentifier);
    }
    let mut assignments = Vec::new();
    for (column, value) in values {
        let udt = types.get(column).map(String::as_str);
        compiler.params.push(bind_value(Some(value), udt));
        let index = compiler.params.len();
        let quoted = quote_ident_text(column)?;
        assignments.push(format!("{quoted} = ${index}{}", cast_for(udt, Some(value))));
    }
    Ok(assignments.join(", "))
}

static NULL: Json = Json::Null;

type Record = Vec<(String, Json)>;

/// `writeRows` and `columnList`: the object rows of `values`, and the
/// columns of the first.
fn write_rows(plan: &Json) -> Result<(Vec<String>, Vec<Record>)> {
    let values = get(Some(plan), "values")?;
    let raw: Vec<&Json> = match values {
        Some(Json::Array(rows)) => rows.iter().collect(),
        Some(other) => vec![other],
        None => Vec::new(),
    };
    let records: Vec<Record> = raw
        .into_iter()
        .filter_map(|row| match row {
            Json::Object(entries) => Some(entries.clone()),
            _ => None,
        })
        .collect();
    let first = records.first().ok_or(PlanError::InvalidIdentifier)?;
    let columns: Vec<String> = first.iter().map(|(key, _)| key.clone()).collect();
    if columns.is_empty() || columns.iter().any(|column| !is_ident_text(column)) {
        return Err(PlanError::InvalidIdentifier);
    }
    Ok((columns, records))
}

/// The `ON CONFLICT` clause of an upsert.
fn on_conflict(meta: &Meta, plan: &Json, table: &str, columns: &[String]) -> Result<String> {
    let requested = get(Some(plan), "onConflict")?;
    let named: Vec<String> = if truthy(requested) {
        string_method_target(requested)?
            .split(',')
            .map(str::to_owned)
            .collect()
    } else {
        meta.primary_keys.get(table).cloned().unwrap_or_default()
    };
    let conflict: Vec<String> = named
        .iter()
        .map(|column| trim(column).to_owned())
        .filter(|column| !column.is_empty())
        .collect();
    if conflict.is_empty() || conflict.iter().any(|column| !is_ident_text(column)) {
        return Err(PlanError::InvalidIdentifier);
    }
    let action = if truthy(get(Some(plan), "ignoreDuplicates")?) {
        "DO NOTHING".to_owned()
    } else {
        let updates: Vec<String> = columns
            .iter()
            .filter(|column| !conflict.contains(column))
            .map(|column| {
                let quoted = quote_ident_text(column)?;
                Ok(format!("{quoted} = EXCLUDED.{quoted}"))
            })
            .collect::<Result<_>>()?;
        if updates.is_empty() {
            let first = quote_ident_text(&conflict[0])?;
            format!(
                "DO UPDATE SET {first} = public.{}.{first}",
                quote_ident_text(table)?
            )
        } else {
            format!("DO UPDATE SET {}", updates.join(", "))
        }
    };
    let quoted: Vec<String> = conflict
        .iter()
        .map(|column| quote_ident_text(column))
        .collect::<Result<_>>()?;
    Ok(format!("ON CONFLICT ({}) {action}", quoted.join(", ")))
}

/// The overload `executePlanWithDb` calls: the first whose argument names
/// cover the plan's argument keys (or that has none), else the first.
pub fn choose_function<'a>(plan: &Json, matches: &'a [PgFunction]) -> Option<&'a PgFunction> {
    let args = get(Some(plan), "args").ok().flatten();
    let keys: Vec<String> = entries(args).into_iter().map(|(key, _)| key).collect();
    matches
        .iter()
        .find(|function| {
            let names = function.names.as_deref().unwrap_or(&[]);
            keys.iter()
                .all(|key| names.contains(key) || names.is_empty())
        })
        .or_else(|| matches.first())
}

/// `rpcSql(plan, fn, meta)`. The plan's dotted filters are on their embeds.
pub fn rpc_sql(meta: &Meta, plan: &Json, function: &PgFunction) -> Result<Sql> {
    let mut compiler = Compiler::new(meta);
    let name = or_empty(get(Some(plan), "fn")?);
    let args = get(Some(plan), "args")?;
    let mut pairs = Vec::new();
    for (key, value) in entries(args) {
        if !is_ident_text(&key) {
            return Err(PlanError::InvalidIdentifier);
        }
        compiler.params.push(bind_value(value, None));
        pairs.push(format!(
            "\"{key}\" => ${}{}",
            compiler.params.len(),
            cast_for(None, value)
        ));
    }
    let call = format!("public.{}({})", quote_ident(Some(name))?, pairs.join(", "));
    let search = matches!(as_str(Some(name)), Some("search_memes" | "search_ai_memes"));
    if function.proretset && search {
        return search_sql(compiler, plan, &call);
    }
    let sql = if function.proretset {
        format!(
            "SELECT * FROM {call}{}",
            compiler.limit_sql(get(Some(plan), "limit")?, Some(&NULL))?
        )
    } else {
        format!("SELECT {call} AS result")
    };
    Ok(Sql {
        sql,
        params: compiler.params,
    })
}

/// The two search functions return `SETOF memes`: the plan's projection,
/// embeds, filters and range apply as on the table.
fn search_sql(mut compiler: Compiler, plan: &Json, call: &str) -> Result<Sql> {
    let plan = attach_dotted_filters(plan)?;
    let (table, columns) = compiler.table_columns(Some(&Json::String("memes".to_owned())))?;
    compiler.reset_aliases();
    let alias = compiler.next_alias();
    let fields = items_of(&plan, "fields");
    let projected = compiler.render_field_list(fields, table, &alias)?;
    let filters = compiler.where_sql(
        items_of(&plan, "filters"),
        items_of(&plan, "orGroups"),
        &alias,
        columns,
    )?;
    let exists = compiler.inner_exists(fields, table, &alias)?.join(" AND ");
    let condition = if exists.is_empty() {
        filters
    } else {
        format!("{filters} AND {exists}")
    };
    let order = compiler.order_sql(items_of(&plan, "orders"), &alias)?;
    let limit = compiler.limit_sql(get(Some(&plan), "limit")?, get(Some(&plan), "offset")?)?;
    let sql = format!("SELECT {projected} FROM {call} {alias} WHERE {condition}{order}{limit}");
    Ok(Sql {
        sql,
        params: compiler.params,
    })
}
