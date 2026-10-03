import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MEME_VECTOR_PROFILE } from "@/lib/meme-vectors";

type EmbeddingEnvironment = Readonly<Record<string, string | undefined>>;
const TIME_HEADER = "x-memecatch-embedding-time";
const SIGNATURE_HEADER = "x-memecatch-embedding-signature";
const CLOCK_TOLERANCE_MS = 30_000;

function existingSecret(env: EmbeddingEnvironment): string | null {
  const secret = env.CRON_SECRET;
  return secret?.trim() ? secret : null;
}

function signInput(secret: string, timestamp: number, input: string): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify([timestamp, MEME_VECTOR_PROFILE, input]), "utf8")
    .digest("hex");
}

/** Signs one exact input with the existing server secret; it does not issue a token. */
export function createEmbeddingAuthHeaders(
  input: string,
  env: EmbeddingEnvironment = process.env,
  now: number = Date.now(),
): Record<string, string> | null {
  const secret = existingSecret(env);
  if (!secret || !Number.isSafeInteger(now) || now < 0) return null;
  return {
    [TIME_HEADER]: String(now),
    [SIGNATURE_HEADER]: signInput(secret, now, input),
  };
}

export function verifyEmbeddingAuth(
  request: Pick<Request, "headers">,
  input: string,
  env: EmbeddingEnvironment = process.env,
  now: number = Date.now(),
): boolean {
  const secret = existingSecret(env);
  const time = request.headers.get(TIME_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!secret || !time || !signature || !Number.isSafeInteger(now) || now < 0
    || !/^(0|[1-9]\d{0,15})$/.test(time) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const timestamp = Number(time);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > CLOCK_TOLERANCE_MS) return false;
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(signInput(secret, timestamp, input), "hex"),
  );
}
