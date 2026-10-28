import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkModel, prepareModel, MODEL_FILES, MODEL_REVISION } from "./prepare-meme-embedding-model.mjs";

function fixture(path = "onnx/model.onnx", content = "small FP32 fixture", algorithm = "sha256") {
  const data = Buffer.from(content);
  const hash = createHash(algorithm === "git-sha1" ? "sha1" : "sha256");
  if (algorithm === "git-sha1") hash.update(`blob ${data.length}\0`);
  return { data, file: { path, size: data.length, algorithm, digest: hash.update(data).digest("hex") } };
}

function rateLimitedResponse(retryAfter, onCancel = () => {}) {
  return new Response(new ReadableStream({ cancel: onCancel }), {
    status: 429,
    headers: retryAfter === undefined ? undefined : { "retry-after": retryAfter },
  });
}

async function temporary(run) {
  const directory = await mkdtemp(join(tmpdir(), "memecatch-model-test-"));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

async function assertNoStaging(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!/^\.model-(?:download|manifest)-/.test(entry.name));
    if (entry.isDirectory()) await assertNoStaging(join(directory, entry.name));
  }
}

test("pins the official FP32 file and excludes alternate quantizations", () => {
  assert.equal(MODEL_FILES.length, 5);
  const onnx = MODEL_FILES.find((file) => file.path === "onnx/model.onnx");
  assert.equal(onnx.size, 470268510);
  assert.equal(onnx.digest, "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665");
  assert.ok(MODEL_FILES.every((file) => !/qint8|_O4/.test(file.path)));
});

test("streams a trusted CDN download then reuses verified files without fetching", async () => {
  await temporary(async (directory) => {
    const { data, file } = fixture();
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, "manual");
      assert.equal(options.credentials, "omit");
      if (requests.length === 1) {
        assert.ok(url.includes(`/resolve/${MODEL_REVISION}/onnx/model.onnx`));
        return new Response(null, { status: 302, headers: { location: "https://us.aws.cdn.hf.co/model", "x-repo-commit": MODEL_REVISION } });
      }
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(data.subarray(0, 5));
        controller.enqueue(data.subarray(5));
        controller.close();
      } }));
    };
    const first = await prepareModel({ directory, files: [file], fetchImpl });
    assert.equal(first.files[0].status, "downloaded");
    assert.deepEqual(await readFile(join(directory, file.path)), data);
    assert.equal((await checkModel({ directory, files: [file] })).files[0].status, "valid");
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
    assert.deepEqual(manifest, { model: "intfloat/multilingual-e5-small", revision: MODEL_REVISION,
      dtype: "fp32", dimensions: 384, files: [{ path: file.path, bytes: file.size, sha256: file.digest }] });
    assert.equal((await checkModel({ directory, files: [file] })).manifest.status, "valid");
    const reused = await prepareModel({ directory, files: [file], fetchImpl: () => { throw new Error("unexpected_network"); } });
    assert.equal(reused.files[0].status, "reused");
    assert.equal(requests.length, 2);
    await assertNoStaging(directory);
  });
});

test("validates Git blob checksums and reports missing or corrupt assets locally", async () => {
  await temporary(async (directory) => {
    const { data, file } = fixture("config.json", "{}", "git-sha1");
    assert.equal((await checkModel({ directory, files: [file] })).files[0].status, "missing");
    await writeFile(join(directory, file.path), "[]");
    assert.equal((await checkModel({ directory, files: [file] })).files[0].status, "invalid");
    await prepareModel({ directory, files: [file], fetchImpl: async () => new Response(data) });
    assert.equal((await checkModel({ directory, files: [file] })).files[0].status, "valid");
  });
});

test("rejects corrupted, truncated, oversized and interrupted transfers without replacing old files", async () => {
  for (const kind of ["digest", "short", "large", "network", "abort", "length", "http"]) {
    await temporary(async (directory) => {
      const { data, file } = fixture();
      await mkdir(join(directory, "onnx"));
      const original = Buffer.from("existing corrupt file");
      await writeFile(join(directory, file.path), original);
      const controller = new AbortController();
      const fetchImpl = async () => {
        if (kind === "abort") controller.abort();
        if (kind === "http") return new Response("failure", { status: 503 });
        if (kind === "network") return new Response(new ReadableStream({ start(stream) { stream.error(new Error("connection_lost")); } }));
        const body = kind === "digest" ? Buffer.alloc(data.length, 1)
          : kind === "short" ? data.subarray(1)
            : kind === "large" ? Buffer.concat([data, data]) : data;
        return new Response(body, kind === "length" ? { headers: { "content-length": "999" } } : undefined);
      };
      await assert.rejects(prepareModel({ directory, files: [file], fetchImpl, signal: controller.signal }));
      assert.deepEqual(await readFile(join(directory, file.path)), original);
      await assertNoStaging(directory);
    });
  }
});

