import "server-only";

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type BedrockRuntimeClientConfig,
  type ConverseCommandInput,
} from "@aws-sdk/client-bedrock-runtime";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { z } from "zod";

export const BEDROCK_MEME_STUDIO_MODEL_ID = "apac.amazon.nova-micro-v1:0";
export const BEDROCK_MEME_STUDIO_DEFAULT_REGION = "ap-northeast-2";
export const BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS = 1_024;
export const BEDROCK_MEME_STUDIO_RESERVED_INPUT_TOKENS = 4_096;

export const BEDROCK_MEME_STUDIO_ERROR = {
  disabled: "bedrock_meme_studio_disabled",
  oidcRoleRequired: "bedrock_meme_studio_oidc_role_required",
  invalidInput: "bedrock_meme_studio_invalid_input",
  invalidRate: "bedrock_meme_studio_invalid_rate",
  budgetRejected: "bedrock_meme_studio_budget_rejected",
  generationFailed: "bedrock_meme_studio_generation_failed",
  invalidResponse: "bedrock_meme_studio_invalid_response",
} as const;

type BedrockMemeStudioErrorCode =
  (typeof BEDROCK_MEME_STUDIO_ERROR)[keyof typeof BEDROCK_MEME_STUDIO_ERROR];

export class BedrockMemeStudioError extends Error {
  constructor(public readonly code: BedrockMemeStudioErrorCode) {
    super(code);
    this.name = "BedrockMemeStudioError";
  }
}

export type BedrockMemeConcept = {
  headline: string;
  caption: string;
  why_it_works: string;
  usage_context: string;
};

export type BedrockMemeStudioInput = {
  topic: string;
  tone: "wholesome" | "sarcastic" | "absurd" | "hype";
  format: "image-macro" | "reaction" | "caption";
};

type Environment = Record<string, string | undefined>;
type BedrockCommand = ConverseCommand;
type BedrockClient = { send(command: BedrockCommand): Promise<unknown> };

type Dependencies = {
  reserveCost(nanoUsd: number): Promise<void>;
  env?: Environment;
  client?: BedrockClient;
};

type ClientDependencies = {
  env?: Environment;
  createClient?: (config: BedrockRuntimeClientConfig) => BedrockClient;
  oidcCredentialsProvider?: typeof awsCredentialsProvider;
};

const conceptSchema = z.object({
  headline: z.string().trim().min(1).max(80),
  caption: z.string().trim().min(1).max(220),
  why_it_works: z.string().trim().min(1).max(220),
  usage_context: z.string().trim().min(1).max(220),
}).strict();

const responseSchema = z.object({
  concepts: z.array(conceptSchema).length(3),
}).strict();

const toneValues = new Set<BedrockMemeStudioInput["tone"]>([
  "wholesome", "sarcastic", "absurd", "hype",
]);
const formatValues = new Set<BedrockMemeStudioInput["format"]>([
  "image-macro", "reaction", "caption",
]);

const DEFAULT_INPUT_RATE_NANO_USD = 50;
const DEFAULT_OUTPUT_RATE_NANO_USD = 200;
const MAX_RATE_NANO_USD_PER_TOKEN = 1_000_000;

const SYSTEM_PROMPT = [
  "You create original Korean meme copy for MemeCatch.",
  "Return JSON only with one object named concepts containing exactly 3 distinct objects.",
  "Each object must contain headline, caption, why_it_works, and usage_context strings.",
  "Do not quote real people, copy known meme captions, invent facts, target protected groups, or include harassment.",
  "Keep captions ready to publish and under 220 characters. Do not use Markdown.",
].join(" ");

function enabled(env: Environment) {
  return env.BEDROCK_MEME_STUDIO_ENABLED === "true";
}

export function isBedrockMemeStudioEnabled(env: Environment = process.env) {
  return enabled(env);
}

function rate(env: Environment, name: string, fallback: number) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < fallback || value > MAX_RATE_NANO_USD_PER_TOKEN) {
    throw new BedrockMemeStudioError(BEDROCK_MEME_STUDIO_ERROR.invalidRate);
  }
  return value;
}

