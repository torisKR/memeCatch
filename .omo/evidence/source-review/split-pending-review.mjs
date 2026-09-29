#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { createRestClient, restAll } from "../../../scripts/source-pipeline-rest.mjs";

const keysFile = process.env.KEYS_FILE;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const laneCount = Number(process.argv.find((arg) => arg.startsWith("--lanes="))?.split("=")[1] ?? 5);
const outputPrefix = process.argv.find((arg) => arg.startsWith("--output-prefix="))?.split("=").slice(1).join("=");

if (!keysFile || !outputPrefix || !Number.isInteger(laneCount) || laneCount < 1) {
  throw new Error("KEYS_FILE, --output-prefix and a positive --lanes are required");
}
if (!supabaseUrl?.includes("onjipuldngbdptldkpoe")) {
  throw new Error("refusing non-production or unexpected Supabase project");
}

const keyRows = JSON.parse(readFileSync(keysFile, "utf8"));
const serviceRole = keyRows.find((row) => row.id === "service_role" || row.name === "service_role");
const serviceKey = serviceRole?.api_key ?? serviceRole?.apiKey ?? serviceRole?.key;
if (!serviceKey) throw new Error("service_role key not found");

const rest = createRestClient({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
});
const pending = await restAll(
  rest,
  "meme_media?select=meme_id,source_id,memes(title)&review_state=eq.pending",
);
const grouped = new Map();
for (const row of pending) {
  const group = grouped.get(row.meme_id) ?? {
    meme_id: row.meme_id,
    title: row.memes?.title ?? "",
    pending_count: 0,
  };
  group.pending_count += 1;
  grouped.set(row.meme_id, group);
}

const lanes = Array.from({ length: laneCount }, (_, index) => ({
  lane: index + 1,
  pending_count: 0,
  groups: [],
}));
for (const group of [...grouped.values()].sort((a, b) => b.pending_count - a.pending_count || a.title.localeCompare(b.title, "ko"))) {
  lanes.sort((a, b) => a.pending_count - b.pending_count || a.groups.length - b.groups.length || a.lane - b.lane);
  lanes[0].groups.push(group);
  lanes[0].pending_count += group.pending_count;
}
lanes.sort((a, b) => a.lane - b.lane);

for (const lane of lanes) {
  writeFileSync(`${outputPrefix}-${lane.lane}.json`, `${JSON.stringify(lane.groups, null, 2)}\n`, { mode: 0o600 });
}

console.log(JSON.stringify({
  pending_rows: pending.length,
  pending_groups: grouped.size,
  lanes: lanes.map((lane) => ({ lane: lane.lane, groups: lane.groups.length, pending_rows: lane.pending_count })),
}));
