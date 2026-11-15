# Community upload storage quota

## Upgrade order

The PostgreSQL init script runs migrations only on first initialization.
Before deploying the app version that calls the reservation function to an
existing database, back up the database and apply the reviewed migration from
the corresponding release checkout:

```sh
docker compose -p memecatch exec -T postgres psql -U postgres -d memecatch -v ON_ERROR_STOP=1 < db/migrations/20261116010000_community_upload_storage_quota.sql
```

Verify `public.reserve_community_upload_storage(uuid,bigint)` exists before
deploying the app. Until the migration is present uploads fail closed with
`storage_quota_unavailable` (HTTP 503). The migration is idempotent and does
not delete existing data or storage objects.

## Limits and reconciliation

New uploads reserve storage before the object is sent. Reservations are durable
across app restarts and concurrent requests. Each account may reserve up to
5 GiB and 500 objects; the installation may reserve up to 100 GiB and 100,000
objects. These limits bound future growth, not objects that predate the quota
migration. Monitor actual R2 or local storage separately and inventory older
objects before treating the global counter as the physical storage total.

The reservation is retained even when a PUT fails or times out: a remote store
may have accepted an object whose response was lost. Account deletion does not
reset counters. No existing object is automatically deleted. A user reaching a
limit receives an explicit message to contact an administrator.

An administrator may reconcile overcounted reservations only after verifying
the object's absence or securely deleting the unneeded object and checking no
post or submission references it. Pause uploads during reconciliation, back up
the database, and inspect both storage and references. Adjust both the user's
`user:<uuid>` row and `global` row in one database transaction by the verified
bytes and object count; never let a counter become negative. Counters are not
an object inventory, so do not infer that an object is safe to delete from them.
If exact usage cannot be established, leave reservations intact and expand the
limits only after assessing available capacity and abuse risk.
