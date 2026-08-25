import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const projectDir = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const appUrl = process.env.MPE_E2E_APP_URL || "http://127.0.0.1:3100";
const providerUrl = process.env.MPE_E2E_PROVIDER_URL || "http://127.0.0.1:4311/v1";
const email = process.env.MPE_E2E_EMAIL || "mpe-e2e-local@example.test";
const password = process.env.MPE_E2E_PASSWORD;

if (!password) throw new Error("MPE_E2E_PASSWORD is required");

function localEnv() {
  const raw = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  return Object.fromEntries(raw.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}

function requireOk(response, payload, step) {
  if (!response.ok) throw new Error(`${step}:${response.status}:${JSON.stringify(payload)}`);
  return payload;
}

function worker(env, mode = "--drain") {
  execFileSync("node", ["scripts/mpe-media-worker.mjs", mode], {
    cwd: projectDir,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
      OPENROUTER_API_KEY: "local-test-key",
      OPENROUTER_BASE_URL: providerUrl,
    },
    stdio: "inherit",
  });
}

const env = localEnv();
const cookies = [];
const sessionClient = createServerClient(env.API_URL, env.ANON_KEY, {
  cookies: {
    getAll: () => cookies,
    setAll: (values) => {
      for (const value of values) {
        const prior = cookies.findIndex((item) => item.name === value.name);
        if (prior >= 0) cookies.splice(prior, 1);
        cookies.push(value);
      }
    },
  },
});
const signedIn = await sessionClient.auth.signInWithPassword({ email, password });
if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("sign_in_failed");
const cookieHeader = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
const userClient = createClient(env.API_URL, env.ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${signedIn.data.session.access_token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const adminPage = await fetch(`${appUrl}/admin/mpe`, { headers: { cookie: cookieHeader }, redirect: "manual" });
if (adminPage.status !== 200) throw new Error(`admin_page:${adminPage.status}`);

async function upload(path, type, name) {
  const form = new FormData();
  form.set("file", new File([await readFile(path)], name, { type }));
  form.set("rightsDeclaration", JSON.stringify({ accepted: true }));
  const response = await fetch(`${appUrl}/api/mpe/uploads`, { method: "POST", headers: { cookie: cookieHeader }, body: form });
  return requireOk(response, await response.json(), "upload").data;
}

const imageUpload = await upload(`${projectDir}/public/ai-memes/ai-slop.jpg`, "image/jpeg", "mpe-e2e.jpg");
worker(env);

const candidateResponse = await fetch(`${appUrl}/api/admin/mpe-candidates`, {
  method: "POST",
  headers: { cookie: cookieHeader, "content-type": "application/json" },
  body: JSON.stringify({ action: "create", ingestionId: imageUpload.ingestionId, title: "로컬 E2E 밈", memeType: "REACTION_IMAGE" }),
});
const candidatePayload = requireOk(candidateResponse, await candidateResponse.json(), "candidate");
const candidateId = candidatePayload.data.candidate.id;

let result = await userClient.rpc("set_mpe_ingestion_source_rights", {
  p_ingestion_id: imageUpload.ingestionId,
  p_source_role: "original",
  p_rights_basis: "creator_permission",
});
if (result.error) throw result.error;
const claims = await userClient.from("claim_evidence").select("id").eq("candidate_id", candidateId);
if (claims.error || !claims.data?.length) throw claims.error ?? new Error("claims_missing");
for (const claim of claims.data) {
  result = await userClient.rpc("review_mpe_claim", { p_candidate_id: candidateId, p_claim_id: claim.id, p_decision: "APPROVED" });
  if (result.error) throw result.error;
}
for (const [stage, decision] of [["FACT_CHECKING", "APPROVED"], ["RIGHTS_CHECKING", "APPROVED"], ["PUBLISH", "PUBLISHED"]]) {
  result = await userClient.rpc("review_mpe_candidate", { p_candidate_id: candidateId, p_stage: stage, p_decision: decision, p_reason: "local-e2e" });
  if (result.error) throw result.error;
}
const published = await userClient.from("meme_candidates").select("review_status,target_meme_id").eq("id", candidateId).single();
if (published.error || published.data.review_status !== "APPROVED" || !published.data.target_meme_id) throw published.error ?? new Error("publish_failed");
const publicMeme = await admin.from("memes").select("id,title,moderation_status").eq("id", published.data.target_meme_id).single();
if (publicMeme.error || publicMeme.data.moderation_status !== "approved") throw publicMeme.error ?? new Error("public_meme_missing");

const expired = await admin.from("media_ingestions").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", imageUpload.ingestionId);
if (expired.error) throw expired.error;
worker(env, "--once");
const deleted = await admin.from("media_ingestions").select("deleted_at").eq("id", imageUpload.ingestionId).single();
if (deleted.error || !deleted.data.deleted_at) throw deleted.error ?? new Error("ttl_cleanup_failed");

const videoPath = "/tmp/mpe-e2e-video.mp4";
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", "color=c=blue:s=320x180:d=2:r=24",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
  "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", videoPath,
]);
const videoUpload = await upload(videoPath, "video/mp4", "mpe-e2e.mp4");
worker(env);
const renderResponse = await fetch(`${appUrl}/api/mpe/renders`, {
  method: "POST",
  headers: { cookie: cookieHeader, "content-type": "application/json" },
  body: JSON.stringify({
    ingestionId: videoUpload.ingestionId,
    preset: "link",
    attribution: "직접 제작 · local E2E",
    segments: [{ startMs: 0, endMs: 1800, text: "로컬 자막 렌더" }],
  }),
});
const renderPayload = requireOk(renderResponse, await renderResponse.json(), "render_queue");
worker(env);
const jobResponse = await fetch(`${appUrl}/api/mpe/jobs/${renderPayload.data.jobId}`, { headers: { cookie: cookieHeader } });
const jobPayload = requireOk(jobResponse, await jobResponse.json(), "render_job");
if (jobPayload.data.status !== "completed" || !jobPayload.data.downloadUrl) throw new Error("render_not_completed");
const renderedResponse = await fetch(jobPayload.data.downloadUrl);
if (!renderedResponse.ok) throw new Error(`render_download:${renderedResponse.status}`);
const renderedPath = "/tmp/mpe-e2e-render.mp4";
await writeFile(renderedPath, new Uint8Array(await renderedResponse.arrayBuffer()));
const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "json", renderedPath], { encoding: "utf8" }));
const video = probe.streams.find((stream) => stream.codec_name === "h264");
if (!video || video.width !== 1200 || video.height !== 630) throw new Error("render_probe_failed");

console.log(JSON.stringify({
  ok: true,
  adminPage: 200,
  image: { ingestionId: imageUpload.ingestionId, jobs: imageUpload.jobIds.length, candidateId, memeId: publicMeme.data.id, deletedAt: deleted.data.deleted_at },
  video: { ingestionId: videoUpload.ingestionId, renderJobId: renderPayload.data.jobId, codec: video.codec_name, width: video.width, height: video.height, artifact: renderedPath },
}));
