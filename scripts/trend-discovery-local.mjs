import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

// This command performs bounded read-only API calls and writes local evidence.
// It never connects to the production database or publishes a candidate.
const live = process.argv.includes("--live");
if (!live) throw new Error("Use --live for the bounded official API read.");
const envFile = await fs.readFile(".env.production", "utf8");
const keyLine = envFile.split(/\r?\n/u).find((line) => line.startsWith("YOUTUBE_API_KEY="));
const apiKey = keyLine?.slice("YOUTUBE_API_KEY=".length).trim().replace(/^['"]|['"]$/gu, "");
if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");
const code = await fs.readFile("lib/trend/discovery-collector.ts", "utf8");
const compiled = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { collectYouTubeDiscovery } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
let reserved = 0;
const result = await collectYouTubeDiscovery({
  apiKey,
  sourcePolicy: {
    key: "youtube", enabled: true,
    collectableFields: ["title", "description", "channel_id", "published_at", "duration", "statistics.view_count", "statistics.like_count", "statistics.comment_count", "status.embeddable", "status.privacy_status"],
    approvalBasis: "https://developers.google.com/youtube/terms/developer-policies",
    verifiedAt: new Date().toISOString(), retentionDays: 30,
  },
  lanes: {
    new_discovery: {
      callBudget: 2,
      seeds: [{ id: "local-meme-discovery", query: "밈 챌린지 패러디", publishedAfter: new Date(Date.now() - 14 * 86400000).toISOString() }],
    },
    candidate_tracking: { callBudget: 0, seeds: [] },
  },
  maxPagesPerSeed: 1, maxResultsPerPage: 15,
  reserveCall: () => ++reserved <= 2,
});
const outDir = path.resolve("artifacts/trend-discovery-local");
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "latest-observations.json");
await fs.writeFile(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), ...result }, null, 2));
console.log(JSON.stringify({
  status: result.status, records: result.records.length,
  verified: result.records.filter((record) => record.verificationStatus === "verified").length,
  candidateTerms: result.candidateTerms.length, callsUsed: result.callsUsed,
  failures: result.failures.map(({ method, httpStatus, reason }) => ({ method, httpStatus, reason })),
  artifact: outPath,
}, null, 2));
