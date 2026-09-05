import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BEDROCK_MEME_STUDIO_DEFAULT_REGION,
  BEDROCK_MEME_STUDIO_ERROR,
  BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS,
  BEDROCK_MEME_STUDIO_MODEL_ID,
  BEDROCK_MEME_STUDIO_RESERVED_INPUT_TOKENS,
  BEDROCK_MEME_STUDIO_TEMPERATURE,
  createBedrockMemeStudioClient,
  generateBedrockMemeConcepts,
} from "@/lib/meme-studio-bedrock.server";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const input = { topic: "월요일 출근", tone: "sarcastic", format: "caption", country: "US" } as const;
const concepts = [0, 1, 2].map((index) => ({
  country_code: "US" as const,
  headline: `제목 ${index}`,
  caption: `캡션 ${index}`,
  local_caption: `Local caption ${index}`,
  cultural_anchor: `미국 직장인의 월요일 업무 루틴 ${index}`,
  visual_brief: "텅 빈 머그컵과 노트북",
  why_it_works: "반전이 있어서 웃긴다.",
  usage_context: "단체 채팅방에서 쓴다.",
}));

function response(body: unknown = { concepts }) {
  return {
    output: { message: { content: [{ toolUse: { name: "submit_meme_concepts", input: body } }] } },
    usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
  };
}

