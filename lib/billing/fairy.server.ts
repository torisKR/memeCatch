import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const projectSlug = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);

export type FairyConfig = {
  projectSlug: string;
  secret: string;
  minimumAmount: number;
};

export function getFairyConfig(): FairyConfig | null {
  const slug = projectSlug.safeParse(process.env.FAIRY_PROJECT_SLUG);
  const amount = Number(process.env.FAIRY_PLUS_MIN_AMOUNT_KRW);
  const secret = process.env.FAIRY_WEBHOOK_SECRET;
  if (
    process.env.FAIRY_PLUS_ENABLED !== "true" || !slug.success || !secret ||
    !Number.isSafeInteger(amount) || amount < 1_000 || amount > 10_000_000
  ) return null;
  return { projectSlug: slug.data, secret, minimumAmount: amount };
}

export function fairyDonationUrl(slug: string, intentId: string): string {
  const url = new URL(`https://fairy.hada.io/@${projectSlug.parse(slug)}`);
  url.searchParams.set("payload", JSON.stringify({ memecatchIntent: z.uuid().parse(intentId) }));
  url.hash = "support";
  return url.toString();
}

export function verifyFairySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

const fairyPaymentSchema = z.object({
  event: z.literal("payment.completed"),
  timestamp: z.iso.datetime({ offset: true }),
  data: z.object({
    paymentId: z.string().trim().min(1).max(200),
    amount: z.number().int().min(1_000).max(10_000_000),
    projectName: projectSlug,
    source: z.enum(["payple", "test"]),
    payload: z.object({ memecatchIntent: z.uuid().optional() }).optional(),
  }),
});

export function parseFairyPayment(rawBody: string) {
  try {
    return fairyPaymentSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return null;
  }
}

export type FairyPayment = {
  paymentId: string;
  projectSlug: string;
  intentId: string;
  amount: number;
  occurredAt: string;
};
