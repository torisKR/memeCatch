import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOperatorPage: vi.fn(),
  createAdminClient: vi.fn(),
  videoDraftProviderConfigured: vi.fn(() => false),
  isYouTubeOAuthConfigured: vi.fn(() => false),
  getExpectedYouTubeChannelId: vi.fn(() => "UC-expected"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/(default)/admin/require-operator", () => ({ requireOperatorPage: mocks.requireOperatorPage }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("./draft.server", () => ({ videoDraftProviderConfigured: mocks.videoDraftProviderConfigured }));
vi.mock("./oauth.server", () => ({ isYouTubeOAuthConfigured: mocks.isYouTubeOAuthConfigured, getExpectedYouTubeChannelId: mocks.getExpectedYouTubeChannelId }));

import { getVideoProductionWorkspace } from "./workspace.server";

function queryResult(data: unknown, error: unknown = null) {
  const promise = Promise.resolve({ data, error });
  return {
    select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    returns: vi.fn(() => promise),
  };
}

function workspaceClient(options: { candidates?: unknown; candidateError?: unknown; productions?: unknown; productionError?: unknown; channels?: unknown; channelError?: unknown; publications?: unknown; publicationError?: unknown } = {}) {
  const queries = {
    video_productions: queryResult(options.productions ?? [], options.productionError ?? null),
    youtube_channel_connections_safe: queryResult(options.channels ?? [], options.channelError ?? null),
    youtube_publications: queryResult(options.publications ?? [], options.publicationError ?? null),
  };
  const rpc = vi.fn().mockResolvedValue({ data: options.candidates ?? [], error: options.candidateError ?? null });
  const from = vi.fn((table: keyof typeof queries) => queries[table]);
  return { rpc, from, queries };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getExpectedYouTubeChannelId.mockReturnValue("UC-expected");
  mocks.createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) } });
});

describe("video production workspace read boundary", () => {
  it("keeps invalid channel configuration visible without crashing the page", async () => {
    mocks.getExpectedYouTubeChannelId.mockImplementationOnce(() => { throw new Error("invalid_expected_channel"); });
    mocks.requireOperatorPage.mockResolvedValue({ supabase: workspaceClient(), user: { id: "operator" } });
    await expect(getVideoProductionWorkspace()).resolves.toMatchObject({ oauth_configured: false, expected_channel_id: "",
      setup_notes: expect.arrayContaining([expect.stringContaining("채널 ID 설정")]) });
  });
  it("returns setup_required with empty ledgers when required RPC/schema setup is missing", async () => {
    const client = workspaceClient({ candidateError: { code: "PGRST202", message: "function missing" } });
    mocks.requireOperatorPage.mockResolvedValue({ supabase: client, user: { id: "operator" } });
    await expect(getVideoProductionWorkspace()).resolves.toMatchObject({
      state: "setup_required", candidates: [], productions: [], channels: [], publications: [],
      setup_notes: expect.arrayContaining([expect.stringContaining("마이그레이션")]),
    });
  });

  it("does not expose plaintext OAuth tokens or resumable upload sessions in workspace DTOs", async () => {
    const client = workspaceClient({
      channels: [{ id: "channel-row", channel_id: "UC-expected", title: "채널", connection_status: "connected", oauth_status: "valid", api_publication_status: "verified", refresh_token: "plaintext-refresh-token" }],
      publications: [{ id: "publication-row", production_id: "production-row", channel_connection_id: "channel-row", artifact_hash: "a".repeat(64), status: "uploading", youtube_video_id: null, processing_status: null, privacy_status: "private", embeddable: null, approved_visibility: null, studio_reviewed_at: null, site_linked_at: null, last_error_code: null, upload_session_url: "https://upload.example/session-secret" }],
    });
    mocks.requireOperatorPage.mockResolvedValue({ supabase: client, user: { id: "operator" } });
    const workspace = await getVideoProductionWorkspace();
    expect(workspace.state).toBe("ready");
    expect(JSON.stringify(workspace)).not.toContain("plaintext-refresh-token");
    expect(JSON.stringify(workspace)).not.toContain("session-secret");
    expect(workspace.channels[0]).not.toHaveProperty("refresh_token");
    expect(workspace.publications[0]).not.toHaveProperty("upload_session_url");
  });

  it("performs only the allowlisted candidate read RPC and select/sign operations", async () => {
    const client = workspaceClient();
    const createSignedUrl = vi.fn();
    mocks.createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } });
    mocks.requireOperatorPage.mockResolvedValue({ supabase: client, user: { id: "operator" } });
    await getVideoProductionWorkspace();
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("get_video_production_candidates", { p_limit: 5 });
    for (const query of Object.values(client.queries)) {
      expect(query.select).toHaveBeenCalledTimes(1);
      expect(query).not.toHaveProperty("insert");
      expect(query).not.toHaveProperty("update");
      expect(query).not.toHaveProperty("delete");
      expect(query).not.toHaveProperty("upsert");
    }
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
