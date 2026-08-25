import { z } from "zod";

export const DEFAULT_MPE_MODEL = "stealth/ox-alpha";

type JsonSchema = Readonly<Record<string, unknown>>;
type JsonRecord = Record<string, unknown>;

const MAX_PROVIDER_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 10_000;
const TRANSIENT_PROVIDER_STATUSES = new Set([429, 502, 503, 504]);

const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
}).strict();

const ocrResponseSchema = z.object({
  segments: z.array(z.object({
    rawText: z.string(),
    normalizedText: z.string(),
    language: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    boundingBox: boundingBoxSchema.nullable(),
  }).strict()),
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
  return (process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
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

function retryDelayMs(response: Response | null, attempt: number) {
  const retryAfter = response?.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS);
  }
  return Math.min(250 * (2 ** attempt), 2_000);
}

async function wait(ms: number) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openRouterJson(path: string, body: JsonRecord, errorPrefix: string, timeoutMs: number) {
  const secret = apiKey();
  for (let attempt = 0; ; attempt += 1) {
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
      if (attempt < MAX_PROVIDER_ATTEMPTS - 1) {
        await wait(retryDelayMs(null, attempt));
        continue;
      }
      const details = sanitizeProviderText(error instanceof Error ? error.message : error, secret);
      throw new Error(`${errorPrefix}:network_error${details ? ` ${details}` : ""}`);
    }
    const payload = (await response.json().catch(() => null)) as unknown;
    if (response.ok) return payload;
    if (TRANSIENT_PROVIDER_STATUSES.has(response.status) && attempt < MAX_PROVIDER_ATTEMPTS - 1) {
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
  throw new Error(errorCode);
}

function structuredSystemMessage(name: string, schema: JsonSchema, instructions: string) {
  return `${name}\n${instructions}\nReturn one JSON object matching this schema:\n${JSON.stringify(schema)}`;
}

async function chatCompletion(body: JsonRecord, errorPrefix: string) {
  const payload = await openRouterJson("/chat/completions", body, errorPrefix, 90_000);
  const content = responseContent(payload);
  if (!content) throw new Error(`${errorPrefix}_empty`);
  return content;
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
}): Promise<MediaTextSegment[]> {
  const content = await chatCompletion({
    model: getMpeVisionModel(),
    response_format: { type: "json_object" },
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
  }, "openrouter_ocr_failed");
  const parsed = ocrResponseSchema.safeParse(parseJsonObject(content, "openrouter_ocr_invalid"));
  if (!parsed.success) throw new Error("openrouter_ocr_invalid");
  return parsed.data.segments.filter((segment) => segment.rawText.trim()).map((segment) => ({
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
}): Promise<T> {
  const content = await chatCompletion({
    model: getMpeVisionModel(),
    response_format: { type: "json_object" },
    max_tokens: input.maxOutputTokens ?? 4_096,
    messages: [
      { role: "system", content: structuredSystemMessage(input.name, input.schema, input.instructions) },
      { role: "user", content: input.input },
    ],
  }, "openrouter_structured_failed");
  return parseJsonObject(content, "openrouter_structured_invalid") as T;
}
