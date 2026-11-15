import { getPool } from "@/lib/db/pool";

type AuthUser = { id: string; email: string; name: string; emailVerified: boolean };

function nicknameFor(user: AuthUser, attempt: number): string {
  const base = (user.name || "밈러").trim().slice(0, 20);
  const fallback = base.length >= 2 ? base : `밈러_${user.id.replace(/-/g, "").slice(0, 6)}`;
  if (attempt === 0) return fallback.slice(0, 20);
  const suffix = `_${attempt}${user.id.replace(/-/g, "").slice(0, 3)}`;
  return `${fallback.slice(0, Math.max(2, 20 - suffix.length))}${suffix}`.slice(0, 20);
}

/** Mirror a Better Auth user into auth.users so handle_new_user can create the profile. */
export async function syncAuthUser(user: AuthUser): Promise<void> {
  const pool = getPool();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nickname = nicknameFor(user, attempt);
    try {
      await pool.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         VALUES ($1::uuid, $2, CASE WHEN $4::boolean THEN now() ELSE NULL END, jsonb_build_object('nickname', $3::text))
         ON CONFLICT (id) DO UPDATE
           SET email = EXCLUDED.email,
               email_confirmed_at = CASE
                 WHEN auth.users.email_confirmed_at IS NOT NULL THEN auth.users.email_confirmed_at
                 WHEN $4::boolean THEN now()
                 ELSE NULL
               END,
               updated_at = now()`,
        [user.id, user.email, nickname, user.emailVerified],
      );
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "23505") throw error;
    }
  }
  throw new Error("nickname collision");
}
