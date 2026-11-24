//! The select half of lib/db/execute.ts: filters, ordering, limits,
//! embedded relations and `selectSql`. Each function is the TypeScript one of
//! the same name, and does its work in the same order, so the statement text,
//! the alias numbers (`r1`, `r2`, …) and the parameter numbers come out the
//! same, and an invalid plan fails at the same check.
//!
//! Only identifiers that pass `quote_ident` (the TypeScript's `IDENT`) reach
//! the SQL, always double-quoted; the tables and the relations between them
//! are the ones the schema metadata lists. Every value is a parameter.

use std::collections::HashMap;

use super::js::{
    PlanError, Result, Value, as_str, get, integer, is_ident, is_ident_text, quote_ident,
    quote_ident_text, string_method_target, stringify, truthy,
};
use crate::routes::request::Json;

/// `Meta`: the columns of every table and view in `public` with their type
/// names, the foreign keys between them, and the primary keys.
#[derive(Debug, Default)]
pub struct Meta {
    pub columns: HashMap<String, HashMap<String, String>>,
    pub foreign_keys: Vec<ForeignKey>,
    pub primary_keys: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct ForeignKey {
    pub name: String,
    pub src_table: String,
    pub src_cols: Vec<String>,
    pub dst_table: String,
    pub dst_cols: Vec<String>,
}

/// A statement and its parameters, each the value `bindValue` gave.
#[derive(Debug, PartialEq)]
pub struct Sql {
    pub sql: String,
    pub params: Vec<Json>,
}

static NULL: Json = Json::Null;

/// The state `selectSql` and friends share: the parameters pushed so far and
/// the alias counter (`aliasSeq`).
pub struct Compiler<'m> {
    pub meta: &'m Meta,
    pub params: Vec<Json>,
    alias_seq: u32,
}

impl<'m> Compiler<'m> {
    pub fn new(meta: &'m Meta) -> Self {
        Self {
            meta,
            params: Vec::new(),
            alias_seq: 0,
        }
    }

    pub fn reset_aliases(&mut self) {
        self.alias_seq = 0;
    }

    pub fn next_alias(&mut self) -> String {
        self.alias_seq += 1;
        format!("r{}", self.alias_seq)
    }

    fn push(&mut self, value: Json) -> usize {
        self.params.push(value);
        self.params.len()
    }

    /// `tableColumns(meta, table)`: the table's name and columns.
    pub fn table_columns(&self, table: Value) -> Result<(&'m str, &'m HashMap<String, String>)> {
        if !is_ident(table) {
            return Err(PlanError::InvalidIdentifier);
        }
        // `Map.get` does not coerce: only a string names a table.
        as_str(table)
            .and_then(|name| self.meta.columns.get_key_value(name))
            .map(|(name, columns)| (name.as_str(), columns))
            .ok_or(PlanError::InvalidIdentifier)
    }

    /// `compileFilter`.
    fn filter(
        &mut self,
        filter: &Json,
        alias: &str,
        columns: &HashMap<String, String>,
    ) -> Result<String> {
        let column = get(Some(filter), "column")?;
        if !is_ident(column) {
            return Err(PlanError::InvalidIdentifier);
        }
        let udt = as_str(column)
            .and_then(|name| columns.get(name))
            .map(String::as_str);
        let reference = format!("{alias}.{}", quote_ident(column)?);
        let value = get(Some(filter), "value")?;
        let negate = truthy(get(Some(filter), "negate")?);
        let op = as_str(get(Some(filter), "op")?);
        match op {
            Some("is") => Ok(match value {
                Some(Json::Null) if negate => format!("{reference} IS NOT NULL"),
                Some(Json::Null) => format!("{reference} IS NULL"),
                Some(Json::Bool(flag)) => {
                    let not = if negate { "NOT " } else { "" };
                    let flag = if *flag { "TRUE" } else { "FALSE" };
                    format!("{reference} IS {not}{flag}")
                }
                _ => self.compare(
                    &reference,
                    if negate { "<>" } else { "=" },
                    value,
                    udt,
                    false,
                ),
            }),
            Some("in") => Ok(self.in_filter(&reference, value, udt, negate)),
            Some("contains") => {
                let index = self.push(bind_value(value, udt));
                let expr = format!("{reference} @> ${index}{}", cast_for(udt, value));
                Ok(if negate {
                    format!("NOT ({expr})")
                } else {
                    expr
                })
            }
            Some(op @ ("eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike")) => {
                if matches!(value, Some(Json::Null)) && matches!(op, "eq" | "neq") {
                    let not = if op == "eq" { "" } else { " NOT" };
                    return Ok(format!("{reference} IS{not} NULL"));
                }
                Ok(self.compare(&reference, operator_sql(op), value, udt, negate))
            }
            // `throw new Error(\`invalid filter ${op}\`)`.
            _ => Err(PlanError::Thrown),
        }
    }

