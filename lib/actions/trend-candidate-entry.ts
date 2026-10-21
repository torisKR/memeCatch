"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canonicalizeEvidenceUrl } from "@/lib/trend/external-evidence";

export type TrendCandidateEntryActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const candidateKinds = [
  "new_meme",
  "alias",
  "variant",
  "revival",
  "popular_content",
] as const;

const platformSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "플랫폼을 입력해 주세요.")
  .max(50, "플랫폼 이름은 50자까지 입력할 수 있어요.")
  .regex(/^[a-z0-9][a-z0-9_.-]*$/u, "플랫폼은 영문 소문자와 숫자로 입력해 주세요.");

const candidateInputSchema = z.object({
  candidateName: z.string().trim().min(2, "후보 이름은 2자 이상 입력해 주세요.").max(120),
  aliases: z.string().max(1000),
  candidateKind: z.enum(candidateKinds),
  targetMemeId: z.union([z.literal(""), z.uuid("기존 밈 ID를 확인해 주세요.")]),
  sourceUrl: z.string().trim().max(2048),
  platform: platformSchema,
  platformContentId: z.string().trim().max(300),
  creatorKey: z.string().trim().max(300),
  publishedAt: z.string().trim().max(100),
  note: z.string().trim().max(2000),
});

const seedInputSchema = z.object({
  seedType: z.enum(["term", "account", "rss", "source"]),
  seedValue: z.string().trim().min(1, "탐색 값을 입력해 주세요.").max(1000),
  lane: z.enum(["new_discovery", "candidate_tracking"]),
  platform: z.string().trim().toLowerCase().max(50),
  enabled: z.boolean(),
  callBudget: z.coerce.number().int().min(0).max(1000),
});

class ActionError extends Error {}

type TrendEntryRpc = (
  functionName: "submit_trend_candidate_evidence" | "configure_trend_discovery_seed",
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) return true;

  if (host.includes(":")) {
    const normalized = host.split("%", 1)[0];
    return normalized === "::" || normalized === "::1" ||
      /^(?:fc|fd|fe[89ab])/iu.test(normalized) || normalized.startsWith("::ffff:");
  }

  if (/^\d+(?:\.\d+){3}$/u.test(host)) {
    const octets = host.split(".").map(Number);
    const [first, second] = octets;
    return octets.some((part) => part > 255) || first === 0 || first === 10 ||
      first === 127 || (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127) || first >= 224;
  }

  if ([".test", ".invalid", ".example", ".home.arpa"].some((suffix) => host.endsWith(suffix))) {
    return true;
  }
  const labels = host.split(".");
  return labels.length < 2 || labels.some((label) =>
    label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/iu.test(label),
  );
}

function validatePublicEvidenceUrl(value: string): string | null {
  if (value !== value.trim() || /[\u0000-\u0020\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" || url.username || url.password ||
      (url.port && url.port !== "443") || isPrivateOrLocalHost(url.hostname)
    ) return null;
    return canonicalizeEvidenceUrl(url.toString());
  } catch {
    return null;
  }
}

function parseAliases(value: string): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const raw of value.split(/[,\n]/u)) {
    const alias = raw.trim();
    const key = alias.toLocaleLowerCase("ko-KR");
    if (!alias || seen.has(key)) continue;
    if (alias.length > 120) throw new ActionError("별칭은 각각 120자까지 입력할 수 있어요.");
    seen.add(key);
    aliases.push(alias);
  }
  if (aliases.length > 20) throw new ActionError("별칭은 20개까지 입력할 수 있어요.");
  return aliases;
}

function parsePublishedAt(value: string): string | null {
  if (!value) return null;
  const seoulLocal = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
  let date: Date;
  if (seoulLocal) {
    const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond = "0"] = seoulLocal;
    const [year, month, day, hour, minute, second] = [
      rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond,
    ].map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (
      month < 1 || month > 12 || day < 1 || day > daysInMonth ||
      hour > 23 || minute > 59 || second > 59
    ) throw new ActionError("원문 게시 시각을 확인해 주세요.");
    date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second));
  } else {
    date = new Date(value);
  }
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) {
    throw new ActionError("원문 게시 시각을 확인해 주세요.");
  }
  return date.toISOString();
}

