import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOEmbed: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/oembed", () => ({ getOEmbed: mocks.getOEmbed }));

import { ingestSource } from "./ingest.server";

type Admin = NonNullable<Parameters<typeof ingestSource>[2]>;

function selectQuery(data: unknown, error: unknown = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function adminClient(options: {
  meme?: unknown;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
}) {
  const from = vi.fn().mockReturnValue(selectQuery(options.meme ?? null));
  const rpc = vi.fn().mockResolvedValue({
    data: options.rpcData ?? null,
    error: options.rpcError ?? null,
  });
  return { client: { from, rpc } as unknown as Admin, from, rpc };
}

const memeId = "30000000-0000-4000-8000-000000000003";
const userId = "10000000-0000-4000-8000-000000000001";
const source = {
  platform: "youtube_shorts",
  external_id: "abcdefghijk",
  canonical_url: "https://www.youtube.com/shorts/abcdefghijk",
  title: "테스트 쇼츠",
  channel_name: "채널",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOEmbed.mockResolvedValue({
    contentId: source.external_id,
    title: source.title,
    authorName: source.channel_name,
  });
});

describe("source ingestion", () => {
  it("records metadata-only content with one atomic RPC", async () => {
    const { client, from, rpc } = adminClient({
      rpcData: [{
        ingestion_id: "70000000-0000-4000-8000-000000000007",
        source_id: "40000000-0000-4000-8000-000000000004",
        status: "metadata_ready",
        duplicate: false,
      }],
    });

    const result = await ingestSource({ url: source.canonical_url }, userId, client);

    expect(result).toMatchObject({
      id: "70000000-0000-4000-8000-000000000007",
      status: "metadata_ready",
      rightsMode: "METADATA_ONLY",
      duplicate: false,
    });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("record_source_ingestion", expect.objectContaining({
      p_platform: source.platform,
      p_external_id: source.external_id,
      p_canonical_url: source.canonical_url,
      p_title: source.title,
      p_channel_name: source.channel_name,
      p_submitted_by: userId,
      p_target_meme_id: null,
      p_processing_rights_mode: "METADATA_ONLY",
      p_metadata_refreshed_at: expect.any(String),
      p_metadata_expires_at: expect.any(String),
    }));
  });

  it("prechecks the target meme and records a linked pending candidate", async () => {
    const { client, from, rpc } = adminClient({
      meme: { id: memeId },
      rpcData: [{
        ingestion_id: "50000000-0000-4000-8000-000000000005",
        source_id: "40000000-0000-4000-8000-000000000004",
        status: "linked",
        duplicate: false,
      }],
    });

    const result = await ingestSource(
      { url: source.canonical_url, targetMemeId: memeId },
      userId,
      client,
    );

    expect(mocks.getOEmbed).toHaveBeenCalledWith(source.canonical_url);
    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith("memes");
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("record_source_ingestion", expect.objectContaining({
      p_target_meme_id: memeId,
    }));
    expect(result).toMatchObject({ status: "linked", rightsMode: "METADATA_ONLY", duplicate: false });
  });

  it("returns the duplicate status produced by the atomic RPC", async () => {
    const { client, from, rpc } = adminClient({
      meme: { id: memeId },
      rpcData: [{
        ingestion_id: "60000000-0000-4000-8000-000000000006",
        source_id: "40000000-0000-4000-8000-000000000004",
        status: "duplicate",
        duplicate: true,
      }],
    });

    const result = await ingestSource(
      { url: "https://www.youtube.com/watch?v=abcdefghijk", targetMemeId: memeId },
      userId,
      client,
    );

    expect(result).toMatchObject({
      id: "60000000-0000-4000-8000-000000000006",
      status: "duplicate",
      externalId: source.external_id,
      duplicate: true,
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("stops before metadata and RPC when the target meme is missing", async () => {
    const { client, rpc } = adminClient({ meme: null });

    await expect(ingestSource(
      { url: source.canonical_url, targetMemeId: memeId },
      userId,
      client,
    )).rejects.toMatchObject({ status: 404 });

    expect(mocks.getOEmbed).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails without table-level partial writes when the atomic RPC fails", async () => {
    const { client, from, rpc } = adminClient({
      meme: { id: memeId },
      rpcError: { message: "transaction rolled back" },
    });

    await expect(ingestSource(
      { url: source.canonical_url, targetMemeId: memeId },
      userId,
      client,
    )).rejects.toThrow("transaction rolled back");

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("memes");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
