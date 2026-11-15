#!/usr/bin/env node
// Compare a clean, freshly initialized baseline against an existing database.
// This generates SQL for review; it never changes either database.
import pg from 'pg';

const baselineUrl = process.env.ACL_BASELINE_DATABASE_URL;
const targetUrl = process.env.ACL_TARGET_DATABASE_URL;
if (!baselineUrl || !targetUrl || baselineUrl === targetUrl) {
  console.error('Set distinct ACL_BASELINE_DATABASE_URL and ACL_TARGET_DATABASE_URL.');
  process.exit(1);
}

const query = `
  SELECT format('%I.%I(%s)', n.nspname, p.proname,
                pg_get_function_identity_arguments(p.oid)) AS signature,
         pg_get_functiondef(p.oid) AS definition,
         ARRAY(SELECT CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END
                 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                 LEFT JOIN pg_roles r ON r.oid = x.grantee
                WHERE x.privilege_type = 'EXECUTE'
                  AND (x.grantee = 0 OR r.rolname IN ('anon', 'authenticated', 'service_role'))
                ORDER BY 1) AS grants
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
   ORDER BY 1`;

const clients = [new pg.Client({connectionString: baselineUrl}), new pg.Client({connectionString: targetUrl})];
try {
  await Promise.all(clients.map(c => c.connect()));
  await Promise.all(clients.map(c => c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')));
  const [baseline, target] = await Promise.all(clients.map(c => c.query(query)));
  const existing = new Map(target.rows.map(row => [row.signature, row]));
  if (!baseline.rows.length || baseline.rows.length !== target.rows.length) {
    throw new Error('Function sets differ or are empty; use a baseline initialized from the exact deployed migrations.');
  }
  const statements = [];
  for (const row of baseline.rows) {
    const current = existing.get(row.signature);
    if (!current || current.definition !== row.definition) {
      throw new Error(`Function definition differs: ${row.signature}. Do not apply a partial restore.`);
    }
    if (row.grants.includes('PUBLIC')) {
      throw new Error(`Baseline still grants PUBLIC execution: ${row.signature}. Run the fixed initializer first.`);
    }
    for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) {
      const expected = row.grants.includes(role);
      const actual = current.grants.includes(role);
      if (expected !== actual) {
        const safeRole = role === 'PUBLIC' ? 'PUBLIC' : `"${role}"`;
        statements.push(expected
          ? `GRANT EXECUTE ON FUNCTION ${row.signature} TO ${safeRole};`
          : `REVOKE EXECUTE ON FUNCTION ${row.signature} FROM ${safeRole};`);
      }
    }
  }
  console.log('-- Review against the deployed migration history before applying.');
  console.log('-- Generate again immediately before applying; concurrent schema changes invalidate this snapshot.');
  console.log('BEGIN;');
  console.log(statements.join('\n'));
  console.log('COMMIT;');
  console.error(`Prepared ${statements.length} changes across ${baseline.rows.length} matching functions; no changes applied.`);
} catch (error) {
  console.error(`ACL comparison failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.allSettled(clients.map(c => c.end()));
}
