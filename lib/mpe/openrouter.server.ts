import { z } from "zod";
import { readBoundedText } from "../request-body.ts";

export const DEFAULT_MPE_MODEL = "stealth/ox-alpha";
export const OPENROUTER_DAILY_BUDGET_EXHAUSTED = "openrouter_daily_budget_exhausted";
export const OPENROUTER_BUDGET_RESERVATION_FAILED = "openrouter_budget_reservation_failed";

type JsonSchema = Readonly<Record<string, unknown>>;
type JsonRecord = Record<string, unknown>;
type ReserveRequest = () => Promise<void>;

const MAX_PROVIDER_ATTEMPTS = 3;
const MAX_STRUCTURE_ATTEMPTS = 2;
const MAX_TOTAL_PROVIDER_REQUESTS = 4;
const MAX_RETRY_DELAY_MS = 10_000;
const TRANSIENT_PROVIDER_STATUSES = new Set([502, 503, 504]);

const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
}).strict();

const ocrResponseSchema = z.object({
  segments: z.array(z.object({
    rawText: z.string().max(2000),
    normalizedText: z.string().max(2000),
    language: z.string().max(35).nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    boundingBox: boundingBoxSchema.nullable(),
  }).strict()).max(200),
}).strict();

export type MediaTextSegment = {
  origin: "ocr" | "asr";
  startMs: number;
  endMs: number;
  rawText: string;
  normalizedText: string;
  language: string | null;
  confidence: number | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
};

export function getMpeVisionModel() {
  const configured = process.env.OPENROUTER_MPE_MODEL?.trim();
  if (configured && configured !== DEFAULT_MPE_MODEL) {
    throw new Error(`OPENROUTER_MPE_MODEL must be ${DEFAULT_MPE_MODEL}`);
  }
  return DEFAULT_MPE_MODEL;
}

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function apiKey() {
  const value = process.env.OPENROUTER_API_KEY?.trim();
  if (!value) throw new Error("OPENROUTER_API_KEY 설정 필요");
  return value;
}

function baseUrl() {
  const configured = (process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (process.env.NODE_ENV === "production" && url.origin !== "https://openrouter.ai")
  ) throw new Error("invalid_openrouter_base_url");
  return url.toString().replace(/\/+$/, "");
}

export function classifyOpenRouterReservationError(error: unknown) {
  const record = asRecord(error);
  if ([record?.message, record?.code, record?.details]
    .some((value) => value === OPENROUTER_DAILY_BUDGET_EXHAUSTED)) {
    return OPENROUTER_DAILY_BUDGET_EXHAUSTED;
  }
  return OPENROUTER_BUDGET_RESERVATION_FAILED;
}

function sanitizeProviderText(value: unknown, secret: string) {
  const text = (typeof value === "string" ? value : JSON.stringify(value)) ?? "";
  return text
    .replaceAll(secret, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk-or-v1-|sk-)[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, 300);
}

function providerErrorDetails(payload: unknown, secret: string) {
  const error = asRecord(asRecord(payload)?.error);
  if (!error) return "";
  const message = typeof error.message === "string" ? sanitizeProviderText(error.message, secret) : "";
  const metadata = asRecord(error.metadata);
  const raw = metadata?.raw === undefined ? "" : sanitizeProviderText(metadata.raw, secret);
  return [message && `provider_message=${message}`, raw && `metadata_raw=${raw}`].filter(Boolean).join(" ");
}

function isRetryableRateLimit(payload: unknown) {
  const error = asRecord(asRecord(payload)?.error);
  const metadata = asRecord(error?.metadata);
  const values = [error?.message, metadata?.raw].filter((value): value is string => typeof value === "string");
  return values.some((value) => /(?:upstream_provider_)?shared[_ -]?pool|temporarily rate[- ]limited upstream/i.test(value));
}

function retryDelayMs(response: Response | null, attempt: number) {
  const retryAfter = response?.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS);
  }
  if (response?.status === 429) return Math.min(5_000 * (2 ** attempt), MAX_RETRY_DELAY_MS);
  return Math.min(250 * (2 ** attempt), 2_000);
}

