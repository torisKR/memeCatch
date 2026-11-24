//! `loadMeta` and `loadFunctions` of lib/db/execute.ts: the schema
//! metadata the compiler resolves tables, columns and relations with, and the
//! overloads of a function.

use std::sync::{Arc, RwLock};

use super::compile::{ForeignKey, Meta};
use super::js::{PlanError, Value, is_ident};
use super::run::{self, Mode, Rows};
use super::write::PgFunction;
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::request::{Json, property};

const COLUMNS: &str = "SELECT c.relname::text, a.attname::text, t.typname::text
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'p')";

const PRIMARY_KEYS: &str = "SELECT rel.relname::text, att.attname::text
       FROM pg_index idx
       JOIN pg_class rel ON rel.oid = idx.indrelid
       JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
       JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (idx.indkey)
      WHERE nsp.nspname = 'public' AND idx.indisprimary
      ORDER BY rel.relname, array_position(idx.indkey, att.attnum)";

const FOREIGN_KEYS: &str = "SELECT con.conname::text,
            src.relname::text,
            dst.relname::text,
            (SELECT array_agg(a.attname ORDER BY cols.ord)
               FROM unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = cols.attnum)::text[],
            (SELECT array_agg(a.attname ORDER BY cols.ord)
               FROM unnest(con.confkey) WITH ORDINALITY AS cols(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = cols.attnum)::text[]
       FROM pg_constraint con
       JOIN pg_class src ON src.oid = con.conrelid
       JOIN pg_class dst ON dst.oid = con.confrelid
       JOIN pg_namespace nsp ON nsp.oid = src.relnamespace
      WHERE con.contype = 'f' AND nsp.nspname = 'public'";

/// The statement of `loadFunctions`, without the argument types it reads
/// but cannot use (see [`PgFunction`]). `$1` is untyped, as node-pg sends
/// it, so Postgres reads it as a `name`.
const FUNCTIONS: &str = "SELECT p.proretset,
                  p.proargnames AS names
             FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = $1";

/// The metadata, read once per process as the TypeScript keeps it in
/// `globalThis.__memecatchMeta` until the process ends.
#[derive(Default)]
pub struct MetaCache(RwLock<Option<Arc<Meta>>>);

impl MetaCache {
    /// `loadMeta(identity, …)`: read as the caller, the first time.
    // ponytail: concurrent first requests each read the catalog (the
    // TypeScript shares one promise); only the start of the process pays.
    pub async fn get(
        &self,
        state: &AppState,
        identity: &DbIdentity,
    ) -> Result<Arc<Meta>, PlanError> {
        if let Some(meta) = self
            .0
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
        {
            return Ok(meta);
        }
        let meta = Arc::new(load(state, identity).await?);
        *self
            .0
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(meta.clone());
        Ok(meta)
    }
}

type ColumnRow = (String, String, String);
type KeyRow = (String, String);
type ForeignKeyRow = (
    String,
    String,
    String,
    Option<Vec<String>>,
    Option<Vec<String>>,
);

async fn load(state: &AppState, identity: &DbIdentity) -> Result<Meta, PlanError> {
    let (columns, keys, foreign_keys) = state
        .db
        .with_identity(identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let columns: Vec<ColumnRow> = sqlx::query_as(COLUMNS).fetch_all(&mut *tx).await?;
                let keys: Vec<KeyRow> = sqlx::query_as(PRIMARY_KEYS).fetch_all(&mut *tx).await?;
                let foreign_keys: Vec<ForeignKeyRow> =
                    sqlx::query_as(FOREIGN_KEYS).fetch_all(&mut *tx).await?;
                Ok::<_, sqlx::Error>((columns, keys, foreign_keys))
            })
        })
        .await
        .map_err(|error| run::database_error(&error))?;
    let mut meta = Meta::default();
    for (table, column, udt) in columns {
        meta.columns.entry(table).or_default().insert(column, udt);
    }
    for (table, column) in keys {
        meta.primary_keys.entry(table).or_default().push(column);
    }
    meta.foreign_keys = foreign_keys
        .into_iter()
        .map(
            |(name, src_table, dst_table, src_cols, dst_cols)| ForeignKey {
                name,
                src_table,
                src_cols: src_cols.unwrap_or_default(),
                dst_table,
                dst_cols: dst_cols.unwrap_or_default(),
            },
        )
        .collect();
    Ok(meta)
}

/// `loadFunctions(plan.fn ?? "", db)`: on the pool with no identity (the
/// login role), the name sent as node-pg would send it.
pub async fn functions(state: &AppState, name: Value<'_>) -> Result<Vec<PgFunction>, PlanError> {
    if !is_ident(name) {
        return Err(PlanError::InvalidIdentifier);
    }
    let name = name.cloned().unwrap_or(Json::Null);
    let rows = run::run(
        state,
        &DbIdentity::better_auth(),
        FUNCTIONS,
        &[name],
        Mode::Json,
    )
    .await?;
    let Rows::Json(rows) = rows else {
        return Ok(Vec::new());
    };
    Ok(rows.iter().filter_map(|row| function_of(row)).collect())
}

fn function_of(row: &str) -> Option<PgFunction> {
    let Json::Object(entries) = Json::parse(row)? else {
        return None;
    };
    let proretset = matches!(property(&entries, "proretset"), Some(Json::Bool(true)));
    let names = match property(&entries, "names") {
        Some(Json::Array(items)) => Some(
            items
                .iter()
                .map(|item| match item {
                    Json::String(text) => text.clone(),
                    _ => String::new(),
                })
                .collect(),
        ),
        _ => None,
    };
    Some(PgFunction { proretset, names })
}