    fn in_filter(
        &mut self,
        reference: &str,
        value: Value,
        udt: Option<&str>,
        negate: bool,
    ) -> String {
        let items: Vec<Value> = match value {
            Some(Json::Array(items)) => items.iter().map(Some).collect(),
            other => vec![other],
        };
        if items.is_empty() {
            return (if negate { "TRUE" } else { "FALSE" }).to_owned();
        }
        let bound = Json::Array(items.iter().map(|item| bind_value(*item, udt)).collect());
        let index = self.push(bound);
        let expr = in_array_expr(reference, index, udt);
        if negate {
            format!("NOT ({expr})")
        } else {
            expr
        }
    }

    fn compare(
        &mut self,
        reference: &str,
        op: &str,
        value: Value,
        udt: Option<&str>,
        negate: bool,
    ) -> String {
        let index = self.push(bind_value(value, udt));
        let expr = format!("{reference} {op} ${index}{}", cast_for(udt, value));
        if negate {
            format!("NOT ({expr})")
        } else {
            expr
        }
    }

    /// `whereSql`.
    pub fn where_sql(
        &mut self,
        filters: &[Json],
        or_groups: &[Json],
        alias: &str,
        columns: &HashMap<String, String>,
    ) -> Result<String> {
        let mut parts = Vec::new();
        for filter in filters {
            parts.push(self.filter(filter, alias, columns)?);
        }
        for group in or_groups {
            let group = items(group);
            if group.is_empty() {
                continue;
            }
            let mut alternatives = Vec::new();
            for filter in group {
                alternatives.push(self.filter(filter, alias, columns)?);
            }
            parts.push(format!("({})", alternatives.join(" OR ")));
        }
        Ok(if parts.is_empty() {
            "TRUE".to_owned()
        } else {
            parts.join(" AND ")
        })
    }

    /// `orderSql`. Ordering takes no parameters.
    pub fn order_sql(&self, orders: &[Json], alias: &str) -> Result<String> {
        if orders.is_empty() {
            return Ok(String::new());
        }
        let mut parts = Vec::new();
        for order in orders {
            let column = get(Some(order), "column")?;
            if !is_ident(column) {
                return Err(PlanError::InvalidIdentifier);
            }
            let direction = if truthy(get(Some(order), "ascending")?) {
                "ASC"
            } else {
                "DESC"
            };
            let nulls = match get(Some(order), "nullsFirst")? {
                None => "",
                first if truthy(first) => " NULLS FIRST",
                _ => " NULLS LAST",
            };
            parts.push(format!(
                "{alias}.{} {direction}{nulls}",
                quote_ident(column)?
            ));
        }
        Ok(format!(" ORDER BY {}", parts.join(", ")))
    }

    /// `limitSql(limit, offset)`. `null` leaves either out; `undefined` does
    /// not (`!== null`), and then fails the integer check.
    pub fn limit_sql(&mut self, limit: Value, offset: Value) -> Result<String> {
        let mut sql = String::new();
        if !matches!(limit, Some(Json::Null)) {
            let limit = integer(limit)
                .filter(|limit| (0.0..=5000.0).contains(limit))
                .ok_or(PlanError::InvalidIdentifier)?;
            let index = self.push(Json::Number(limit));
            sql.push_str(&format!(" LIMIT ${index}::int"));
        }
        if !matches!(offset, Some(Json::Null)) {
            let offset = integer(offset)
                .filter(|offset| *offset >= 0.0)
                .ok_or(PlanError::InvalidIdentifier)?;
            let index = self.push(Json::Number(offset));
            sql.push_str(&format!(" OFFSET ${index}::int"));
        }
        Ok(sql)
    }

