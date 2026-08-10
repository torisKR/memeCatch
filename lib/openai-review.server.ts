import "server-only";

export const OPENAI_REVIEW_MODEL = "gpt-5.6-sol";
export const OPENAI_REVIEW_REASONING_EFFORT = "high" as const;

type JsonSchema = Readonly<Record<string, unknown>>;

type StructuredReviewRequest = {
  name: string;
  schema: JsonSchema;
  instructions: string;
  input: string;
  maxOutputTokens?: number;
};

type JsonRecord = Record<string, unknown>;

export class OpenAiReviewError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "OpenAiReviewError";
    this.status = status;
  }
}

export function isOpenAiReviewConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAiReviewModel() {
  return OPENAI_REVIEW_MODEL;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function responseText(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    const itemRecord = asRecord(item);
    const content = itemRecord && Array.isArray(itemRecord.content) ? itemRecord.content : [];
    for (const block of content) {
      const blockRecord = asRecord(block);
      if (
        blockRecord?.type === "output_text" &&
        typeof blockRecord.text === "string" &&
        blockRecord.text.trim()
      ) {
        return blockRecord.text.trim();
      }
    }
  }
  return null;
}

function errorMessage(payload: unknown) {
  const record = asRecord(payload);
  const error = record ? asRecord(record.error) : null;
  return typeof error?.message === "string" ? error.message : null;
}

export async function requestOpenAiStructured<T>({
  name,
  schema,
  instructions,
  input,
  maxOutputTokens = 8_192,
}: StructuredReviewRequest): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAiReviewError("OPENAI_API_KEY 설정 필요");

  const configuredBaseUrl = process.env.OPENAI_REVIEW_BASE_URL?.trim();
  const baseUrl = (configuredBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiReviewModel(),
      reasoning: { effort: OPENAI_REVIEW_REASONING_EFFORT },
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name,
          strict: true,
          schema,
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const detail = errorMessage(payload);
    throw new OpenAiReviewError(
      `GPT 검수 호출에 실패했어요 (${response.status}).${detail ? ` ${detail.slice(0, 240)}` : ""}`,
      response.status,
    );
  }

  const text = responseText(payload);
  if (!text) throw new OpenAiReviewError("GPT 검수 응답이 비어 있어요. 다시 시도해 주세요.");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new OpenAiReviewError("GPT 검수 응답을 해석하지 못했어요. 다시 시도해 주세요.");
  }
}
