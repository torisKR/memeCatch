# Restoring function permissions after the backup-role grant bug

The old backup-role setup granted `anon`, `authenticated`, and `service_role`
execution on every public SECURITY DEFINER function. Updating the script does
not undo those grants on an existing database. Until permissions have been
reconciled, treat public RPC access to the affected database as exposed. A
service restart does not replay the initializer on an existing data volume.
Install the fixed script and rerun `ensure_backup_role` (see the existing
[backup setup](../../docs/oci-setup.md#backups)) to remove broad default grants
for newly created functions. This operation updates the backup login password
from its configured environment and does **not** remove existing broad grants.
Preserve the correct configured password and perform the reconciliation below.

Use a disposable, isolated PostgreSQL baseline initialized with the fixed
`backup-role.sh` and **the same migrations and function definitions as the
target**. Never use a copy of the affected database as the baseline: it would
copy the incorrect grants. Include any deferred migrations actually applied to
the target. The baseline must not contain production data or be publicly
reachable. Review differences and migration history before proceeding.

Set `ACL_BASELINE_DATABASE_URL` and `ACL_TARGET_DATABASE_URL` in the local
process environment using securely supplied database credentials. Use read-only
connections for this comparison. Run from the repository root:

```sh
node scripts/postgres/prepare-function-acl-restore.mjs > function-acl-review.sql
```

The tool only reads the databases and writes SQL for review; it does not apply
changes. It refuses mismatched function sets or definitions and a baseline
with PUBLIC execution rights. A mismatch requires investigation, not a partial
restore. The output changes only PUBLIC, anon, authenticated, and service_role
execution grants on public SECURITY DEFINER functions. Inspect it against the
migrations and test it against a disposable copy of the target. Account for
function owners, role membership, custom grants, and deployment-specific
functions separately. Preserve a current backup and plan a rollback.

Once reviewed, apply the SQL in a controlled maintenance window with a
privileged connection. It is wrapped in a transaction. Prevent concurrent
schema/privilege changes between comparison and application, and regenerate if
anything changes. Verify the resulting privileges and application workflows,
including anonymous, authenticated, operator, and background jobs. Protect and
delete the generated SQL when no longer needed.