test("retries HTTP 429 twice on the same URL and respects Retry-After seconds and dates", async () => {
  await temporary(async (directory) => {
    const { data, file } = fixture();
    const now = Date.parse("2026-10-14T00:00:00.000Z");
    const requests = [];
    const waits = [];
    let cancelledBodies = 0;
    const fetchImpl = async (url) => {
      requests.push(url);
      if (requests.length === 1) return rateLimitedResponse("2", () => { cancelledBodies++; });
      if (requests.length === 2) {
        return new Response(null, { status: 302, headers: { location: "https://us.aws.cdn.hf.co/model" } });
      }
      if (requests.length === 3) {
        return rateLimitedResponse(new Date(now + 3_000).toUTCString(), () => { cancelledBodies++; });
      }
      return new Response(data);
    };
    const result = await prepareModel({
      directory,
      files: [file],
      fetchImpl,
      nowImpl: () => now,
      waitImpl: async (delay, signal) => {
        signal?.throwIfAborted();
        assert.equal(cancelledBodies, waits.length + 1);
        waits.push(delay);
      },
    });
    assert.equal(result.files[0].status, "downloaded");
    assert.deepEqual(waits, [2_000, 3_000]);
    assert.equal(cancelledBodies, 2);
    assert.equal(requests[0], requests[1]);
    assert.equal(requests[2], requests[3]);
    assert.notEqual(requests[1], requests[2]);
    await assertNoStaging(directory);
  });
});

test("fails closed when Retry-After exceeds 60 seconds without retrying early", async () => {
  await temporary(async (directory) => {
    const { file } = fixture();
    let requests = 0;
    let waits = 0;
    await assert.rejects(prepareModel({
      directory,
      files: [file],
      fetchImpl: async () => {
        requests++;
        return rateLimitedResponse("61");
      },
      waitImpl: async () => { waits++; },
    }), /model_retry_after_exceeds_limit/);
    assert.equal(requests, 1);
    assert.equal(waits, 0);
    await assertNoStaging(directory);
  });
});

test("uses bounded backoff when Retry-After is missing or invalid", async () => {
  await temporary(async (directory) => {
    const { data, file } = fixture();
    const waits = [];
    let requests = 0;
    const result = await prepareModel({
      directory,
      files: [file],
      fetchImpl: async () => {
        requests++;
        if (requests === 1) return rateLimitedResponse();
        if (requests === 2) return rateLimitedResponse("not-a-delay");
        return new Response(data);
      },
      waitImpl: async (delay, signal) => {
        signal?.throwIfAborted();
        waits.push(delay);
      },
    });
    assert.equal(result.files[0].status, "downloaded");
    assert.equal(requests, 3);
    assert.deepEqual(waits, [5_000, 10_000]);
    await assertNoStaging(directory);
  });
});

test("treats fractional, negative and non-date Retry-After values as malformed", async () => {
  for (const retryAfter of ["1.5", "-1", "header-garbage"]) {
    await temporary(async (directory) => {
      const { data, file } = fixture();
      const waits = [];
      let requests = 0;
      const result = await prepareModel({
        directory,
        files: [file],
        fetchImpl: async () => {
          requests++;
          return requests === 1 ? rateLimitedResponse(retryAfter) : new Response(data);
        },
        waitImpl: async (delay, signal) => {
          signal?.throwIfAborted();
          waits.push(delay);
        },
      });
      assert.equal(result.files[0].status, "downloaded");
      assert.equal(requests, 2);
      assert.deepEqual(waits, [5_000]);
      await assertNoStaging(directory);
    });
  }
});

test("allows an exact 60 second Retry-After boundary", async () => {
  await temporary(async (directory) => {
    const { data, file } = fixture();
    const waits = [];
    let requests = 0;
    const result = await prepareModel({
      directory,
      files: [file],
      fetchImpl: async () => {
        requests++;
        return requests === 1 ? rateLimitedResponse("60") : new Response(data);
      },
      waitImpl: async (delay, signal) => {
        signal?.throwIfAborted();
        waits.push(delay);
      },
    });
    assert.equal(result.files[0].status, "downloaded");
    assert.equal(requests, 2);
    assert.deepEqual(waits, [60_000]);
    await assertNoStaging(directory);
  });
});

test("aborting during a rate-limit wait prevents every subsequent fetch", async () => {
  await temporary(async (directory) => {
    const { file } = fixture();
    const controller = new AbortController();
    let requests = 0;
    let bodyCancelled = false;
    await assert.rejects(prepareModel({
      directory,
      files: [file],
      signal: controller.signal,
      fetchImpl: async () => {
        requests++;
        return rateLimitedResponse("1", () => { bodyCancelled = true; });
      },
      waitImpl: async (_delay, signal) => {
        controller.abort(new Error("test_rate_limit_abort"));
        signal.throwIfAborted();
      },
    }), /test_rate_limit_abort/);
    assert.equal(requests, 1);
    assert.equal(bodyCancelled, true);
    await assertNoStaging(directory);
  });
});