    /// `pickForeignKey(parent, embed, meta.foreignKeys)`.
    fn pick_foreign_key(&self, parent: &str, embed: &Json) -> Result<&'m ForeignKey> {
        let table = get(Some(embed), "table")?;
        let table_name = as_str(table);
        let candidates: Vec<&ForeignKey> = self
            .meta
            .foreign_keys
            .iter()
            .filter(|fk| {
                (fk.src_table == parent && Some(fk.dst_table.as_str()) == table_name)
                    || (Some(fk.src_table.as_str()) == table_name && fk.dst_table == parent)
            })
            .collect();
        let hint = get(Some(embed), "hint")?;
        let hinted: Vec<&ForeignKey> = if truthy(hint) {
            candidates
                .into_iter()
                .filter(|fk| Some(fk.name.as_str()) == as_str(hint))
                .collect()
        } else {
            candidates
        };
        if let [only] = hinted[..] {
            return Ok(only);
        }
        // `embed.table.endsWith(...)` throws on anything but a string.
        let table = string_method_target(table)?;
        let singular = if let Some(stem) = table.strip_suffix("ies") {
            format!("{stem}y")
        } else {
            table.strip_suffix('s').unwrap_or(table).to_owned()
        };
        let parent_singular = parent.strip_suffix('s').unwrap_or(parent);
        let (own, parents) = (format!("{singular}_id"), format!("{parent_singular}_id"));
        let preferred: Vec<&ForeignKey> = hinted
            .into_iter()
            .filter(|fk| {
                fk.src_cols
                    .iter()
                    .any(|column| *column == own || *column == parents)
            })
            .collect();
        match preferred[..] {
            [only] => Ok(only),
            _ => Err(PlanError::InvalidIdentifier),
        }
    }

    /// `renderEmbed`: the embed as a correlated subquery in the select list.
    fn render_embed(&mut self, parent: &str, parent_alias: &str, embed: &Json) -> Result<String> {
        let child = self.next_alias();
        let fk = self.pick_foreign_key(parent, embed)?;
        let (many_to_one, join) = join_sql(parent, parent_alias, &child, fk)?;
        let (table, columns) = self.table_columns(get(Some(embed), "table")?)?;
        let fields = items_of(embed, "fields");
        let nested = self.inner_exists(fields, table, &child)?;
        let filters = self.where_sql(
            items_of(embed, "filters"),
            items_of(embed, "orGroups"),
            &child,
            columns,
        )?;
        let condition = [vec![join, filters], nested].concat().join(" AND ");
        let projected = self.render_field_list(fields, table, &child)?;
        let order = self.order_sql(items_of(embed, "orders"), &child)?;
        let limit = self.limit_sql(get(Some(embed), "limit")?, Some(&NULL))?;
        let from = format!(
            "FROM public.{} {child} WHERE {condition}{order}{limit}",
            quote_ident_text(table)?
        );
        let alias = quote_ident(get(Some(embed), "alias")?)?;
        Ok(if many_to_one {
            format!("(SELECT row_to_json(e) FROM (SELECT {projected} {from}) e) AS {alias}")
        } else {
            format!(
                "(SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT {projected} {from}) e) AS {alias}"
            )
        })
    }

    /// `renderFieldList`.
    pub fn render_field_list(
        &mut self,
        fields: &[Json],
        table: &str,
        alias: &str,
    ) -> Result<String> {
        let scalars: Vec<&Json> = fields
            .iter()
            .filter(|field| kind(field) != Some("embed"))
            .collect();
        let mut columns = Vec::new();
        if scalars.is_empty() || scalars.iter().any(|field| kind(field) == Some("star")) {
            columns.push(format!("{alias}.*"));
        }
        for field in &scalars {
            if kind(field) == Some("column") {
                columns.push(format!(
                    "{alias}.{}",
                    quote_ident(get(Some(field), "name")?)?
                ));
            }
        }
        for field in fields {
            if let Some(embed) = embed_of(field) {
                columns.push(self.render_embed(table, alias, embed)?);
            }
        }
        Ok(columns.join(", "))
    }

    /// `innerExists`: an `EXISTS` for each `!inner` embed, nested ones inside.
    pub fn inner_exists(
        &mut self,
        fields: &[Json],
        table: &str,
        alias: &str,
    ) -> Result<Vec<String>> {
        let mut checks = Vec::new();
        for field in fields {
            let Some(embed) = embed_of(field) else {
                continue;
            };
            if !truthy(get(Some(embed), "inner")?) {
                continue;
            }
            let child = self.next_alias();
            let fk = self.pick_foreign_key(table, embed)?;
            let (_, join) = join_sql(table, alias, &child, fk)?;
            let (embed_table, columns) = self.table_columns(get(Some(embed), "table")?)?;
            let nested = self.inner_exists(items_of(embed, "fields"), embed_table, &child)?;
            let quoted = quote_ident_text(embed_table)?;
            let filters = self.where_sql(
                items_of(embed, "filters"),
                items_of(embed, "orGroups"),
                &child,
                columns,
            )?;
            let condition = [vec![join, filters], nested].concat().join(" AND ");
            checks.push(format!(
                "EXISTS (SELECT 1 FROM public.{quoted} {child} WHERE {condition})"
            ));
        }
        Ok(checks)
    }
}

