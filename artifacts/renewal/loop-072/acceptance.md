# Loop 072 acceptance

## User outcome

An active Plus user can open a locale-safe Daily route and solve three globally useful
memes selected from the same KST challenge day. The content is limited to memes whose
Korean source and all four global translations are reviewed, current, and complete.

## Acceptance contract

- `/daily`, `/en/daily`, `/ja/daily`, `/zh/daily`, and `/zh-tw/daily` render localized
  signed-out, free, active Plus, completed, and unavailable states without fake quiz data.
- The challenge date is derived in `Asia/Seoul`. One immutable schedule contains exactly
  12 eligible candidates per date, and the UI presents exactly 3 deterministic questions.
- Eligible candidates are `approved` or `limited`, have non-empty source fields, and have
  `reviewed` translations for `en`, `ja`, `zh`, and `zh-tw` whose revision and required
  fields are current and complete.
- The generator is stable for candidate input order and uses date, locale, and schedule
  identity as its deterministic seed. Missing, machine, stale, or incomplete translations
  never fall back to Korean text on the public quiz.
- A completion request accepts only a supported `locale` from the client. The server and
  RPC derive the authenticated user, current KST date, schedule, and completion identity.
  Completion is idempotent per `(user_id, challenge_date)` and returns the server-calculated
  streak.
- Free and signed-out users receive a login or localized pricing path; only active Plus
  users can load or complete the challenge. `global_daily_start` and
  `global_daily_complete` are explicit analytics events.

## Safety boundary

- Schedule and completion tables are protected by RLS and direct public/anonymous/authenticated
  writes are revoked. Authenticated RPC is the only completion boundary.
- The completion RPC does not accept `user_id`, `challenge_date`, or meme IDs from the client.
- The feature does not auto-review, auto-translate, auto-publish, or expose machine/stale
  translations through public SEO surfaces.

## External gates

- The migration and RPC source are present, but production Supabase application, RLS/RPC
  execution, database reset, and authenticated Plus completion/streak QA were not performed.
- Production deploy, push, and merge were not performed.
