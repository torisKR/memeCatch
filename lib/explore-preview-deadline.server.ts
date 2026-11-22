import "server-only";
import { executeDeadlinePlan } from "@/lib/db/execute";
import { createPlanClient } from "@/lib/db/plan";
import type { DbIdentity } from "@/lib/db/pool";

const MAX_ACTIVE = 4;
const DEADLINE_MS = 4_000;
let active = 0;

/** The separate deadline pool bounds checkout and PostgreSQL statement time. */
export function createPreviewDeadlineDb(role: "anon" | "service_role") {
  const identity: DbIdentity = { userId: null, role, anonymous: false };
  const client = createPlanClient((plan, signal) => executeDeadlinePlan(plan, identity, signal));
  return { from: client.from.bind(client) };
}

/** Fail closed promptly, retaining a slot until the underlying work settles. */
export async function withPreviewDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  requestSignal?: AbortSignal,
): Promise<T | null> {
  if (active >= MAX_ACTIVE || requestSignal?.aborted) return null;
  active += 1;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  requestSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(onAbort, DEADLINE_MS);
  let onDeadline!: () => void;
  const expired = new Promise<null>((resolve) => {
    onDeadline = () => resolve(null);
    controller.signal.addEventListener("abort", onDeadline, { once: true });
  });
  const pending = Promise.resolve().then(() => work(controller.signal)).catch(() => null).finally(() => { active -= 1; });
  try {
    return await Promise.race([pending, expired]);
  } finally {
    clearTimeout(timer);
    requestSignal?.removeEventListener("abort", onAbort);
    controller.signal.removeEventListener("abort", onDeadline);
  }
}
