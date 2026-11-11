import { createHmac, timingSafeEqual } from "node:crypto";
import { allowInternalSignup, blockedPublicEmail } from "@/lib/auth/internal";
import { hashNewPassword } from "@/lib/auth/passwords";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { getPool } from "@/lib/db/pool";

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET?.trim();
  if (!value) throw new Error("BETTER_AUTH_SECRET is required");
  return value;
}

export function magicPassword(email: string): string {
  return createHmac("sha256", secret()).update(`magic:${email.toLowerCase()}`).digest("hex");
}

export function createMagicToken(email: string): string {
  const exp = Date.now() + 10 * 60 * 1000;
  const payload = `${email.toLowerCase()}.${exp}`;
  const mac = createHmac("sha256", secret()).update(`magic-token:${payload}`).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function readMagicToken(token: string): string | null {
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const payload = token.slice(0, split);
  const mac = token.slice(split + 1);
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const expected = createHmac("sha256", secret()).update(`magic-token:${decoded}`).digest("hex");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const marker = decoded.lastIndexOf(".");
  const email = decoded.slice(0, marker);
  const exp = Number(decoded.slice(marker + 1));
  if (!email || !Number.isFinite(exp) || exp < Date.now()) return null;
  return email;
}

async function storeMagicPassword(email: string): Promise<void> {
  if (!blockedPublicEmail(email)) return;
  const hash = await hashNewPassword(magicPassword(email));
  await getPool().query(
    `UPDATE account
        SET password = $1, "updatedAt" = now()
      WHERE "userId" = (SELECT id FROM "user" WHERE lower(email) = lower($2))
        AND "providerId" = 'credential'`,
    [hash, email],
  );
}

export async function generateMagicLink(email: string, name: string): Promise<string> {
  await ensureAuthSchema();
  const password = magicPassword(email);
  await allowInternalSignup(async () => {
    try {
      await getAuth().api.signUpEmail({ body: { email, password, name: name.slice(0, 20) || "틱톡러" } });
    } catch {
      await storeMagicPassword(email);
    }
  });
  return createMagicToken(email);
}

export async function verifyMagicLink(token: string, requestHeaders: Headers): Promise<{ id: string; email: string } | null> {
  const email = readMagicToken(token);
  if (!email) return null;
  await ensureAuthSchema();
  const result = await getAuth().api.signInEmail({
    body: { email, password: magicPassword(email) },
    headers: requestHeaders,
  });
  return result.user ? { id: result.user.id, email: result.user.email } : null;
}
