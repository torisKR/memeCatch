-- Copy migrated Supabase auth.users into Better Auth tables.
-- Bcrypt hashes stay in account.password. The app verifies $2 hashes with bcrypt
-- and writes new passwords as Better Auth scrypt.
INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
SELECT id,
       COALESCE(raw_user_meta_data->>'nickname', '밈러'),
       email,
       email_confirmed_at IS NOT NULL,
       COALESCE(created_at, now()),
       COALESCE(updated_at, now())
  FROM auth.users
 WHERE email IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
SELECT id,
       id::text,
       'credential',
       id,
       encrypted_password,
       COALESCE(created_at, now()),
       COALESCE(updated_at, now())
  FROM auth.users
 WHERE encrypted_password IS NOT NULL AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
