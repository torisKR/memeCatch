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
    await assert.rejects(prepareModel({ directory, files: [file], fetchImpl: async () => new Response(data, { headers: { "x-repo-commit": "another-revision" } }) }), /model_revision_mismatch/);
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
