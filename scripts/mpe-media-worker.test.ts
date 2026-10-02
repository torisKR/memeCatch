import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

type WorkerModule = {
  inspectMedia(path: string): Promise<{ width: number | null; height: number | null; durationMs: number; hasAudio: boolean }>;
  detectSceneTimes(path: string, durationMs: number, threshold?: number): Promise<number[]>;
  limitSceneOcrTimes(times: number[]): number[];
  perceptualHash(bytes: Uint8Array): string;
  framePerceptualHash(path: string, frameMs?: number): Promise<string>;
  extractAudioChunks(path: string, directory: string): Promise<Array<{ path: string; startMs: number; endMs: number }>>;
  normalizedAudioFingerprint(path: string): Promise<string>;
  buildAssDocument(input: unknown): string;
  renderVideoArtifact(inputPath: string, outputPath: string, input: unknown): Promise<{ width: number; height: number }>;
  processOneJob(client: unknown, options?: { heartbeatIntervalMs?: number }): Promise<boolean>;
  queueExpiredCleanupJobs(client: unknown): Promise<number>;
  cleanupOrphanOriginals(client: unknown, olderThanMs?: number): Promise<{ deleted: number; failed: number }>;
  watchForJobs(client: unknown, options: Record<string, unknown>): Promise<void>;
};

const exec = promisify(execFile);
let directory = "";
let videoPath = "";
let silentVideoPath = "";
let worker: WorkerModule;

beforeAll(async () => {
  worker = await import(new URL("./mpe-media-worker.mjs", import.meta.url).href) as unknown as WorkerModule;
  directory = await mkdtemp(join(tmpdir(), "mpe-fixture-"));
  videoPath = join(directory, "fixture.mp4");
  silentVideoPath = join(directory, "silent.mp4");
  await exec("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=red:s=160x90:d=1:r=10",
    "-f", "lavfi", "-i", "color=c=blue:s=160x90:d=1:r=10",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
    "-map", "[v]", "-map", "2:a", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", videoPath,
  ]);
  await exec("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=160x90:d=1:r=10",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", silentVideoPath,
  ]);
});

afterAll(async () => rm(directory, { recursive: true, force: true }));

