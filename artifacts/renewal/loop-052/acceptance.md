# SUB-001 acceptance criteria

1. An active Plus account's own saved, approved/limited rising meme can receive `saved_rising`.
2. A saved meme does not also receive the generic category `rising` alert in the same fan-out.
3. A Plus account without interests remains eligible through `saved_memes`; browser roles cannot execute fan-out.
4. Alert volume remains capped at 15 per account, unique by `(user_id, meme_id, kind)`, and old alerts expire after 30 days.
5. The account dashboard explains the saved-meme watch using only an account-scoped count; private notes/collections are not returned.
6. Every UI locale has copy for trend history and the distinction between saved and category trend alerts.
7. Public canonical, sitemap, and metadata surfaces stay untouched.
8. A single named pg_cron job runs fan-out five minutes after the daily trend-score job.

Local source and UI tests cover 1–6 and 8 contractually. Database execution/RLS proof requires a local or approved production database and remains a release gate.
