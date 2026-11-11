import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { APIError } from "better-auth/api";
import { SITE_URL } from "@/lib/site";
import { getPool } from "@/lib/db/pool";
import { blockedPublicEmail, internalSignupOpen } from "@/lib/auth/internal";
import { verifyStoredPassword } from "@/lib/auth/passwords";
import { syncAuthUser } from "@/lib/auth/sync-user";

function googleProvider() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return undefined;
  return { google: { clientId, clientSecret } };
}

function kakaoPlugin() {
  const clientId = process.env.KAKAO_CLIENT_ID?.trim();
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return genericOAuth({
    config: [
      {
        providerId: "kakao",
        clientId,
        clientSecret,
        authorizationUrl: "https://kauth.kakao.com/oauth/authorize",
        tokenUrl: "https://kauth.kakao.com/oauth/token",
        scopes: ["account_email", "profile_nickname"],
        async getUserInfo(tokens) {
          const response = await fetch("https://kapi.kakao.com/v2/user/me", {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          });
          if (!response.ok) return null;
          const profile = (await response.json()) as {
            id?: number | string;
            kakao_account?: {
              email?: string;
              is_email_verified?: boolean;
              profile?: { nickname?: string };
            };
          };
          if (!profile.id) return null;
          const id = String(profile.id);
          return {
            id,
            email: profile.kakao_account?.email ?? `${id}@kakao.memecatch.internal`,
            name: profile.kakao_account?.profile?.nickname ?? `카카오_${id.slice(0, 6)}`,
            emailVerified: profile.kakao_account?.is_email_verified === true,
          };
        },
      },
    ],
  });
}

const kakao = kakaoPlugin();

export const authOptions = {
  appName: "memecatch",
  baseURL: process.env.BETTER_AUTH_URL?.trim() || SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [SITE_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 12,
    password: {
      verify: ({ hash, password }: { hash: string; password: string }) => verifyStoredPassword(hash, password),
    },
    sendResetPassword: async ({ user, token }: { user: { email: string }; token: string; url: string }) => {
      const resetUrl = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const webhook = process.env.AUTH_EMAIL_WEBHOOK?.trim();
      if (!webhook) {
        console.info(JSON.stringify({ event: "password_reset_not_delivered", email: user.email }));
        return;
      }
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: user.email,
          subject: "Reset your MemeCatch password",
          url: resetUrl,
        }),
      });
    },
  },
  socialProviders: googleProvider(),
  plugins: [...(kakao ? [kakao] : []), nextCookies()],
  advanced: {
    database: { generateId: "uuid" as const },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        async before(user: { email: string }) {
          if (!internalSignupOpen() && blockedPublicEmail(user.email)) {
            throw new APIError("BAD_REQUEST", { message: "blocked email domain" });
          }
          return { data: user };
        },
        async after(user: { id: string; email: string; name: string; emailVerified?: boolean }) {
          await syncAuthUser({ ...user, emailVerified: user.emailVerified === true });
        },
      },
    },
  },
};

function authConfig() {
  return { ...authOptions, database: getPool() };
}

function createAuth() {
  return betterAuth(authConfig());
}

let instance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  instance ??= createAuth();
  return instance;
}

let migrating: Promise<void> | null = null;

async function grantServiceRole(): Promise<void> {
  await getPool().query(`
    DO $$
    BEGIN
      IF to_regclass('public."user"') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT ON TABLE public."user" TO service_role';
      END IF;
      IF to_regclass('public.session') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT ON TABLE public.session TO service_role';
      END IF;
      IF to_regclass('public.account') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT, UPDATE ON TABLE public.account TO service_role';
      END IF;
      IF to_regclass('public.verification') IS NOT NULL THEN
        EXECUTE 'GRANT SELECT ON TABLE public.verification TO service_role';
      END IF;
    END $$;
  `);
}

export function ensureAuthSchema(): Promise<void> {
  if (migrating) return migrating;
  const run = getMigrations(authConfig())
    .then((plan) => plan.runMigrations())
    .then(() => grantServiceRole())
    .catch((error: unknown) => {
      migrating = null;
      throw error;
    });
  migrating = run;
  return run;
}