test("exhausted HTTP 429 retries preserve the old asset and manifest and clean staging", async () => {
  await temporary(async (directory) => {
    const { file } = fixture();
    await mkdir(join(directory, "onnx"));
    const oldAsset = Buffer.from("existing corrupt file");
    const oldManifest = Buffer.from('{"existing":true}\n');
    await writeFile(join(directory, file.path), oldAsset);
    await writeFile(join(directory, "manifest.json"), oldManifest);
    let requests = 0;
    const waits = [];
    await assert.rejects(prepareModel({
      directory,
      files: [file],
      fetchImpl: async () => {
        requests++;
        return rateLimitedResponse("0");
      },
      waitImpl: async (delay, signal) => {
        signal?.throwIfAborted();
        waits.push(delay);
      },
    }), /model_download_http_429/);
    assert.equal(requests, 3);
    assert.deepEqual(waits, [0, 0]);
    assert.deepEqual(await readFile(join(directory, file.path)), oldAsset);
    assert.deepEqual(await readFile(join(directory, "manifest.json")), oldManifest);
    await assertNoStaging(directory);
  });
});

test("blocks untrusted redirect hosts, insecure URLs, credentials, ports and loops", async () => {
  for (const location of ["https://evil.example/model", "https://us.aws.cdn.hf.co.evil.example/model", "http://huggingface.co/model", "https://user:password@huggingface.co/model", "https://huggingface.co:444/model", "https://127.0.0.1/model"]) {
    await temporary(async (directory) => {
      const { file } = fixture();
      let calls = 0;
      await assert.rejects(prepareModel({ directory, files: [file], fetchImpl: async () => {
        calls++;
        return new Response(null, { status: 302, headers: { location } });
      } }), /untrusted_model_download_url/);
      assert.equal(calls, 1);
      await assertNoStaging(directory);
    });
  }
  await temporary(async (directory) => {
    let calls = 0;
    await assert.rejects(prepareModel({ directory, files: [fixture().file], fetchImpl: async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: "https://huggingface.co/loop" } });
    } }), /model_redirect_limit/);
    assert.equal(calls, 6);
    await assertNoStaging(directory);
  });
});

test("rejects a changed revision, unsafe paths and symlink reuse", async () => {
  await temporary(async (directory) => {
    const { data, file } = fixture("config.json");
    let revisionRequests = 0;
    await assert.rejects(prepareModel({ directory, files: [file], fetchImpl: async () => {
      revisionRequests++;
      return new Response(data, { headers: { "x-repo-commit": "another-revision" } });
    } }), /model_revision_mismatch/);
    assert.equal(revisionRequests, 1);
    let notFoundRequests = 0;
    await assert.rejects(prepareModel({ directory, files: [file], fetchImpl: async () => {
      notFoundRequests++;
      return new Response("missing", { status: 404 });
    } }), /model_download_http_404/);
    assert.equal(notFoundRequests, 1);
    await assert.rejects(prepareModel({ directory, files: [{ ...file, path: "../escape" }], fetchImpl: () => { throw new Error("unexpected_network"); } }), /invalid_model_file_manifest/);
    await writeFile(join(directory, "original"), data);
    await symlink(join(directory, "original"), join(directory, file.path));
    assert.equal((await checkModel({ directory, files: [file] })).files[0].status, "invalid");
    await assertNoStaging(directory);
  });
});

test("requires a matching FP32 manifest and preserves it when an asset download fails", async () => {
  await temporary(async (directory) => {
    const { data, file } = fixture("config.json", "{}", "git-sha1");
    await prepareModel({ directory, files: [file], fetchImpl: async () => new Response(data) });
    const manifestPath = join(directory, "manifest.json");
    const original = await readFile(manifestPath);
    await assert.rejects(prepareModel({ directory, files: [file, fixture("onnx/model.onnx").file], fetchImpl: async () => new Response(null, { status: 500 }) }));
    assert.deepEqual(await readFile(manifestPath), original);
    const changed = JSON.parse(original);
    changed.dtype = "q8";
    await writeFile(manifestPath, JSON.stringify(changed));
    assert.equal((await checkModel({ directory, files: [file] })).manifest.status, "invalid");
    await assertNoStaging(directory);
  });
});

test("build gating skips disabled models and check/help remain free of downloads and writes", async () => {
  await temporary(async (directory) => {
    const script = fileURLToPath(new URL("./prepare-meme-embedding-model.mjs", import.meta.url));
    const missing = join(directory, "not-created");
    const run = (args, runtime) => spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8", env: { ...process.env, MEME_EMBEDDING_RUNTIME: runtime },
    });
    const disabled = run(["--if-enabled", "--dir", missing], "");
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.equal(disabled.stdout, "");
    assert.equal(run(["--help"], "bundled").status, 0);
    const enabled = run(["--if-enabled", "--check", "--dir", missing], "bundled");
    assert.equal(enabled.status, 1, enabled.stderr);
    assert.ok(JSON.parse(enabled.stdout).files.every((file) => file.status === "missing"));
    assert.deepEqual(await readdir(directory), []);
  });
});