async function wait(ms: number) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openRouterJson(
  path: string,
  body: JsonRecord,
  errorPrefix: string,
  timeoutMs: number,
  budget: { remaining: number },
  reserveRequest?: ReserveRequest,
) {
  const secret = apiKey();
  for (let attempt = 0; ; attempt += 1) {
    if (reserveRequest) {
      try {
        await reserveRequest();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === OPENROUTER_DAILY_BUDGET_EXHAUSTED
          || message === OPENROUTER_BUDGET_RESERVATION_FAILED) {
          throw new Error(message);
        }
        throw new Error(OPENROUTER_BUDGET_RESERVATION_FAILED);
      }
    }
    budget.remaining -= 1;
    let response: Response;
    try {
      response = await fetch(`${baseUrl()}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt < MAX_PROVIDER_ATTEMPTS - 1 && budget.remaining > 0) {
        await wait(retryDelayMs(null, attempt));
        continue;
      }
     const details = sanitizeProviderText(error instanceof Error ? error.message : error, secret);
     throw new Error(`${errorPrefix}:network_error${details ? ` ${details}` : ""}`);
   }
   const raw = await readBoundedText(response, 512 * 1024).catch(() => "");
    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) as unknown : null;
    } catch {
      payload = null;
    }
   const payloadRecord = asRecord(payload);
   const providerError = asRecord(payloadRecord?.error);

    if (response.ok) {
      if (providerError) {
        if (
          isRetryableRateLimit(payload)
          && attempt < MAX_PROVIDER_ATTEMPTS - 1
          && budget.remaining > 0
        ) {
          await wait(retryDelayMs(response, attempt));
          continue;
        }
        const details = providerErrorDetails(payload, secret);
        throw new Error(`${errorPrefix}:provider_error${details ? ` ${details}` : ""}`);
      }
      if (!payloadRecord) {
        if (attempt < MAX_PROVIDER_ATTEMPTS - 1 && budget.remaining > 0) {
          await wait(retryDelayMs(response, attempt));
          continue;
        }
        const snippet = sanitizeProviderText(raw, secret);
        throw new Error(`${errorPrefix}:invalid_json${snippet ? ` ${snippet}` : ""}`);
      }
      return payloadRecord;
    }
   if (
     (TRANSIENT_PROVIDER_STATUSES.has(response.status)
        || (response.status === 429 && isRetryableRateLimit(payload)))
      && attempt < MAX_PROVIDER_ATTEMPTS - 1
      && budget.remaining > 0
    ) {
      await wait(retryDelayMs(response, attempt));
      continue;
    }
    const details = providerErrorDetails(payload, secret);
    throw new Error(`${errorPrefix}:${response.status}${details ? ` ${details}` : ""}`);
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function responseContent(payload: unknown): string | null {
  const choices = asRecord(payload)?.choices;
  if (!Array.isArray(choices)) return null;
  const content = asRecord(asRecord(choices[0])?.message)?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function parseJsonObject(text: string, errorCode: string): JsonRecord {
  try {
    const parsed = JSON.parse(text) as unknown;
    const record = asRecord(parsed);
    if (record) return record;
  } catch {
  }

  const records: JsonRecord[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (start < 0) {
      if (character === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
      continue;
    }
    if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const record = asRecord(JSON.parse(text.slice(start, index + 1)) as unknown);
          if (record) records.push(record);
        } catch {
        }
        start = -1;
      }
    }
  }
  if (records.length === 1) return records[0];
  throw new Error(errorCode);
}

function structuredSystemMessage(name: string, schema: JsonSchema, instructions: string) {
  return `${name}\n${instructions}\nReturn one JSON object matching this schema:\n${JSON.stringify(schema)}`;
}

async function chatCompletion(
  body: JsonRecord,
  errorPrefix: string,
  budget: { remaining: number },
  reserveRequest?: ReserveRequest,
) {
  const payload = await openRouterJson("/chat/completions", body, errorPrefix, 90_000, budget, reserveRequest);
  const content = responseContent(payload);
  if (!content) throw new Error(`${errorPrefix}_empty`);
  return content;
}

function correctionBody(body: JsonRecord) {
  const messages = body.messages;
  if (!Array.isArray(messages)) return body;
  return {
    ...body,
    messages: [
      ...messages,
      {
        role: "system",
        content: "The previous response was invalid. Return exactly one JSON object matching the requested schema, with no prose or code fence.",
      },
    ],
  };
}

async function requestValidatedJson<T>(input: {
  body: JsonRecord;
  transportErrorPrefix: string;
  invalidErrorCode: string;
  validate: (record: JsonRecord) => T | null;
  reserveRequest?: ReserveRequest;
}) {
  const budget = { remaining: MAX_TOTAL_PROVIDER_REQUESTS };
  const body = {
    ...input.body,
    model: getMpeVisionModel(),
    provider: {
      allow_fallbacks: false,
      max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
    },
  };
  for (let attempt = 0; attempt < MAX_STRUCTURE_ATTEMPTS; attempt += 1) {
    if (budget.remaining === 0) break;
    const content = await chatCompletion(
      attempt === 0 ? body : correctionBody(body),
      input.transportErrorPrefix,
      budget,
      input.reserveRequest,
    );
    try {
      const validated = input.validate(parseJsonObject(content, input.invalidErrorCode));
      if (validated !== null) return validated;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== input.invalidErrorCode) throw error;
    }
  }
  throw new Error(input.invalidErrorCode);
}

const OCR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["segments"],
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rawText", "normalizedText", "language", "confidence", "boundingBox"],
        properties: {
          rawText: { type: "string" },
          normalizedText: { type: "string" },
          language: { type: ["string", "null"] },
          confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          boundingBox: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["x", "y", "width", "height"],
                properties: {
                  x: { type: "number", minimum: 0, maximum: 1 },
                  y: { type: "number", minimum: 0, maximum: 1 },
                  width: { type: "number", minimum: 0, maximum: 1 },
                  height: { type: "number", minimum: 0, maximum: 1 },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
    },
  },
} as const;

export async function recognizeImageText(input: {
  bytes: Uint8Array;
  mimeType: string;
  frameMs: number;
  reserveRequest?: ReserveRequest;
}): Promise<MediaTextSegment[]> {
  const parsed = await requestValidatedJson({
    body: {
      response_format: { type: "json_object" },
      max_tokens: 2_000,
      messages: [
        {
          role: "system",
          content: structuredSystemMessage(
            "mpe_ocr_segments",
            OCR_JSON_SCHEMA,
            "이미지에 실제로 보이는 글자만 전사하세요. 추측하거나 번역하지 마세요.",
          ),
        },
        {
          role: "user",
          content: [
            { type: "text", text: "화면의 모든 문구를 읽고 정규화한 결과와 0~1 좌표를 반환하세요." },
            {
              type: "image_url",
              image_url: { url: `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}` },
            },
          ],
        },
      ],
    },
    transportErrorPrefix: "openrouter_ocr_failed",
    invalidErrorCode: "openrouter_ocr_invalid",
    reserveRequest: input.reserveRequest,
    validate: (record) => {
      const result = ocrResponseSchema.safeParse(record);
      return result.success ? result.data : null;
    },
  });
  return parsed.segments.filter((segment) => segment.rawText.trim()).map((segment) => ({
    ...segment,
    origin: "ocr",
    startMs: input.frameMs,
    endMs: input.frameMs,
  }));
}

export async function requestOpenRouterStructured<T>(input: {
  name: string;
  schema: JsonSchema;
  instructions: string;
  input: string;
  maxOutputTokens?: number;
  reserveRequest?: ReserveRequest;
}): Promise<T> {
  return requestValidatedJson<T>({
    body: {
      response_format: { type: "json_object" },
      max_tokens: input.maxOutputTokens ?? 4_096,
      messages: [
        { role: "system", content: structuredSystemMessage(input.name, input.schema, input.instructions) },
        { role: "user", content: input.input },
      ],
    },
    transportErrorPrefix: "openrouter_structured_failed",
    invalidErrorCode: "openrouter_structured_invalid",
    reserveRequest: input.reserveRequest,
    validate: (record) => record as T,
  });
}