function normalizedInput(input: BedrockMemeStudioInput): BedrockMemeStudioInput {
  const topic = input.topic.trim().replace(/\s+/g, " ");
  if (!topic || topic.length > 120 || !toneValues.has(input.tone) || !formatValues.has(input.format)) {
    throw new BedrockMemeStudioError(BEDROCK_MEME_STUDIO_ERROR.invalidInput);
  }
  return { ...input, topic };
}

function requestFor(input: BedrockMemeStudioInput): ConverseCommandInput {
  return {
    modelId: BEDROCK_MEME_STUDIO_MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{
      role: "user",
      content: [{
        text: JSON.stringify({
          topic: input.topic,
          tone: input.tone,
          format: input.format,
          count: 3,
        }),
      }],
    }],
    inferenceConfig: {
      maxTokens: BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS,
      temperature: 0.8,
      topP: 0.9,
    },
  };
}

function parsedJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try {
    return JSON.parse(fenced?.[1] ?? trimmed);
  } catch {
    throw new BedrockMemeStudioError(BEDROCK_MEME_STUDIO_ERROR.invalidResponse);
  }
}

function error(code: BedrockMemeStudioErrorCode): BedrockMemeStudioError {
  return new BedrockMemeStudioError(code);
}

function safeTokenCount(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;
}

export function createBedrockMemeStudioClient({
  env = process.env,
  createClient = (config) => new BedrockRuntimeClient(config),
  oidcCredentialsProvider = awsCredentialsProvider,
}: ClientDependencies = {}): BedrockClient {
  const region = env.AWS_REGION?.trim() || BEDROCK_MEME_STUDIO_DEFAULT_REGION;
  const roleArn = env.AWS_ROLE_ARN?.trim();
  if (env.VERCEL && !roleArn) throw error(BEDROCK_MEME_STUDIO_ERROR.oidcRoleRequired);
  const credentials = env.VERCEL && roleArn
    ? oidcCredentialsProvider({ roleArn, clientConfig: { region } })
    : undefined;
  return createClient({ region, credentials, maxAttempts: 1 });
}

export async function generateBedrockMemeConcepts(
  input: BedrockMemeStudioInput,
  { reserveCost, env = process.env, client }: Dependencies,
): Promise<{
  concepts: BedrockMemeConcept[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  reservedNanoUsd: number;
}> {
  if (!enabled(env)) throw error(BEDROCK_MEME_STUDIO_ERROR.disabled);

  const request = requestFor(normalizedInput(input));
  const inputRate = rate(env, "BEDROCK_NOVA_MICRO_INPUT_NANO_USD_PER_TOKEN", DEFAULT_INPUT_RATE_NANO_USD);
  const outputRate = rate(env, "BEDROCK_NOVA_MICRO_OUTPUT_NANO_USD_PER_TOKEN", DEFAULT_OUTPUT_RATE_NANO_USD);
  const bedrock = client ?? createBedrockMemeStudioClient({ env });
  // ponytail: Nova Micro APAC rejects CountTokens; this bounded over-reservation stays until the model supports it.
  const reservedNanoUsd = BEDROCK_MEME_STUDIO_RESERVED_INPUT_TOKENS * inputRate
    + BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS * outputRate;
  try {
    await reserveCost(reservedNanoUsd);
  } catch {
    throw error(BEDROCK_MEME_STUDIO_ERROR.budgetRejected);
  }

  let response: unknown;
  try {
    response = await bedrock.send(new ConverseCommand(request));
  } catch {
    throw error(BEDROCK_MEME_STUDIO_ERROR.generationFailed);
  }

  const result = response as {
    output?: { message?: { content?: Array<{ text?: string }> } };
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  };
  const text = result.output?.message?.content
    ?.map((block) => block.text ?? "")
    .join("")
    .trim();
  const parsed = text ? responseSchema.safeParse(parsedJson(text)) : null;
  if (!parsed?.success) throw error(BEDROCK_MEME_STUDIO_ERROR.invalidResponse);

  const usage = result.usage;
  const inputTokens = safeTokenCount(usage?.inputTokens);
  const outputTokens = safeTokenCount(usage?.outputTokens);
  const totalTokens = safeTokenCount(usage?.totalTokens) || inputTokens + outputTokens;
  return {
    concepts: parsed.data.concepts,
    usage: { inputTokens, outputTokens, totalTokens },
    reservedNanoUsd,
  };
}
