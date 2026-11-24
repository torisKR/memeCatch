//! Running a compiled plan the way `runQuery` does through node-pg.
//!
//! node-pg sends every parameter as text with no type, so Postgres types it
//! from where it stands (`ref = $1` takes the column's type, `"p" => $1`
//! the function argument's) and parses the text with that type's input
//! function. sqlx sends parameters only in binary, which needs the type up
//! front. So each statement goes in three steps:
//!
//! 1. prepare it with no parameter types, as node-pg's `Parse` does, and
//!    read the types Postgres chose (unnamed: the plan pool has no
//!    statement cache, see [`crate::db::Db`]);
//! 2. have Postgres parse each text with its type's input function
//!    (`array_in` on a one-element array of that type, or on the text itself
//!    for an array type) and hand back the binary form;
//! 3. parse it again, unnamed, with the types Postgres chose, and execute
//!    it with those values.
//!
//! The statement text is the TypeScript's, byte for byte. A value that does
//! not parse fails in step 2 with the message and SQLSTATE the input function
//! gives, which is what node-pg gets at `Bind`.

use sqlx::encode::IsNull;
use sqlx::error::BoxDynError;
use sqlx::postgres::types::Oid;
use sqlx::postgres::{PgArgumentBuffer, PgRow, PgTypeInfo, PgTypeKind, PgValueRef};
use sqlx::{
    AssertSqlSafe, Decode, Either, Encode, Executor, PgConnection, Postgres, Row, SqlSafeStr,
    Statement, Type,
};

use super::js::PlanError;
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::js_json;
use crate::routes::request::Json;

/// What a statement gives back.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    /// `asJsonRows`: each row as `row_to_json` text.
    Json,
    /// The `count` column of a counting select.
    Count,
    /// No rows (a write without `RETURNING`).
    Plain,
}

#[derive(Debug, PartialEq)]
pub enum Rows {
    Json(Vec<String>),
    Count(i64),
    Plain,
}

/// `asJsonRows(sqlText)`.
pub fn as_json_rows(sql: &str) -> String {
    format!("WITH __q AS ({sql}) SELECT row_to_json(__q) AS __row FROM __q")
}

/// Runs `sql` as `identity`, in a transaction of its own, on the plan pool:
/// the statement is prepared unnamed, so a plan leaves nothing behind.
pub async fn run(
    state: &AppState,
    identity: &DbIdentity,
    sql: &str,
    params: &[Json],
    mode: Mode,
) -> Result<Rows, PlanError> {
    let text = match mode {
        Mode::Json => as_json_rows(sql),
        Mode::Count | Mode::Plain => sql.to_owned(),
    };
    let values: Vec<Option<String>> = params.iter().map(prepare_value).collect();
    state
        .db
        .with_identity_uncached(identity, IdentityOptions::default(), move |tx| {
            Box::pin(async move { execute(tx, text, &values, mode).await })
        })
        .await
        .map_err(|error: sqlx::Error| database_error(&error))
}

async fn execute(
    conn: &mut PgConnection,
    sql: String,
    values: &[Option<String>],
    mode: Mode,
) -> Result<Rows, sqlx::Error> {
    let statement = (&mut *conn)
        .prepare(AssertSqlSafe(sql).into_sql_str())
        .await?;
    let types: Vec<PgTypeInfo> = match statement.parameters() {
        Some(Either::Left(types)) => types.to_vec(),
        _ => Vec::new(),
    };
    let binary = to_binary(conn, &types, values).await?;
    let mut query = statement.query();
    for (ty, bytes) in types.into_iter().zip(binary) {
        query = query.bind(Raw { ty, bytes });
    }
    Ok(match mode {
        Mode::Json => {
            let rows = query.fetch_all(&mut *conn).await?;
            Rows::Json(
                rows.iter()
                    .map(|row| text_of(row, 0))
                    .collect::<Result<_, _>>()?,
            )
        }
        Mode::Count => {
            let row = query.fetch_one(&mut *conn).await?;
            Rows::Count(i64::from(row.try_get::<i32, _>(0)?))
        }
        Mode::Plain => {
            query.execute(&mut *conn).await?;
            Rows::Plain
        }
    })
}