function harness(outputs: unknown[] = [response()]) {
  const events: string[] = [];
  const send = vi.fn(async (command) => {
    events.push(command instanceof ConverseCommand ? "converse" : "unknown");
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const reserveCost = vi.fn(async () => { events.push("reserve"); });
  return { client: { send }, reserveCost, events };
}

beforeEach(() => vi.clearAllMocks());

describe("Bedrock Meme Studio", () => {
  it("pins the global Claude Sonnet 5 inference profile", () => {
    expect(BEDROCK_MEME_STUDIO_MODEL_ID).toBe("global.anthropic.claude-sonnet-5");
  });

  it("requires the explicit enable flag", async () => {
    const h = harness();
    await expect(generateBedrockMemeConcepts(input, { ...h, env: {} }))
      .rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.disabled });
    expect(h.client.send).not.toHaveBeenCalled();
  });

  it("uses Vercel OIDC credentials only when a role ARN exists", () => {
    const createClient = vi.fn((config) => ({ send: vi.fn(), config }));
    const credentials = vi.fn(() => vi.fn());
    const oidc = createBedrockMemeStudioClient({
      env: { VERCEL: "1", AWS_ROLE_ARN: "arn:aws:iam::123:role/memecatch" },
      createClient,
      oidcCredentialsProvider: credentials,
    });
    expect(credentials).toHaveBeenCalledWith({
      roleArn: "arn:aws:iam::123:role/memecatch",
      clientConfig: { region: BEDROCK_MEME_STUDIO_DEFAULT_REGION },
    });
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      credentials: expect.any(Function),
      maxAttempts: 1,
      region: BEDROCK_MEME_STUDIO_DEFAULT_REGION,
    }));
    expect(oidc).toBeTruthy();

    createClient.mockClear();
    credentials.mockClear();
    createBedrockMemeStudioClient({
      env: { AWS_ROLE_ARN: "arn:aws:iam::123:role/local" },
      createClient,
      oidcCredentialsProvider: credentials,
    });
    expect(credentials).not.toHaveBeenCalled();
    expect(createClient).toHaveBeenCalledWith({
      credentials: undefined,
      maxAttempts: 1,
      region: BEDROCK_MEME_STUDIO_DEFAULT_REGION,
    });

    createClient.mockClear();
    expect(() => createBedrockMemeStudioClient({
      env: { VERCEL: "1" },
      createClient,
      oidcCredentialsProvider: credentials,
    })).toThrow(expect.objectContaining({ code: BEDROCK_MEME_STUDIO_ERROR.oidcRoleRequired }));
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not reserve budget when Vercel OIDC role configuration is missing", async () => {
    const reserveCost = vi.fn();
    await expect(generateBedrockMemeConcepts(input, {
      reserveCost,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true", VERCEL: "1" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.oidcRoleRequired });
    expect(reserveCost).not.toHaveBeenCalled();
  });

  it("reserves the bounded worst case, then calls Converse once on the exact model", async () => {
    const h = harness();
    const result = await generateBedrockMemeConcepts(input, {
      ...h,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    });
    expect(h.events).toEqual(["reserve", "converse"]);
    expect(h.client.send).toHaveBeenCalledOnce();
    expect(h.client.send.mock.calls[0][0]).toBeInstanceOf(ConverseCommand);
    expect(h.client.send.mock.calls[0][0].input).toMatchObject({
      modelId: BEDROCK_MEME_STUDIO_MODEL_ID,
      inferenceConfig: {
        maxTokens: BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS,
        temperature: BEDROCK_MEME_STUDIO_TEMPERATURE,
      },
      toolConfig: {
        toolChoice: { tool: { name: "submit_meme_concepts" } },
        tools: [{ toolSpec: { name: "submit_meme_concepts" } }],
      },
    });
    const serializedRequest = JSON.stringify(h.client.send.mock.calls[0][0].input);
    expect(serializedRequest).toContain("미국");
    expect(serializedRequest).toContain("English");
    expect(serializedRequest).toContain('"enum":["US"]');
    expect(h.client.send.mock.calls[0][0].input.toolConfig?.tools[0].toolSpec?.inputSchema.json)
      .not.toHaveProperty("additionalProperties");
    expect(serializedRequest).toContain("shareable punchlines");
    expect(serializedRequest).toContain("reject and replace topic drift");
    expect(serializedRequest).toContain("Never introduce a different activity");
    expect(serializedRequest).toContain("expectation-versus-reality");
    expect(serializedRequest).toContain("Do not add sports");
    expect(serializedRequest).toContain("swapping in another country name");
    expect(serializedRequest).toContain("Korean headline containing Hangul");
    expect(serializedRequest).toContain("production-ready art direction");
    expect(serializedRequest).toContain("visually and comedically distinct");
    const reservedNanoUsd = BEDROCK_MEME_STUDIO_RESERVED_INPUT_TOKENS * 3_000 + 2_048 * 15_000;
    expect(h.reserveCost).toHaveBeenCalledWith(reservedNanoUsd);
    expect(result).toEqual({
      concepts,
      usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
      reservedNanoUsd,
    });
  });

  it("requires one forced tool result containing exactly three strict concepts", async () => {
    const invalid = harness([response({ concepts: concepts.slice(0, 2) })]);
    await expect(generateBedrockMemeConcepts(input, {
      ...invalid,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidResponse });
  });

  it("rejects a concept for a different country without another provider call", async () => {
    const mismatch = harness([response({
      concepts: concepts.map((concept, index) => index === 1
        ? { ...concept, country_code: "JP" }
        : concept),
    })]);
    await expect(generateBedrockMemeConcepts(input, {
      ...mismatch,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidResponse });
    expect(mismatch.client.send).toHaveBeenCalledOnce();
  });

  it("rejects foreign concepts without Korean fields or with duplicated localization", async () => {
    const englishOnly = harness([response({
      concepts: concepts.map((concept) => ({
        ...concept,
        headline: "English headline",
        caption: "English caption",
        cultural_anchor: "workplace video calls",
        visual_brief: "a laptop",
        why_it_works: "shared experience",
        usage_context: "group chat",
      })),
    })]);
    await expect(generateBedrockMemeConcepts(input, {
      ...englishOnly,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidResponse });

    const duplicated = harness([response({
      concepts: concepts.map((concept) => ({
        ...concept,
        local_caption: concept.caption,
      })),
    })]);
    await expect(generateBedrockMemeConcepts(input, {
      ...duplicated,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidResponse });
  });

  it("rejects duplicate captions or cultural anchors", async () => {
    for (const field of ["caption", "cultural_anchor"] as const) {
      const duplicated = harness([response({
        concepts: concepts.map((concept, index) => index === 2
          ? { ...concept, [field]: concepts[0][field] }
          : concept),
      })]);
      await expect(generateBedrockMemeConcepts(input, {
        ...duplicated,
        env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
      })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidResponse });
      expect(duplicated.client.send).toHaveBeenCalledOnce();
    }
  });

  it("fails closed on invalid rates before any provider call", async () => {
    const h = harness();
    await expect(generateBedrockMemeConcepts(input, {
      ...h,
      env: {
        BEDROCK_MEME_STUDIO_ENABLED: "true",
        BEDROCK_MEME_STUDIO_INPUT_NANO_USD_PER_TOKEN: "1000001",
      },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidRate });
    expect(h.client.send).not.toHaveBeenCalled();

    await expect(generateBedrockMemeConcepts(input, {
      ...h,
      env: {
        BEDROCK_MEME_STUDIO_ENABLED: "true",
        BEDROCK_MEME_STUDIO_OUTPUT_NANO_USD_PER_TOKEN: "14999",
      },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidRate });
    expect(h.client.send).not.toHaveBeenCalled();
  });

  it("stops after budget rejection and never calls Converse", async () => {
    const h = harness([]);
    h.reserveCost.mockRejectedValueOnce(new Error("private budget detail"));
    await expect(generateBedrockMemeConcepts(input, {
      ...h,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.budgetRejected });
    expect(h.events).toEqual([]);
    expect(h.client.send).not.toHaveBeenCalled();
  });

  it("redacts provider failures into stable codes and never retries", async () => {
    const generationFailure = harness([new Error("provider secret")]);
    await expect(generateBedrockMemeConcepts(input, {
      ...generationFailure,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toEqual(expect.objectContaining({
      code: BEDROCK_MEME_STUDIO_ERROR.generationFailed,
      message: BEDROCK_MEME_STUDIO_ERROR.generationFailed,
    }));
    expect(generationFailure.client.send).toHaveBeenCalledOnce();
  });
});
