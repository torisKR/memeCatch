import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BEDROCK_MEME_STUDIO_DEFAULT_REGION,
  BEDROCK_MEME_STUDIO_ERROR,
  BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS,
  BEDROCK_MEME_STUDIO_MODEL_ID,
  createBedrockMemeStudioClient,
  generateBedrockMemeConcepts,
} from "@/lib/meme-studio-bedrock.server";
import { ConverseCommand, CountTokensCommand } from "@aws-sdk/client-bedrock-runtime";

const input = { topic: "월요일 출근", tone: "sarcastic", format: "caption" } as const;
const concepts = [0, 1, 2].map((index) => ({
  headline: `제목 ${index}`,
  caption: `캡션 ${index}`,
  why_it_works: "반전이 있어서 웃긴다.",
  usage_context: "단체 채팅방에서 쓴다.",
}));

function response(body: unknown = { concepts }) {
  return {
    output: { message: { content: [{ text: JSON.stringify(body) }] } },
    usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
  };
}

function harness(outputs: unknown[] = [{ inputTokens: 120 }, response()]) {
  const events: string[] = [];
  const send = vi.fn(async (command) => {
    events.push(command instanceof CountTokensCommand ? "count" : "converse");
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const reserveCost = vi.fn(async () => { events.push("reserve"); });
  return { client: { send }, reserveCost, events };
}

beforeEach(() => vi.clearAllMocks());

describe("Bedrock Meme Studio", () => {
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

  it("counts, reserves the worst case, then calls Converse once on the exact model", async () => {
    const h = harness();
    const result = await generateBedrockMemeConcepts(input, {
      ...h,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    });
    expect(h.events).toEqual(["count", "reserve", "converse"]);
    expect(h.client.send).toHaveBeenCalledTimes(2);
    expect(h.client.send.mock.calls[0][0]).toBeInstanceOf(CountTokensCommand);
    expect(h.client.send.mock.calls[0][0].input.modelId).toBe(BEDROCK_MEME_STUDIO_MODEL_ID);
    expect(h.client.send.mock.calls[1][0]).toBeInstanceOf(ConverseCommand);
    expect(h.client.send.mock.calls[1][0].input).toMatchObject({
      modelId: BEDROCK_MEME_STUDIO_MODEL_ID,
      inferenceConfig: { maxTokens: BEDROCK_MEME_STUDIO_MAX_OUTPUT_TOKENS },
    });
    expect(h.reserveCost).toHaveBeenCalledWith(120 * 50 + 1_024 * 200);
    expect(result).toEqual({
      concepts,
      usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
      reservedNanoUsd: 120 * 50 + 1_024 * 200,
    });
  });

  it("accepts a full JSON fence but requires exactly three bounded concepts", async () => {
    const fenced = harness([
      { inputTokens: 10 },
      {
        ...response(),
        output: { message: { content: [{ text: `\`\`\`json\n${JSON.stringify({ concepts })}\n\`\`\`` }] } },
      },
    ]);
    await expect(generateBedrockMemeConcepts(input, {
      ...fenced,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).resolves.toMatchObject({ concepts });

    const invalid = harness([{ inputTokens: 10 }, response({ concepts: concepts.slice(0, 2) })]);
    await expect(generateBedrockMemeConcepts(input, {
      ...invalid,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidResponse });
  });

  it("fails closed on invalid rates before any provider call", async () => {
    const h = harness();
    await expect(generateBedrockMemeConcepts(input, {
      ...h,
      env: {
        BEDROCK_MEME_STUDIO_ENABLED: "true",
        BEDROCK_NOVA_MICRO_INPUT_NANO_USD_PER_TOKEN: "1000001",
      },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidRate });
    expect(h.client.send).not.toHaveBeenCalled();

    await expect(generateBedrockMemeConcepts(input, {
      ...h,
      env: {
        BEDROCK_MEME_STUDIO_ENABLED: "true",
        BEDROCK_NOVA_MICRO_OUTPUT_NANO_USD_PER_TOKEN: "199",
      },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.invalidRate });
    expect(h.client.send).not.toHaveBeenCalled();
  });

  it("stops after budget rejection and never calls Converse", async () => {
    const h = harness([{ inputTokens: 10 }]);
    h.reserveCost.mockRejectedValueOnce(new Error("private budget detail"));
    await expect(generateBedrockMemeConcepts(input, {
      ...h,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toMatchObject({ code: BEDROCK_MEME_STUDIO_ERROR.budgetRejected });
    expect(h.events).toEqual(["count"]);
    expect(h.client.send).toHaveBeenCalledOnce();
  });

  it("redacts provider failures into stable codes and never retries", async () => {
    const countFailure = harness([new Error("credential secret")]);
    await expect(generateBedrockMemeConcepts(input, {
      ...countFailure,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toEqual(expect.objectContaining({
      code: BEDROCK_MEME_STUDIO_ERROR.countFailed,
      message: BEDROCK_MEME_STUDIO_ERROR.countFailed,
    }));
    expect(countFailure.client.send).toHaveBeenCalledOnce();

    const generationFailure = harness([{ inputTokens: 10 }, new Error("provider secret")]);
    await expect(generateBedrockMemeConcepts(input, {
      ...generationFailure,
      env: { BEDROCK_MEME_STUDIO_ENABLED: "true" },
    })).rejects.toEqual(expect.objectContaining({
      code: BEDROCK_MEME_STUDIO_ERROR.generationFailed,
      message: BEDROCK_MEME_STUDIO_ERROR.generationFailed,
    }));
    expect(generationFailure.client.send).toHaveBeenCalledTimes(2);
  });
});
