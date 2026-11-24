//! The sign-in tables on a database built from db/migrations
//! (`*_better_auth_tables.sql`): the columns, defaults, indexes and
//! constraints better-auth 1.7.20's `getMigrations` makes for Postgres with
//! uuid ids (compared with it when the migration was written), and only the
//! grants production has. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use common::database_url;
use sqlx::PgPool;

const TABLES: &str = "('user', 'session', 'account', 'verification')";

/// `table|column|type|not null|default`, in column order.
const COLUMNS: &str = "
account|id|uuid|t|gen_random_uuid()
account|accountId|text|t|
account|providerId|text|t|
account|userId|uuid|t|
account|accessToken|text|f|
account|refreshToken|text|f|
account|idToken|text|f|
account|accessTokenExpiresAt|timestamp with time zone|f|
account|refreshTokenExpiresAt|timestamp with time zone|f|
account|scope|text|f|
account|password|text|f|
account|createdAt|timestamp with time zone|t|CURRENT_TIMESTAMP
account|updatedAt|timestamp with time zone|t|
session|id|uuid|t|gen_random_uuid()
session|expiresAt|timestamp with time zone|t|
session|token|text|t|
session|createdAt|timestamp with time zone|t|CURRENT_TIMESTAMP
session|updatedAt|timestamp with time zone|t|
session|ipAddress|text|f|
session|userAgent|text|f|
session|userId|uuid|t|
user|id|uuid|t|gen_random_uuid()
user|name|text|t|
user|email|text|t|
user|emailVerified|boolean|t|
user|image|text|f|
user|createdAt|timestamp with time zone|t|CURRENT_TIMESTAMP
user|updatedAt|timestamp with time zone|t|CURRENT_TIMESTAMP
verification|id|uuid|t|gen_random_uuid()
verification|identifier|text|t|
verification|value|text|t|
verification|expiresAt|timestamp with time zone|t|
verification|createdAt|timestamp with time zone|t|CURRENT_TIMESTAMP
verification|updatedAt|timestamp with time zone|t|CURRENT_TIMESTAMP
";

const INDEXES: &str = r#"
account|CREATE INDEX "account_userId_idx" ON public.account USING btree ("userId")
account|CREATE UNIQUE INDEX account_pkey ON public.account USING btree (id)
session|CREATE INDEX "session_userId_idx" ON public.session USING btree ("userId")
session|CREATE UNIQUE INDEX session_pkey ON public.session USING btree (id)
session|CREATE UNIQUE INDEX session_token_key ON public.session USING btree (token)
user|CREATE UNIQUE INDEX user_email_key ON public."user" USING btree (email)
user|CREATE UNIQUE INDEX user_pkey ON public."user" USING btree (id)
verification|CREATE INDEX verification_identifier_idx ON public.verification USING btree (identifier)
verification|CREATE UNIQUE INDEX verification_pkey ON public.verification USING btree (id)
"#;

const CONSTRAINTS: &str = r#"
account|FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
account|PRIMARY KEY (id)
session|FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
session|PRIMARY KEY (id)
session|UNIQUE (token)
user|PRIMARY KEY (id)
user|UNIQUE (email)
verification|PRIMARY KEY (id)
"#;

async fn lines(pool: &PgPool, sql: &str) -> String {
    // Catalog queries built from the constants above, no input.
    let rows: Vec<String> = sqlx::query_scalar(sqlx::AssertSqlSafe(sql.to_owned()))
        .fetch_all(pool)
        .await
        .expect("catalog query");
    rows.join("\n")
}

#[tokio::test]
async fn the_sign_in_tables_are_the_ones_better_auth_makes() {
    let pool = PgPool::connect(&database_url()).await.expect("database");
    let columns = lines(
        &pool,
        &format!(
            "select concat_ws('|', c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
                              case when a.attnotnull then 't' else 'f' end,
                              coalesce(pg_get_expr(d.adbin, d.adrelid), ''))
               from pg_attribute a
               join pg_class c on c.oid = a.attrelid
               left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
              where c.relnamespace = 'public'::regnamespace and c.relname in {TABLES}
                and a.attnum > 0 and not a.attisdropped
              order by c.relname, a.attnum"
        ),
    )
    .await;
    assert_eq!(columns, COLUMNS.trim());

    let indexes = lines(
        &pool,
        &format!(
            "select c.relname || '|' || pg_get_indexdef(x.indexrelid)
               from pg_index x join pg_class c on c.oid = x.indrelid
              where c.relnamespace = 'public'::regnamespace and c.relname in {TABLES}
              order by 1"
        ),
    )
    .await;
    assert_eq!(indexes, INDEXES.trim());

    let constraints = lines(
        &pool,
        &format!(
            "select c.relname || '|' || pg_get_constraintdef(k.oid)
               from pg_constraint k join pg_class c on c.oid = k.conrelid
              where c.relnamespace = 'public'::regnamespace and c.relname in {TABLES}
              order by 1"
        ),
    )
    .await;
    assert_eq!(constraints, CONSTRAINTS.trim());
}

#[tokio::test]
async fn the_browser_roles_cannot_reach_them() {
    let pool = PgPool::connect(&database_url()).await.expect("database");
    // `role|table|privileges held`, of every privilege a table can grant.
    let held = lines(
        &pool,
        "select r || '|' || t || '|' || coalesce(string_agg(p, ',' order by p), '')
           from unnest(array['anon', 'authenticated', 'service_role']) r
          cross join unnest(array['account', 'session', 'user', 'verification']) t
           left join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
             on has_table_privilege(r, 'public.' || quote_ident(t), p)
          group by r, t
          order by r, t",
    )
    .await;
    assert_eq!(
        held,
        "anon|account|\nanon|session|\nanon|user|\nanon|verification|\n\
         authenticated|account|\nauthenticated|session|\nauthenticated|user|\nauthenticated|verification|\n\
         service_role|account|SELECT,UPDATE\nservice_role|session|SELECT\nservice_role|user|SELECT\nservice_role|verification|SELECT"
    );
}
