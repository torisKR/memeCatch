# Pending review records

`wikimedia-2000-2020-pending-2026-07-14.jsonl` contains 1,001 public-reference
records for memes originating from 2000 through 2020. They have been inserted
into the remote `memes` table with `moderation_status = 'pending'`.

They are intentionally not public search or explore records. A linked
Wikipedia page is only a context reference; each entry still needs an editor to
verify its source year, an original upload or primary source, local relevance,
and rights before the normal moderation workflow can promote it.

The companion `.errors.json` file records the one discovery candidate that had
no usable Wikimedia introduction and was therefore not staged.