fn text_of(row: &PgRow, index: usize) -> Result<String, sqlx::Error> {
    let AnyBytes(bytes) = row.try_get(index)?;
    String::from_utf8(bytes).map_err(|error| sqlx::Error::Decode(Box::new(error)))
}

/// Step 2: the binary form of each text value, parsed by Postgres as the
/// type it chose for that parameter. `None` stays NULL.
async fn to_binary(
    conn: &mut PgConnection,
    types: &[PgTypeInfo],
    values: &[Option<String>],
) -> Result<Vec<Option<Vec<u8>>>, sqlx::Error> {
    let present: Vec<usize> = (0..types.len())
        .filter(|index| values.get(*index).is_some_and(Option::is_some))
        .collect();
    let mut out: Vec<Option<Vec<u8>>> = vec![None; types.len()];
    if present.is_empty() {
        return Ok(out);
    }
    let calls: Vec<String> = (0..present.len())
        .map(|k| format!("array_in(${}, ${}, -1)", 2 * k + 1, 2 * k + 2))
        .collect();
    let sql = format!("SELECT {}", calls.join(", "));
    let mut query = sqlx::query(AssertSqlSafe(sql)).persistent(false);
    let mut whole = Vec::new();
    for &index in &present {
        let text = values[index].as_deref().unwrap_or_default();
        let ty = &types[index];
        let (literal, element) = match ty.kind() {
            PgTypeKind::Array(element) => (text.to_owned(), element.oid()),
            _ => (format!("{{{}}}", escape_element(text)), ty.oid()),
        };
        let element = element.ok_or_else(|| {
            sqlx::Error::Protocol(format!("parameter {} has no type oid", index + 1))
        })?;
        whole.push(matches!(ty.kind(), PgTypeKind::Array(_)));
        query = query
            .bind(Raw {
                ty: PgTypeInfo::with_oid(Oid(CSTRING)),
                bytes: Some(literal.into_bytes()),
            })
            .bind(element);
    }
    let row = query.fetch_one(&mut *conn).await?;
    for (column, &index) in present.iter().enumerate() {
        let AnyBytes(array) = row.try_get(column)?;
        out[index] = Some(if whole[column] {
            array
        } else {
            first_element(&array)?
        });
    }
    Ok(out)
}

const CSTRING: u32 = 2275;

/// The one element of a one-dimensional array in Postgres's binary format:
/// dimensions, null flag, element type, then length and lower bound per
/// dimension, then length-prefixed elements.
fn first_element(array: &[u8]) -> Result<Vec<u8>, sqlx::Error> {
    let int = |at: usize| -> Option<i32> {
        array
            .get(at..at + 4)
            .map(|bytes| i32::from_be_bytes(bytes.try_into().expect("four bytes")))
    };
    let broken = || sqlx::Error::Protocol("unexpected array_in result".to_owned());
    if int(0) != Some(1) {
        return Err(broken());
    }
    // 12 bytes of header, 8 for the one dimension.
    let length = int(20).ok_or_else(broken)?;
    let length = usize::try_from(length).map_err(|_| broken())?;
    array
        .get(24..24 + length)
        .map(<[u8]>::to_vec)
        .ok_or_else(broken)
}

/// pg's `prepareValue`: the text node-pg sends for a bound value, `None` for
/// NULL.
pub fn prepare_value(value: &Json) -> Option<String> {
    match value {
        Json::Null => None,
        Json::String(text) => Some(text.clone()),
        Json::Number(n) => Some(js_json::number(*n)),
        Json::Bool(flag) => Some(flag.to_string()),
        Json::Array(items) => Some(array_string(items)),
        Json::Object(_) => Some(js_json::stringify_parsed(value)),
    }
}

