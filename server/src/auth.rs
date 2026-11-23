//! better-auth session cookie reading, operator check, cron guard. Filled in
//! by T3. Handlers reach the database and secrets through `AppState`
//! (`state.db`, `state.config.better_auth_secret`, `state.config.cron_secret`).