/// `selectSql(plan, meta, counting)`, for a plan whose dotted filters are
/// already on their embeds.
pub fn select_sql(meta: &Meta, plan: &Json, counting: bool) -> Result<Sql> {
    let mut compiler = Compiler::new(meta);
    let (table, columns) = compiler.table_columns(Some(or_empty(get(Some(plan), "table")?)))?;
    compiler.reset_aliases();
    let alias = compiler.next_alias();
    let fields = items_of(plan, "fields");
    let projected = if counting {
        "count(*)::int AS count".to_owned()
    } else {
        compiler.render_field_list(fields, table, &alias)?
    };
    let filters = compiler.where_sql(
        items_of(plan, "filters"),
        items_of(plan, "orGroups"),
        &alias,
        columns,
    )?;
    let exists = compiler.inner_exists(fields, table, &alias)?.join(" AND ");
    let condition = if exists.is_empty() {
        filters
    } else {
        format!("{filters} AND {exists}")
    };
    let page = if counting {
        String::new()
    } else {
        let order = compiler.order_sql(items_of(plan, "orders"), &alias)?;
        let limit = compiler.limit_sql(get(Some(plan), "limit")?, get(Some(plan), "offset")?)?;
        format!("{order}{limit}")
    };
    let sql = format!(
        "SELECT {projected} FROM public.{} {alias} WHERE {condition}{page}",
        quote_ident_text(table)?
    );
    Ok(Sql {
        sql,
        params: compiler.params,
    })
}

static EMPTY: Json = Json::String(String::new());

/// `x ?? ""`.
pub fn or_empty(value: Value<'_>) -> &Json {
    match value {
        None | Some(Json::Null) => &EMPTY,
        Some(json) => json,
    }
}

/// `attachDottedFilters(plan)`: moves each `relation.column` filter onto
/// the embed it names. Returns the new plan.
pub fn attach_dotted_filters(plan: &Json) -> Result<Json> {
    let mut plan = plan.clone();
    let filters = items_of(&plan, "filters").to_vec();
    let mut keep = Vec::new();
    for filter in filters {
        let column = string_method_target(get(Some(&filter), "column")?)?;
        let mut path: Vec<&str> = column.split('.').collect();
        if path.len() == 1 {
            keep.push(filter);
            continue;
        }
        if path.iter().any(|part| !is_ident_text(part)) {
            return Err(PlanError::InvalidIdentifier);
        }
        let last = path.pop().expect("two parts or more").to_owned();
        let embed = direct_embed_path(&mut plan, &path).ok_or(PlanError::InvalidIdentifier)?;
        let moved = with_column(&filter, last);
        if let Some(Json::Array(embed_filters)) = entry_mut(embed, "filters") {
            embed_filters.push(moved);
        }
    }
    if let Some(slot) = entry_mut(&mut plan, "filters") {
        *slot = Json::Array(keep);
    }
    Ok(plan)
}

/// `findDirectEmbed` along `path`, from the plan's fields down.
fn direct_embed_path<'a>(plan: &'a mut Json, path: &[&str]) -> Option<&'a mut Json> {
    let mut node = plan;
    for relation in path {
        let Some(Json::Array(fields)) = entry_mut(node, "fields") else {
            return None;
        };
        let field = fields.iter_mut().find(|field| {
            embed_of(field).is_some_and(|embed| {
                let named = |key| as_str(get(Some(embed), key).ok().flatten()) == Some(*relation);
                named("alias") || named("table")
            })
        })?;
        node = entry_mut(field, "embed")?;
    }
    Some(node)
}

/// `{ ...filter, column }`.
fn with_column(filter: &Json, column: String) -> Json {
    let Json::Object(entries) = filter else {
        return filter.clone();
    };
    Json::Object(
        entries
            .iter()
            .map(|(key, value)| match key.as_str() {
                "column" => (key.clone(), Json::String(column.clone())),
                _ => (key.clone(), value.clone()),
            })
            .collect(),
    )
}

fn entry_mut<'a>(node: &'a mut Json, key: &str) -> Option<&'a mut Json> {
    let Json::Object(entries) = node else {
        return None;
    };
    entries
        .iter_mut()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value)
}

