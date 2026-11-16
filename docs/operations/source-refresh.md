# Source refresh and catalog cache

The scheduler calls `GET /api/cron/source-refresh` every 15 minutes. Each run
queues expiration of the public catalog cache, including when source availability
is unchanged or a later update fails. Next.js applies the expiration after the
handler runs, so the next scheduled run retries even if a cache backend failure
occurs after the handler returns. This reduces the effective catalog cache lifetime
to at most 15 minutes during normal operation. Provider errors remain
inconclusive and do not mark a video unavailable.

Corrections applied directly to the database bypass the admin actions that
normally expire the cache. After such a correction, an operator can expire the
catalog cache by calling `POST /api/cron/source-refresh` with the existing
`CRON_SECRET` bearer credential. Both methods reject missing or incorrect
credentials. POST only expires the cache; it does not run the refresh job.

For example, on the OCI host, run this from the Compose directory. The secret
stays in the app process environment and is not printed or passed as an
argument:

```sh
docker compose exec -T app node - <<'NODE'
const secret = process.env.CRON_SECRET;
if (!secret) throw new Error('CRON_SECRET is unavailable');
fetch('http://127.0.0.1:3000/api/cron/source-refresh', {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}` },
}).then(async (response) => {
  console.log('catalog revalidation status:', response.status);
  if (!response.ok) process.exitCode = 1;
}).catch(() => {
  console.error('catalog revalidation request failed');
  process.exitCode = 1;
});
NODE
```

Verify the corrected public page after the request. This endpoint does not
resolve TikTok source checks that the upstream provider leaves inconclusive.