describe("MPE FFmpeg worker", () => {
  it("inspects a real fixture and deterministically finds scene frames", async () => {
    const metadata = await worker.inspectMedia(videoPath);
    expect(metadata).toMatchObject({ width: 160, height: 90, hasAudio: true });
    expect(metadata.durationMs).toBeGreaterThanOrEqual(1_900);
    const first = await worker.detectSceneTimes(videoPath, metadata.durationMs, 0.2);
    const second = await worker.detectSceneTimes(videoPath, metadata.durationMs, 0.2);
    expect(first).toEqual(second);
    expect(first[0]).toBe(0);
    expect(first.some((ms) => ms >= 900 && ms <= 1_100)).toBe(true);
  });

  it("uses the installed FFmpeg scene extraction compatibility mode", async () => {
    // Ubuntu's codec/filter help exceeds Node's default 1 MiB capture limit.
    const help = await exec("ffmpeg", ["-hide_banner", "-h", "full"], {
      maxBuffer: 4 * 1024 * 1024,
    });
    expect(help.stdout).toContain("-fps_mode");
    expect(help.stdout).not.toContain("Unrecognized option 'vsync'");
    await expect(worker.detectSceneTimes(videoPath, 2_000, 0.2)).resolves.toContain(0);
  });

  it("fails scene detection when FFmpeg cannot run", async () => {
    const previousPath = process.env.PATH;
    process.env.PATH = "";
    try {
      await expect(worker.detectSceneTimes(videoPath, 2_000)).rejects.toThrow();
    } finally {
      process.env.PATH = previousPath;
    }
  });

  it("terminates an unresponsive ffprobe at the configured timeout", async () => {
    const binDirectory = join(directory, "hanging-bin");
    await mkdir(binDirectory);
    const ffprobe = join(binDirectory, "ffprobe");
    await writeFile(ffprobe, "#!/bin/sh\nwhile :; do :; done\n", "utf8");
    await chmod(ffprobe, 0o755);
    const previousPath = process.env.PATH;
    const previousTimeout = process.env.MPE_FFPROBE_TIMEOUT_MS;
    process.env.PATH = binDirectory;
    process.env.MPE_FFPROBE_TIMEOUT_MS = "50";
    try {
      const timeoutWorker = await import(
        `${new URL("./mpe-media-worker.mjs", import.meta.url).href}?timeout=${Date.now()}`
      ) as unknown as Pick<WorkerModule, "inspectMedia">;
      await expect(timeoutWorker.inspectMedia(videoPath)).rejects.toMatchObject({
        killed: true,
        signal: "SIGKILL",
      });
    } finally {
      process.env.PATH = previousPath;
      if (previousTimeout === undefined) delete process.env.MPE_FFPROBE_TIMEOUT_MS;
      else process.env.MPE_FFPROBE_TIMEOUT_MS = previousTimeout;
    }
  });

  it("limits video scene OCR to at most three frames", () => {
    expect(worker.limitSceneOcrTimes([0, 500, 1_000, 1_500, 2_000])).toEqual([0, 500, 1_000]);
  });

  it("creates stable 8x8 grayscale hashes and audio chunks", async () => {
    expect(worker.perceptualHash(new Uint8Array(64).fill(100))).toBe("ffffffffffffffff");
    expect(await worker.framePerceptualHash(videoPath, 0)).toBe(await worker.framePerceptualHash(videoPath, 0));
    const chunks = await worker.extractAudioChunks(videoPath, directory);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ startMs: 0 });
    const audioHash = await worker.normalizedAudioFingerprint(videoPath);
    expect(audioHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await worker.normalizedAudioFingerprint(videoPath)).toBe(audioHash);
  });

  it("renders a real captioned MP4 preset with attribution and the MemeCatch watermark", async () => {
    const outputPath = join(directory, "rendered.mp4");
    const input = {
      preset: "link",
      attribution: "직접 촬영 · @creator",
      segments: [
        { startMs: 0, endMs: 900, text: "FIRST {CAPTION}" },
        { startMs: 900, endMs: 1_800, text: "SECOND CAPTION" },
      ],
    };
    const ass = worker.buildAssDocument(input);
    expect(ass).toContain("MemeCatch · 밈캐치");
    expect(ass).toContain("출처: 직접 촬영 · @creator");
    expect(ass).toContain("FIRST \\{CAPTION\\}");

    await expect(worker.renderVideoArtifact(videoPath, outputPath, input)).resolves.toEqual({ width: 1200, height: 630 });
    await expect(worker.inspectMedia(outputPath)).resolves.toMatchObject({ width: 1200, height: 630, hasAudio: true });
  });

  it("fails OCR without an API key and records a provider error", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return { data: [{ id: "job-1", ingestion_id: "ing-1", job_type: "ocr", lease_token: "lease-ocr" }], error: null };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({
            data: { id: "ing-1", temporary_storage_key: "user-1/object", mime_type: "image/png", sha256: "a".repeat(64) },
            error: null,
          }),
        };
        return query;
      },
      storage: { from: () => ({ download: async () => ({ data: new Blob([Uint8Array.from([1])]), error: null }) }) },
    };
    try {
      await expect(worker.processOneJob(client)).resolves.toBe(true);
    } finally {
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
    expect(rpcCalls[1]).toEqual(["complete_processing_job", expect.objectContaining({
      p_job_id: "job-1", p_lease_token: "lease-ocr", p_status: "failed", p_error_code: "provider_not_configured",
    })]);
  });

  it.each([
    [{ message: "openrouter_daily_budget_exhausted" }, "openrouter_daily_budget_exhausted"],
    [{ code: "42501", message: "operator_required" }, "openrouter_budget_reservation_failed"],
  ])("records distinct reservation failure %s without provider fetch", async (reservationError, expectedCode) => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return {
          data: [{ id: "job-budget", ingestion_id: "ing-budget", job_type: "ocr", lease_token: "lease-budget" }],
          error: null,
        };
        if (name === "reserve_openrouter_daily_request") return { data: null, error: reservationError };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({
            data: { id: "ing-budget", user_id: "user-1", temporary_storage_key: "user-1/object", mime_type: "image/png" },
            error: null,
          }),
        };
        return query;
      },
      storage: { from: () => ({
        download: async () => ({ data: new Blob([Uint8Array.from([1])]), error: null }),
      }) },
    };
    try {
      await expect(worker.processOneJob(client)).resolves.toBe(true);
    } finally {
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
    const completion = rpcCalls.find(([name]) => name === "complete_processing_job");
    expect(completion?.[1]).toMatchObject({ p_status: "failed", p_error_code: expectedCode });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails inspect on a real container mismatch before downstream completion", async () => {
    const source = await readFile(videoPath);
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return { data: [{ id: "inspect-1", ingestion_id: "ing-1", job_type: "inspect", lease_token: "lease-inspect" }], error: null };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({
            data: { id: "ing-1", temporary_storage_key: "user-1/object", mime_type: "video/webm" }, error: null,
          }),
        };
        return query;
      },
      storage: { from: () => ({ download: async () => ({ data: new Blob([source]), error: null }) }) },
    };
    await expect(worker.processOneJob(client)).resolves.toBe(true);
    expect(rpcCalls[1]).toEqual(["complete_processing_job", expect.objectContaining({
      p_job_id: "inspect-1", p_lease_token: "lease-inspect", p_status: "failed", p_error_code: "container_mismatch",
    })]);
  });

  it("stores a normalized audio fingerprint for an audio-bearing video", async () => {
    const source = await readFile(videoPath);
    const fingerprints: Array<Record<string, unknown>> = [];
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return { data: [{ id: "fingerprint-1", ingestion_id: "ing-1", job_type: "fingerprint", lease_token: "lease-fingerprint" }], error: null };
        return { data: {}, error: null };
      },
      from: (table: string) => {
        if (table === "media_fingerprints") return {
          upsert: async (value: Record<string, unknown>) => { fingerprints.push(value); return { error: null }; },
        };
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: {
            id: "ing-1", user_id: "user-1", temporary_storage_key: "user-1/object",
            mime_type: "video/mp4", sha256: "d".repeat(64),
          }, error: null }),
        };
        return query;
      },
      storage: { from: () => ({ download: async () => ({ data: new Blob([source]), error: null }) }) },
    };
    await expect(worker.processOneJob(client)).resolves.toBe(true);
    expect(fingerprints).toContainEqual(expect.objectContaining({
      fingerprint_type: "AUDIO", hash_value: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(rpcCalls[1][1]).toMatchObject({ p_status: "completed" });
  });

  it("skips STT for inspected no-audio media", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const source = await readFile(silentVideoPath);
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return { data: [{ id: "stt-1", ingestion_id: "ing-1", job_type: "stt", lease_token: "lease-stt" }], error: null };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: {
            id: "ing-1", temporary_storage_key: "user-1/object", mime_type: "video/mp4",
          }, error: null }),
        };
        return query;
      },
      storage: { from: () => ({ download: async () => ({ data: new Blob([source]), error: null }) }) },
    };
    try {
      await expect(worker.processOneJob(client)).resolves.toBe(true);
    } finally {
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
    expect(rpcCalls[1]).toEqual(["complete_processing_job", expect.objectContaining({
      p_lease_token: "lease-stt", p_status: "skipped",
      p_output_json: { reason: "no_audio", segmentsWritten: 0, audioDetected: false },
    })]);
  });

  it("skips audio STT in Ox Alpha-only mode without a transcription request", async () => {
    const source = await readFile(videoPath);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return { data: [{ id: "stt-visual-1", ingestion_id: "ing-1", job_type: "stt", lease_token: "lease-stt-visual" }], error: null };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: {
            id: "ing-1", temporary_storage_key: "user-1/object", mime_type: "video/mp4",
          }, error: null }),
        };
        return query;
      },
      storage: { from: () => ({ download: async () => ({ data: new Blob([source]), error: null }) }) },
    };
    try {
      await expect(worker.processOneJob(client)).resolves.toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
    expect(rpcCalls[1]).toEqual(["complete_processing_job", expect.objectContaining({
      p_lease_token: "lease-stt-visual", p_status: "skipped",
      p_output_json: {
        reason: "audio_stt_disabled", provider: "openrouter", model: "stealth/ox-alpha",
        providerBacked: false, segmentsWritten: 0, audioDetected: true,
      },
    })]);
  });

  it("stores scene artifacts under the private user prefix with a unified DTO", async () => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ segments: [{
        rawText: "화면 문구", normalizedText: "화면 문구", language: "ko", confidence: 0.99, boundingBox: null,
      }] }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const userId = "10000000-0000-4000-8000-000000000001";
    const ingestionId = "20000000-0000-4000-8000-000000000002";
    const source = await readFile(videoPath);
    const uploads: string[] = [];
    const segments: Array<Record<string, unknown>> = [];
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return { data: [{ id: "scene-1", ingestion_id: ingestionId, job_type: "scene_frames", lease_token: "lease-scene" }], error: null };
        return { data: {}, error: null };
      },
      from: (table: string) => {
        if (table === "media_fingerprints") return { upsert: async () => ({ error: null }) };
        if (table === "text_segments") return {
          insert: async (value: Array<Record<string, unknown>>) => { segments.push(...value); return { error: null }; },
        };
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: {
            id: ingestionId, user_id: userId, temporary_storage_key: `${userId}/original`, mime_type: "video/mp4",
          }, error: null }),
        };
        return query;
      },
      storage: { from: () => ({
        download: async () => ({ data: new Blob([source]), error: null }),
        upload: async (key: string) => { uploads.push(key); return { error: null }; },
      }) },
    };
    try {
      await expect(worker.processOneJob(client)).resolves.toBe(true);
    } finally {
      fetchMock.mockRestore();
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    }
    expect(uploads[0]).toMatch(new RegExp(`^${userId}/${ingestionId}/frames/`));
    expect(segments).not.toHaveLength(0);
    expect(rpcCalls[0][1]).toMatchObject({ p_processor_version: "1.1.0" });
    const reservations = rpcCalls.filter(([name]) => name === "reserve_openrouter_daily_request");
    expect(reservations).toHaveLength(uploads.length);
    expect(reservations).toEqual(expect.arrayContaining([
      ["reserve_openrouter_daily_request", {
        p_provider: "openrouter",
        p_model: "stealth/ox-alpha",
      }],
    ]));
    expect(uploads.length).toBeLessThanOrEqual(3);
    const completion = rpcCalls.find(([name]) => name === "complete_processing_job");
    expect(completion?.[1]).toMatchObject({
      p_lease_token: "lease-scene", p_status: "completed",
      p_output_json: {
        provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true,
        segmentsWritten: segments.length,
        artifacts: expect.arrayContaining([expect.objectContaining({
          kind: "representative_frame", storageKey: uploads[0], mimeType: "image/jpeg",
        })]),
      },
    });
  });

  it("claims a render job, uploads the user-prefixed MP4, and completes with artifact metadata", async () => {
    const userId = "10000000-0000-4000-8000-000000000001";
    const ingestionId = "20000000-0000-4000-8000-000000000002";
    const artifactKey = `${userId}/${ingestionId}/renders/${"a".repeat(64)}.mp4`;
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const uploads: Array<{ key: string; type: string; bytes: number }> = [];
    const source = await readFile(videoPath);
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return {
          data: [{
            id: "render-job-1", ingestion_id: ingestionId, job_type: "render", lease_token: "lease-render",
            output_json: {
              artifactKey, preset: "link", attribution: "직접 촬영 · @creator",
              segments: [{ startMs: 0, endMs: 1_800, text: "RENDERED CAPTION" }],
            },
          }],
          error: null,
        };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({
            data: {
              id: ingestionId, user_id: userId, media_kind: "video", mime_type: "video/mp4",
              temporary_storage_key: `${userId}/original`, sha256: "b".repeat(64),
            },
            error: null,
          }),
        };
        return query;
      },
      storage: {
        from: () => ({
          download: async () => ({ data: new Blob([source]), error: null }),
          upload: async (key: string, bytes: Uint8Array, options: { contentType: string }) => {
            uploads.push({ key, type: options.contentType, bytes: bytes.byteLength });
            return { error: null };
          },
        }),
      },
    };

    await expect(worker.processOneJob(client)).resolves.toBe(true);
    expect(rpcCalls[0][1].p_job_types).toContain("render");
    expect(uploads).toEqual([{ key: artifactKey, type: "video/mp4", bytes: expect.any(Number) }]);
    expect(uploads[0].bytes).toBeGreaterThan(0);
    expect(rpcCalls[1]).toEqual(["complete_processing_job", expect.objectContaining({
      p_job_id: "render-job-1",
      p_lease_token: "lease-render",
      p_status: "completed",
      p_output_json: expect.objectContaining({ artifactKey, preset: "link", width: 1200, height: 630 }),
    })]);
  });

  it("queues cleanup for expired originals so failures remain in job history", async () => {
    const inserts: unknown[] = [];
    let jobSelects = 0;
    const sourceQuery = {
      select: () => sourceQuery,
      is: () => sourceQuery,
      lt: () => sourceQuery,
      limit: async () => ({ data: [{ id: "ing-1", sha256: "c".repeat(64) }], error: null }),
    };
    const jobsQuery = {
      select: () => { jobSelects += 1; return jobsQuery; },
      eq: () => jobsQuery,
      neq: () => jobsQuery,
      in: () => jobsQuery,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      insert: async (value: unknown) => { inserts.push(value); return { error: null }; },
    };
    const client = {
      from: (table: string) => table === "processing_jobs" ? jobsQuery : sourceQuery,
    };
    await expect(worker.queueExpiredCleanupJobs(client)).resolves.toBe(1);
    expect(jobSelects).toBe(2);
    expect(inserts).toEqual([expect.objectContaining({ ingestion_id: "ing-1", job_type: "cleanup", status: "queued" })]);
  });

  it("records cleanup storage failures on the claimed job", async () => {
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return { data: [{ id: "cleanup-1", ingestion_id: "ing-1", job_type: "cleanup", lease_token: "lease-cleanup" }], error: null };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { id: "ing-1", temporary_storage_key: "user-1/original" }, error: null }),
        };
        return query;
      },
      storage: { from: () => ({ remove: async () => ({ error: new Error("storage") }) }) },
    };
    await expect(worker.processOneJob(client)).resolves.toBe(true);
    expect(rpcCalls[1]).toEqual(["complete_processing_job", expect.objectContaining({
      p_job_id: "cleanup-1", p_lease_token: "lease-cleanup", p_status: "failed", p_error_code: "storage_delete_failed",
    })]);
  });

  it("does not turn an old lease completion rejection into a failure on the new lease", async () => {
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return {
          data: [{ id: "cleanup-1", ingestion_id: "ing-1", job_type: "cleanup", lease_token: "old-lease" }], error: null,
        };
        return { data: null, error: { message: "lease_token_mismatch" } };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { id: "ing-1", temporary_storage_key: "user-1/original" }, error: null }),
          update: () => query,
        };
        return query;
      },
      storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    };
    await expect(worker.processOneJob(client)).resolves.toBe(true);
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[1]).toEqual(["complete_processing_job", expect.objectContaining({
      p_lease_token: "old-lease", p_status: "completed",
    })]);
  });

  it("renews the claimed lease while a long-running job is still active", async () => {
    vi.useFakeTimers();
    let releaseRemoval = () => {};
    let markRemovalStarted = () => {};
    const removalStarted = new Promise<void>((resolve) => { markRemovalStarted = resolve; });
    const removalBlocked = new Promise<void>((resolve) => { releaseRemoval = resolve; });
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return {
          data: [{ id: "cleanup-heartbeat", ingestion_id: "ing-1", job_type: "cleanup", lease_token: "lease-active" }], error: null,
        };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { id: "ing-1", temporary_storage_key: "user-1/original" }, error: null }),
          update: () => query,
        };
        return query;
      },
      storage: { from: () => ({
        remove: async () => {
          markRemovalStarted();
          await removalBlocked;
          return { error: null };
        },
      }) },
    };
    try {
      const processing = worker.processOneJob(client, { heartbeatIntervalMs: 5 });
      await removalStarted;
      await vi.advanceTimersByTimeAsync(5);
      expect(rpcCalls[1]).toEqual(["renew_processing_job_lease", {
        p_job_id: "cleanup-heartbeat", p_lease_token: "lease-active",
      }]);
      releaseRemoval();
      await expect(processing).resolves.toBe(true);
      expect(rpcCalls[2]).toEqual(["complete_processing_job", expect.objectContaining({
        p_job_id: "cleanup-heartbeat", p_lease_token: "lease-active", p_status: "completed",
      })]);
    } finally {
      releaseRemoval();
      vi.useRealTimers();
    }
  });

  it("does not complete a job after the heartbeat reports that its lease was lost", async () => {
    vi.useFakeTimers();
    let releaseRemoval = () => {};
    let markRemovalStarted = () => {};
    const removalStarted = new Promise<void>((resolve) => { markRemovalStarted = resolve; });
    const removalBlocked = new Promise<void>((resolve) => { releaseRemoval = resolve; });
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return {
          data: [{ id: "cleanup-stale", ingestion_id: "ing-1", job_type: "cleanup", lease_token: "lease-old" }], error: null,
        };
        if (name === "renew_processing_job_lease") return { data: null, error: { message: "lease_token_mismatch" } };
        return { data: {}, error: null };
      },
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { id: "ing-1", temporary_storage_key: "user-1/original" }, error: null }),
          update: () => query,
        };
        return query;
      },
      storage: { from: () => ({
        remove: async () => {
          markRemovalStarted();
          await removalBlocked;
          return { error: null };
        },
      }) },
    };
    try {
      const processing = worker.processOneJob(client, { heartbeatIntervalMs: 5 });
      await removalStarted;
      await vi.advanceTimersByTimeAsync(5);
      releaseRemoval();
      await expect(processing).resolves.toBe(true);
      expect(rpcCalls.map(([name]) => name)).toEqual([
        "claim_processing_job", "renew_processing_job_lease",
      ]);
    } finally {
      releaseRemoval();
      vi.useRealTimers();
    }
  });

  it("audits a non-stale completion error and explicitly fails the same lease", async () => {
    const rpcCalls: Array<[string, Record<string, unknown>]> = [];
    const audits: unknown[] = [];
    let completions = 0;
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push([name, args]);
        if (name === "claim_processing_job") return {
          data: [{ id: "cleanup-1", ingestion_id: "ing-1", job_type: "cleanup", lease_token: "lease-1" }], error: null,
        };
        completions += 1;
        return completions === 1
          ? { data: null, error: { message: "completion_validation_failed" } }
          : { data: {}, error: null };
      },
      from: (table: string) => {
        if (table === "admin_audit_log") return {
          insert: async (value: unknown) => { audits.push(value); return { error: null }; },
        };
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { id: "ing-1", temporary_storage_key: "user-1/original" }, error: null }),
          update: () => query,
        };
        return query;
      },
      storage: { from: () => ({ remove: async () => ({ error: null }) }) },
    };
    await expect(worker.processOneJob(client)).resolves.toBe(true);
    expect(rpcCalls).toHaveLength(3);
    expect(rpcCalls[2]).toEqual(["complete_processing_job", expect.objectContaining({
      p_lease_token: "lease-1", p_status: "failed", p_error_code: "job_completion_failed",
    })]);
    expect(audits).toEqual([expect.objectContaining({
      action: "mpe_worker_completion_failed", entity_id: "cleanup-1",
    })]);
  });

  it("removes only unreferenced old root uploads, not derived artifact folders", async () => {
    const userId = "10000000-0000-4000-8000-000000000001";
    const orphanId = "20000000-0000-4000-8000-000000000002";
    const referencedId = "30000000-0000-4000-8000-000000000003";
    const removed: string[][] = [];
    const bucket = {
      list: async (prefix: string) => prefix === ""
        ? { data: [{ name: userId, id: null }], error: null }
        : { data: [
          { name: orphanId, id: "object-1", created_at: "2020-01-01T00:00:00.000Z" },
          { name: referencedId, id: "object-2", created_at: "2020-01-01T00:00:00.000Z" },
          { name: "artifacts", id: null, created_at: "2020-01-01T00:00:00.000Z" },
        ], error: null },
      remove: async (paths: string[]) => { removed.push(paths); return { error: null }; },
    };
    const query = {
      select: () => query,
      in: async () => ({ data: [{ temporary_storage_key: `${userId}/${referencedId}` }], error: null }),
    };
    const client = {
      storage: { from: () => bucket },
      from: () => query,
    };
    await expect(worker.cleanupOrphanOriginals(client, 1)).resolves.toEqual({ deleted: 1, failed: 0 });
    expect(removed).toEqual([[`${userId}/${orphanId}`]]);
  });

  it("paginates root folders and objects to delete an orphan after the first page", async () => {
    const userId = "10000000-0000-4000-8000-000000000001";
    const orphanId = "20000000-0000-4000-8000-000000000002";
    const removed: string[][] = [];
    const bucket = {
      list: async (prefix: string, options: { offset: number }) => {
        if (prefix === "" && options.offset === 0) {
          return { data: Array.from({ length: 1_000 }, (_, index) => ({ name: `not-a-user-${index}`, id: null })), error: null };
        }
        if (prefix === "") return { data: [{ name: userId, id: null }], error: null };
        if (options.offset === 0) {
          return { data: Array.from({ length: 1_000 }, (_, index) => ({
            name: `artifact-${index}`, id: `id-${index}`, created_at: "2020-01-01T00:00:00.000Z",
          })), error: null };
        }
        return { data: [{ name: orphanId, id: "orphan", created_at: "2020-01-01T00:00:00.000Z" }], error: null };
      },
      remove: async (paths: string[]) => { removed.push(paths); return { error: null }; },
    };
    const query = {
      select: () => query,
      in: async () => ({ data: [], error: null }),
    };
    const client = { storage: { from: () => bucket }, from: () => query };
    await expect(worker.cleanupOrphanOriginals(client, 1)).resolves.toEqual({ deleted: 1, failed: 0 });
    expect(removed).toEqual([[`${userId}/${orphanId}`]]);
  });

  it("chunks more than 1000 orphan reference keys into bounded queries", async () => {
    const userId = "10000000-0000-4000-8000-000000000001";
    const names = Array.from({ length: 1_001 }, (_, index) =>
      `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    const querySizes: number[] = [];
    const bucket = {
      list: async (prefix: string, options: { offset: number }) => {
        if (prefix === "") return options.offset === 0
          ? { data: [{ name: userId, id: null }], error: null }
          : { data: [], error: null };
        const page = names.slice(options.offset, options.offset + 1_000).map((name) => ({
          name, id: name, created_at: "2020-01-01T00:00:00.000Z",
        }));
        return { data: page, error: null };
      },
      remove: async () => ({ error: null }),
    };
    const query = {
      select: () => query,
      in: async (_column: string, keys: string[]) => {
        querySizes.push(keys.length);
        return { data: keys.map((temporary_storage_key) => ({ temporary_storage_key })), error: null };
      },
    };
    const client = { storage: { from: () => bucket }, from: () => query };
    await expect(worker.cleanupOrphanOriginals(client, 1)).resolves.toEqual({ deleted: 0, failed: 0 });
    expect(querySizes).toEqual([250, 250, 250, 250, 1]);
    expect(Math.max(...querySizes)).toBeLessThanOrEqual(250);
  });

  it("keeps watching, idles between empty claims, and runs periodic maintenance", async () => {
    let iterations = 0;
    let maintenance = 0;
    let waits = 0;
    let clock = 0;
    await worker.watchForJobs({}, {
      pollMs: 1_000,
      maintenanceMs: 10,
      shouldStop: () => iterations >= 2,
      processJob: async () => { iterations += 1; return false; },
      maintain: async () => { maintenance += 1; },
      wait: async () => { waits += 1; },
      now: () => { clock += 10; return clock; },
    });
    expect({ iterations, maintenance, waits }).toEqual({ iterations: 2, maintenance: 3, waits: 2 });
  });

  it("backs off empty queue claims within a cap and resets after processing a job", async () => {
    const outcomes = [false, false, false, false, true, false];
    const waits: number[] = [];
    await worker.watchForJobs({}, {
      pollMs: 2_000, maxIdlePollMs: 8_000,
      shouldStop: () => !outcomes.length,
      processJob: async () => outcomes.shift(),
      maintain: async () => {}, now: () => 0,
      wait: async (ms: number) => { waits.push(ms); },
    });
    expect(waits).toEqual([2_000, 4_000, 8_000, 8_000, 2_000]);
  });

  it("does not delay queued work and supports an explicit fixed polling cap", async () => {
    const outcomes = [true, true, false, false];
    const waits: number[] = [];
    await worker.watchForJobs({}, {
      pollMs: 1_000, maxIdlePollMs: 1_000,
      shouldStop: () => !outcomes.length,
      processJob: async () => outcomes.shift(),
      maintain: async () => {}, now: () => 0,
      wait: async (ms: number) => { waits.push(ms); },
    });
    expect(waits).toEqual([1_000, 1_000]);
  });
});