/// pg's `arrayString`.
fn array_string(items: &[Json]) -> String {
    let parts: Vec<String> = items
        .iter()
        .map(|item| match item {
            Json::Null => "NULL".to_owned(),
            Json::Array(nested) => array_string(nested),
            other => escape_element(&prepare_value(other).unwrap_or_default()),
        })
        .collect();
    format!("{{{}}}", parts.join(","))
}

/// pg's `escapeElement`.
fn escape_element(text: &str) -> String {
    format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""))
}

/// A parameter of a type Postgres chose, already in binary.
struct Raw {
    ty: PgTypeInfo,
    bytes: Option<Vec<u8>>,
}

impl Type<Postgres> for Raw {
    fn type_info() -> PgTypeInfo {
        PgTypeInfo::with_oid(Oid(0))
    }
}

impl Encode<'_, Postgres> for Raw {
    fn encode_by_ref(&self, buf: &mut PgArgumentBuffer) -> Result<IsNull, BoxDynError> {
        match &self.bytes {
            None => Ok(IsNull::Yes),
            Some(bytes) => {
                buf.extend_from_slice(bytes);
                Ok(IsNull::No)
            }
        }
    }

    fn produces(&self) -> Option<PgTypeInfo> {
        Some(self.ty.clone())
    }
}

/// A column of any type, as the bytes Postgres sent.
struct AnyBytes(Vec<u8>);

impl Type<Postgres> for AnyBytes {
    fn type_info() -> PgTypeInfo {
        PgTypeInfo::with_oid(Oid(0))
    }

    fn compatible(_: &PgTypeInfo) -> bool {
        true
    }
}

impl Decode<'_, Postgres> for AnyBytes {
    fn decode(value: PgValueRef<'_>) -> Result<Self, BoxDynError> {
        Ok(Self(value.as_bytes()?.to_vec()))
    }
}

/// `queryError` for an error of the database or the connection: the
/// SQLSTATE, or the code node-pg gives a refused connection.
pub fn database_error(error: &sqlx::Error) -> PlanError {
    match error {
        sqlx::Error::Database(database) => PlanError::Database {
            code: database.code().map(|code| code.into_owned()),
            message: database.message().to_owned(),
        },
        sqlx::Error::Io(io) if io.kind() == std::io::ErrorKind::ConnectionRefused => {
            PlanError::Database {
                code: Some("ECONNREFUSED".to_owned()),
                message: error.to_string(),
            }
        }
        other => PlanError::Database {
            code: None,
            message: other.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(text: &str) -> Json {
        Json::parse(text).expect("json")
    }

    #[test]
    fn values_are_the_text_node_pg_sends() {
        let sent = |text: &str| prepare_value(&parse(text));
        assert_eq!(sent("null"), None);
        assert_eq!(sent(r#""a""#), Some("a".into()));
        assert_eq!(sent("1e21"), Some("1e+21".into()));
        assert_eq!(sent("-0"), Some("0".into()));
        assert_eq!(sent("true"), Some("true".into()));
        assert_eq!(sent(r#"{"b":1,"1":2}"#), Some(r#"{"1":2,"b":1}"#.into()));
        assert_eq!(
            sent(r#"["a\"b","c\\d",null,1,true,{"k":"v"},["x"]]"#),
            Some(r#"{"a\"b","c\\d",NULL,"1","true","{\"k\":\"v\"}",{"x"}}"#.into())
        );
    }

    #[test]
    fn the_element_of_a_one_element_array_is_read_from_its_binary_form() {
        let mut array = Vec::new();
        for int in [1i32, 0, 2950, 1, 1, 3] {
            array.extend_from_slice(&int.to_be_bytes());
        }
        array.extend_from_slice(b"abc");
        assert_eq!(first_element(&array).unwrap(), b"abc");
        assert!(first_element(&array[..20]).is_err());
    }
}
