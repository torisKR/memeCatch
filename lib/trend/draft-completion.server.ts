import "server-only";

import { readBoundedText } from "@/lib/request-body";
import type { EvidenceDraftCompletion } from "./evidence-draft";

/** Uses the existing configured provider; no provider/account is created here. */
export function createTrendDraftCompletion(
  env: Readonly<Record<string, string | undefined>> = process.env,
  request: typeof fetch = fetch,
): EvidenceDraftCompletion | undefined {
  if (env.RADAR_AI_DRAFT_ENABLED !== "true") return undefined;
  const localBase = env.OPENCODEX_CONTENT_BASE_URL?.trim();
  const localModel = env.OPENCODEX_CONTENT_MODEL?.trim();
  const useLocal = env.NODE_ENV !== "production" && Boolean(localBase && localModel);
  const base = useLocal ? localBase! : "https://openrouter.ai/api/v1";
  const key = useLocal ? env.OPENCODEX_CONTENT_API_KEY?.trim() : env.OPENROUTER_API_KEY?.trim();
  const model = useLocal ? localModel! : "stealth/ox-alpha";
  if (!useLocal && !key) return undefined;
  let url: URL;
  try {
    url = new URL(base.replace(/\/+$/u, "") + "/chat/completions");
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (useLocal ? !localHost : url.origin !== "https://openrouter.ai")) return undefined;
    if (url.protocol !== "https:" && !(useLocal && url.protocol === "http:")) return undefined;
  } catch { return undefined; }
  return async (input) => {
    const response = await request(url, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model, temperature: 0.2, max_tokens: 3500,
        messages: [
          { role: "system", content: input.instructions },
          { role: "user", content: JSON.stringify(input.input) },
        ],
        response_format: { type: "json_schema", json_schema: { name: input.name, strict: true, schema: input.jsonSchema } },
      }),
    });
    if (!response.ok) throw new Error(`TREND_DRAFT_PROVIDER_HTTP_${response.status}`);
    const body = JSON.parse(await readBoundedText(response, 1_000_000));
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("TREND_DRAFT_PROVIDER_INVALID_RESPONSE");
    return JSON.parse(content);
  };
}