async function requireOperator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ActionError("로그인이 필요해요.");
  const { data: isOperator, error } = await supabase.rpc("is_operator");
  if (error || !isOperator) throw new ActionError("운영자 권한이 없어요.");
  return supabase;
}

export async function submitTrendCandidateEvidence(input: {
  candidateName: string;
  aliases: string;
  candidateKind: string;
  targetMemeId: string;
  sourceUrl: string;
  platform: string;
  platformContentId: string;
  creatorKey: string;
  publishedAt: string;
  note: string;
}): Promise<TrendCandidateEntryActionResult> {
  const parsed = candidateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  try {
    const sourceUrl = validatePublicEvidenceUrl(parsed.data.sourceUrl);
    if (!sourceUrl) throw new ActionError("공개 HTTPS 원문 주소를 확인해 주세요.");
    const aliases = parseAliases(parsed.data.aliases);
    const publishedAt = parsePublishedAt(parsed.data.publishedAt);
    const supabase = await requireOperator();
    const rpc = supabase.rpc as unknown as TrendEntryRpc;
    const { error } = await rpc("submit_trend_candidate_evidence", {
      p_candidate_name: parsed.data.candidateName,
      p_aliases: aliases,
      p_candidate_kind: parsed.data.candidateKind,
      p_target_meme_id: parsed.data.targetMemeId || null,
      p_source_url: sourceUrl,
      p_platform: parsed.data.platform,
      p_platform_content_id: parsed.data.platformContentId || null,
      p_creator_key: parsed.data.creatorKey || null,
      p_published_at: publishedAt,
      p_note: parsed.data.note || null,
    });
    if (error) throw new ActionError("수동 관찰 근거를 저장하지 못했어요.");
    revalidatePath("/admin/trend-candidates");
    return { ok: true, message: "수동 관찰을 미검수 후보로 저장했어요." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ActionError ? error.message : "수동 관찰 등록에 실패했어요.",
    };
  }
}

export async function configureTrendDiscoverySeed(input: {
  seedType: string;
  seedValue: string;
  lane: string;
  platform: string;
  enabled: boolean;
  callBudget: number;
}): Promise<TrendCandidateEntryActionResult> {
  const parsed = seedInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "탐색 설정을 확인해 주세요." };
  }

  try {
    let seedValue = parsed.data.seedValue;
    if (parsed.data.seedType === "rss" || parsed.data.seedType === "source") {
      const publicUrl = validatePublicEvidenceUrl(seedValue);
      if (!publicUrl) throw new ActionError("RSS·출처는 공개 HTTPS 주소로 입력해 주세요.");
      seedValue = publicUrl;
    }
    if (parsed.data.platform && !platformSchema.safeParse(parsed.data.platform).success) {
      throw new ActionError("플랫폼은 영문 소문자와 숫자로 입력해 주세요.");
    }
    const supabase = await requireOperator();
    const rpc = supabase.rpc as unknown as TrendEntryRpc;
    const { error } = await rpc("configure_trend_discovery_seed", {
      p_seed_type: parsed.data.seedType,
      p_seed_value: seedValue,
      p_lane: parsed.data.lane,
      p_platform: parsed.data.platform || null,
      p_enabled: parsed.data.enabled,
      p_call_budget: parsed.data.callBudget,
    });
    if (error) throw new ActionError("탐색 시드를 저장하지 못했어요.");
    revalidatePath("/admin/trend-candidates");
    return { ok: true, message: "탐색 시드와 호출 예산을 저장했어요." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ActionError ? error.message : "탐색 시드 설정에 실패했어요.",
    };
  }
}
