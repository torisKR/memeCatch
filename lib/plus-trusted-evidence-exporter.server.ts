import "server-only";

import {
  buildPlusGlobalActionEvidenceInbox,
  type PlusGlobalActionInboxInput,
  type PlusGlobalActionKind,
} from "@/lib/plus-global-action-inbox";
import type { Locale } from "@/lib/i18n";

export const PLUS_TRUSTED_EVIDENCE_SET_LIMIT = 20;

export type PlusTrustedEvidenceSupabase = {
  rpc(
    name: "is_trusted_one_cut_meme",
    args: { p_meme_id: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

export type PlusTrustedEvidenceItem = {
  rank: number;
  memeId: string;
  kind: PlusGlobalActionKind;
  locale: Locale;
  changedAt: string | null;
  trendScore: number;
};

export type PlusTrustedEvidenceSet = {
  schemaVersion: "plus-trusted-evidence-set-v1";
  status: "active" | "empty" | "unavailable";
  dateKey: string;
  locale: Locale;
  items: PlusTrustedEvidenceItem[];
};

export async function loadTrustedOneCutMemeIds(
  supabase: PlusTrustedEvidenceSupabase,
  memeIds: readonly string[],
): Promise<Set<string> | null> {
  const trustResults = await Promise.all(
    memeIds.map(async (memeId) => ({
      memeId,
      result: await supabase.rpc("is_trusted_one_cut_meme", { p_meme_id: memeId }),
    })),
  );
  if (trustResults.some(({ result }) => result.error || typeof result.data !== "boolean")) {
    return null;
  }

  return new Set(
    trustResults.flatMap(({ memeId, result }) => result.data === true ? [memeId] : []),
  );
}

export async function exportPlusTrustedEvidenceSet({
  supabase,
  dateKey,
  inbox,
  knownTrustedMemeIds = [],
}: {
  supabase: PlusTrustedEvidenceSupabase;
  dateKey: string;
  inbox: PlusGlobalActionInboxInput;
  knownTrustedMemeIds?: readonly string[];
}): Promise<PlusTrustedEvidenceSet> {
  const candidateMemeIds = [...new Set([
    ...inbox.fulfillment.items.map((item) => item.memeId),
    ...inbox.signals.map((item) => item.id),
    ...inbox.scout.items.map((item) => item.id),
    ...(inbox.replayItem ? [inbox.replayItem.memeId] : []),
    ...(inbox.globalDailyCandidate ? [inbox.globalDailyCandidate.memeId] : []),
  ])];

  const knownTrusted = new Set(knownTrustedMemeIds);
  const probedTrustedMemeIds = await loadTrustedOneCutMemeIds(
    supabase,
    candidateMemeIds.filter((memeId) => !knownTrusted.has(memeId)),
  );
  if (!probedTrustedMemeIds) {
    return evidenceSet("unavailable", dateKey, inbox.locale, []);
  }
  const trustedMemeIds = new Set([...knownTrusted, ...probedTrustedMemeIds]);

  const ranked = buildPlusGlobalActionEvidenceInbox({
    ...inbox,
    fulfillment: {
      ...inbox.fulfillment,
      items: inbox.fulfillment.items.filter((item) => trustedMemeIds.has(item.memeId)),
    },
    signals: inbox.signals.filter((item) => trustedMemeIds.has(item.id)),
    scout: {
      ...inbox.scout,
      items: inbox.scout.items.filter((item) => trustedMemeIds.has(item.id)),
    },
    preferredMemeId:
      inbox.preferredMemeId && trustedMemeIds.has(inbox.preferredMemeId)
        ? inbox.preferredMemeId
        : undefined,
    replayItem:
      inbox.replayItem && trustedMemeIds.has(inbox.replayItem.memeId)
        ? inbox.replayItem
        : undefined,
    globalDailyCandidate:
      inbox.globalDailyCandidate && trustedMemeIds.has(inbox.globalDailyCandidate.memeId)
        ? inbox.globalDailyCandidate
        : undefined,
    limit: PLUS_TRUSTED_EVIDENCE_SET_LIMIT,
  }).items;

  const items = ranked.map((item, index): PlusTrustedEvidenceItem => ({
    rank: index + 1,
    memeId: item.memeId,
    kind: item.kind,
    locale: item.locale,
    changedAt: item.changedAt,
    trendScore: item.trendScore,
  }));

  return evidenceSet(items.length > 0 ? "active" : "empty", dateKey, inbox.locale, items);
}

function evidenceSet(
  status: PlusTrustedEvidenceSet["status"],
  dateKey: string,
  locale: Locale,
  items: PlusTrustedEvidenceItem[],
): PlusTrustedEvidenceSet {
  return {
    schemaVersion: "plus-trusted-evidence-set-v1",
    status,
    dateKey,
    locale,
    items,
  };
}