/// `bindValue(value, udt)`: what the TypeScript hands node-pg.
pub fn bind_value(value: Value, udt: Option<&str>) -> Json {
    match value {
        None | Some(Json::Null) => Json::Null,
        Some(json) if matches!(udt, Some("jsonb" | "json")) => Json::String(stringify(json)),
        Some(json @ Json::Object(_)) => Json::String(stringify(json)),
        Some(json) => json.clone(),
    }
}

/// `castFor(udt, value)`.
pub fn cast_for(udt: Option<&str>, value: Value) -> &'static str {
    if matches!(value, Some(Json::Array(_))) {
        return match udt {
            Some("jsonb" | "json") => "::jsonb",
            Some("_uuid" | "uuid") => "::uuid[]",
            Some("_int2" | "_int4" | "_int8" | "int2" | "int4" | "int8") => "::bigint[]",
            Some("_bool" | "bool") => "::boolean[]",
            Some("_float4" | "_float8" | "float4" | "float8") => "::double precision[]",
            Some("_numeric" | "numeric") => "::numeric[]",
            _ => "::text[]",
        };
    }
    match udt {
        Some("uuid") => "::uuid",
        Some("timestamptz" | "timestamp" | "date") => "::timestamptz",
        Some("jsonb" | "json") => "::jsonb",
        Some("bool") => "::boolean",
        Some("int2" | "int4" | "int8") => "::bigint",
        Some("numeric") => "::numeric",
        Some("float4" | "float8") => "::double precision",
        _ => "",
    }
}

const BUILTIN_UDT: [&str; 19] = [
    "bool",
    "bpchar",
    "bytea",
    "date",
    "float4",
    "float8",
    "int2",
    "int4",
    "int8",
    "json",
    "jsonb",
    "name",
    "numeric",
    "oid",
    "text",
    "timestamp",
    "timestamptz",
    "uuid",
    "varchar",
];

/// `inArrayExpr` (the values are always an array there).
fn in_array_expr(reference: &str, index: usize, udt: Option<&str>) -> String {
    match udt {
        Some(udt) if !udt.starts_with('_') && !BUILTIN_UDT.contains(&udt) => {
            format!("{reference}::text = ANY(${index}::text[])")
        }
        _ => {
            let cast = cast_for(udt, Some(&Json::Array(Vec::new())));
            format!("{reference} = ANY(${index}{cast})")
        }
    }
}

fn operator_sql(op: &str) -> &'static str {
    match op {
        "eq" => "=",
        "neq" => "<>",
        "gt" => ">",
        "gte" => ">=",
        "lt" => "<",
        "lte" => "<=",
        "like" => "LIKE",
        _ => "ILIKE",
    }
}

/// `joinSql`: the join condition, and whether the embed is the one side.
fn join_sql(
    parent: &str,
    parent_alias: &str,
    child: &str,
    fk: &ForeignKey,
) -> Result<(bool, String)> {
    let many_to_one = fk.src_table == parent;
    let mut parts = Vec::new();
    for (index, column) in fk.src_cols.iter().enumerate() {
        let other = fk.dst_cols.get(index).map(String::as_str).unwrap_or("");
        parts.push(if many_to_one {
            let dst = quote_ident_text(other)?;
            format!(
                "{child}.{dst} = {parent_alias}.{}",
                quote_ident_text(column)?
            )
        } else {
            let src = quote_ident_text(column)?;
            format!(
                "{child}.{src} = {parent_alias}.{}",
                quote_ident_text(other)?
            )
        });
    }
    Ok((many_to_one, parts.join(" AND ")))
}

/// `field.kind`, for a field `boundPlan` let through (an object or array).
fn kind(field: &Json) -> Option<&str> {
    as_str(get(Some(field), "kind").ok().flatten())
}

/// `field.embed` of a field whose kind is `embed`.
fn embed_of(field: &Json) -> Option<&Json> {
    (kind(field) == Some("embed"))
        .then(|| get(Some(field), "embed").ok().flatten())
        .flatten()
}

/// The elements of an array, or none.
pub fn items(value: &Json) -> &[Json] {
    match value {
        Json::Array(items) => items,
        _ => &[],
    }
}

/// `node[key]` as an array; `boundPlan` checked that it is one.
pub fn items_of<'a>(node: &'a Json, key: &str) -> &'a [Json] {
    get(Some(node), key)
        .ok()
        .flatten()
        .map(items)
        .unwrap_or(&[])
}
