import "server-only";

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type BedrockRuntimeClientConfig,
  type ConverseCommandInput,
} from "@aws-sdk/client-bedrock-runtime";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { z } from "zod";
import { getMemeCountry, isMemeCountryCode, type MemeCountryCode } from "@/lib/meme-country";

export const BEDROCK_MEME_STUDIO_MODEL_ID = "global.anthropic.claude-haiku-4-5-20251001-v1:0";
export const BEDROCK_MEME_STUDIO_DEFAULT_REGION = "ap-northeast-2";
export const BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS = 2_048;
export const BEDROCK_MEME_STUDIO_RESERVED_INPUT_TOKENS = 4_096;
export const BEDROCK_MEME_STUDIO_TEMPERATURE = 0.4;

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
  country_code: MemeCountryCode;
  headline: string;
  caption: string;
  local_caption: string;
  cultural_anchor: string;
  visual_brief: string;
  why_it_works: string;
  usage_context: string;
};

export type BedrockMemeStudioInput = {
  topic: string;
  tone: "wholesome" | "sarcastic" | "absurd" | "hype";
  format: "image-macro" | "reaction" | "caption";
  country: MemeCountryCode;
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

const koreanText = (max: number) => z.string().trim().min(1).max(max)
  .refine((value) => /[가-힣]/.test(value));

const conceptSchema = z.object({
  country_code: z.string().refine(isMemeCountryCode),
  headline: koreanText(80),
  caption: koreanText(220),
  local_caption: z.string().trim().min(1).max(220),
  cultural_anchor: koreanText(220),
  visual_brief: koreanText(220),
  why_it_works: koreanText(220),
  usage_context: koreanText(220),
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

const DEFAULT_INPUT_RATE_NANO_USD = 1_000;
const DEFAULT_OUTPUT_RATE_NANO_USD = 5_000;
const MAX_RATE_NANO_USD_PER_TOKEN = 1_000_000;

const TOOL_NAME = "submit_meme_concepts";
const COUNTRY_BRIEFS: Record<MemeCountryCode, string> = {
  KR: "Keep the exact topic. Only when it naturally fits, use one concrete Korean detail such as KakaoTalk timing, delivery apps, subway timing, or convenience-store routines.",
  US: "Keep the exact topic. Only when it naturally fits, use one concrete U.S. detail such as time-zone overlap, Slack status, calendar holds, or after-hours work boundaries. Do not add sports, school, road trips, or coffee unless the topic asks for them.",
  JP: "Keep the exact topic. Only when it naturally fits, use one concrete Japanese detail such as LINE timing, last-train pressure, convenience-store routines, or office etiquette.",
  GB: "Keep the exact topic. Only when it naturally fits, use one concrete British detail such as rail timing, queues, weather understatement, or dry group-chat phrasing.",
  BR: "Keep the exact topic. Only when it naturally fits, use one concrete Brazilian detail such as WhatsApp group dynamics, Pix timing, bus commuting, or expressive reaction style. Do not add football unless the topic asks for it.",
  MX: "Keep the exact topic. Only when it naturally fits, use one concrete Mexican detail such as family WhatsApp timing, commuting, or weekend group plans. Do not add food unless the topic asks for it.",
  CN: "Keep the exact topic. Only when it naturally fits, use one concrete Chinese digital-life detail such as WeChat group timing, delivery apps, or online-shopping routines.",
  TW: "Keep the exact topic. Only when it naturally fits, use one concrete Taiwanese detail such as LINE timing, scooter commuting, or convenience-store routines.",
  DE: "Keep the exact topic. Only when it naturally fits, use one concrete German detail such as calendar booking, rail timing, appointment punctuality, or work-chat boundaries.",
  FR: "Keep the exact topic. Only when it naturally fits, use one concrete French detail such as group-chat timing, commuting, or lunch-break boundaries. Do not add cafes or bakeries unless the topic asks for them.",
};
const SYSTEM_PROMPT = [
  "You create three original, culturally specific meme concepts for MemeCatch.",
  "Every concept must center on the requested topic; reject and replace topic drift before submitting.",
  "Use a concrete everyday or internet-culture anchor from the requested country and give each concept a distinct setup and punchline.",
  "Write captions as short, shareable punchlines, not explanations or cultural summaries.",
  "caption must be a natural Korean adaptation of the joke, not a literal translation; local_caption must sound native in the requested local language.",
  "headline, caption, cultural_anchor, visual_brief, why_it_works, and usage_context MUST be written in Korean and MUST contain Hangul. local_caption is the only field written in the requested local language.",
  "For non-Korean countries, caption and local_caption must not be identical.",
  "Silently reject and replace any concept that would still work unchanged after swapping in another country name.",
  "Do not restate the title as the joke. Avoid stereotypes, invented facts, known meme captions or templates, brands, celebrities, copyrighted characters, protected-group targeting, and harassment.",
  `Submit exactly three concepts through the forced ${TOOL_NAME} tool and do not answer with prose.`,
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
  if (
    !topic || topic.length > 120 || !toneValues.has(input.tone) ||
    !formatValues.has(input.format) || !isMemeCountryCode(input.country)
  ) {
    throw new BedrockMemeStudioError(BEDROCK_MEME_STUDIO_ERROR.invalidInput);
  }
  return { ...input, topic };
}

function requestFor(input: BedrockMemeStudioInput): ConverseCommandInput {
  const country = getMemeCountry(input.country);
  if (!country) throw new BedrockMemeStudioError(BEDROCK_MEME_STUDIO_ERROR.invalidInput);
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
          country_code: country.code,
          country_name_ko: country.label,
          local_language: country.localLanguage,
          country_brief: COUNTRY_BRIEFS[country.code],
          quality_bar: [
            "All three concepts must stay inside the exact situation described by topic. Never introduce a different activity, setting, or audience.",
            "Use these joke mechanics in array order: expectation-versus-reality, visual before-versus-after, then deadpan escalation.",
            "Each Korean caption must be at most 120 characters with a clear setup and surprising punchline.",
            "Do not put a country name or demonym in the headline or caption merely to signal localization.",
            "Keep the cultural detail observational and topic-relevant, never a claim about all people in the country.",
            "The cultural anchor must name a concrete local behavior or artifact, not a vague idea such as time management.",
            "Make the Korean adaptation immediately usable without explaining the translation.",
          ],
          count: 3,
        }),
      }],
    }],
    inferenceConfig: {
      maxTokens: BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS,
      temperature: BEDROCK_MEME_STUDIO_TEMPERATURE,
    },
    toolConfig: {
      tools: [{
        toolSpec: {
          name: TOOL_NAME,
          description: "Submit exactly three original meme concepts for the requested country.",
          inputSchema: {
            json: {
              type: "object",
              required: ["concepts"],
              properties: {
                concepts: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "country_code", "headline", "caption", "local_caption",
                      "cultural_anchor", "visual_brief", "why_it_works", "usage_context",
                    ],
                    properties: {
                      country_code: { type: "string", enum: [country.code] },
                      headline: { type: "string", minLength: 1, maxLength: 80, description: "Korean headline containing Hangul." },
                      caption: { type: "string", minLength: 1, maxLength: 220, description: "Natural Korean adaptation containing Hangul, with a clear setup and punchline." },
                      local_caption: { type: "string", minLength: 1, maxLength: 220, description: `Native ${country.localLanguage} version of the joke. For non-Korean countries it must differ from caption.` },
                      cultural_anchor: { type: "string", minLength: 1, maxLength: 220, description: "Korean explanation of the specific local cultural anchor, containing Hangul." },
                      visual_brief: { type: "string", minLength: 1, maxLength: 220, description: "Korean description of an original, brand-free visual, containing Hangul." },
                      why_it_works: { type: "string", minLength: 1, maxLength: 220, description: "Korean explanation of why the joke works, containing Hangul." },
                      usage_context: { type: "string", minLength: 1, maxLength: 220, description: "Korean usage context containing Hangul." },
                    },
                  },
                },
              },
            },
          },
        },
      }],
      toolChoice: { tool: { name: TOOL_NAME } },
    },
  };
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
  const inputRate = rate(env, "BEDROCK_MEME_STUDIO_INPUT_NANO_USD_PER_TOKEN", DEFAULT_INPUT_RATE_NANO_USD);
  const outputRate = rate(env, "BEDROCK_MEME_STUDIO_OUTPUT_NANO_USD_PER_TOKEN", DEFAULT_OUTPUT_RATE_NANO_USD);
  const bedrock = client ?? createBedrockMemeStudioClient({ env });
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
    output?: { message?: { content?: Array<{ toolUse?: { name?: string; input?: unknown } }> } };
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  };
  const toolUses = result.output?.message?.content
    ?.flatMap((block) => block.toolUse ? [block.toolUse] : []) ?? [];
  const parsed = toolUses.length === 1 && toolUses[0].name === TOOL_NAME
    ? responseSchema.safeParse(toolUses[0].input)
    : null;
  if (
    !parsed?.success ||
    parsed.data.concepts.some((concept) =>
      concept.country_code !== input.country ||
      (input.country !== "KR" && concept.caption.trim() === concept.local_caption.trim())
    )
  ) {
    throw error(BEDROCK_MEME_STUDIO_ERROR.invalidResponse);
  }

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
