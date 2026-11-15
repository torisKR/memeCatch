#!/usr/bin/env node

const ORIGIN_REVIEW_PACK = [
  { slug: "도마도마-챌린지", country: "BR", localTitle: "Toma Toma Challenge", evidenceUrl: "https://letter.wepick.kr/post/23723" },
  { slug: "귀여워서-미안해", country: "JP", localTitle: "可愛くてごめん", evidenceUrl: "https://ko.wikipedia.org/wiki/%EA%B7%80%EC%97%AC%EC%9B%8C%EC%84%9C_%EB%AF%B8%EC%95%88%ED%95%B4" },
  { slug: "이라이라-챌린지", country: "JP", localTitle: "イライラチャレンジ", evidenceUrl: "https://www.youtube.com/watch?v=gZ6GCc24kW4" },
  { slug: "DDR(댄스-댄스-레볼루션)-오락실-열풍", country: "JP", localTitle: "Dance Dance Revolution", evidenceUrl: "https://www.ohmynews.com/NWS_Web/View/at_pg.aspx?CNTN_CD=A0002079962" },
  { slug: "중2병", country: "JP", localTitle: "中二病", evidenceUrl: "https://namu.wiki/w/%EC%A4%912%EB%B3%91" },
  { slug: "코피페", country: "JP", localTitle: "コピペ", evidenceUrl: "https://namu.wiki/w/코피페" },
  { slug: "탑블레이드-열풍", country: "JP", localTitle: "爆転シュート ベイブレード", evidenceUrl: "https://www.youtube.com/watch?v=QcA3tk7aqA8" },
  { slug: "아이스버킷챌린지", country: "US", localTitle: "Ice Bucket Challenge", evidenceUrl: "https://www.youtube.com/watch?v=mirTnuC5gAs" },
  { slug: "원칩챌린지", country: "US", localTitle: "One Chip Challenge", evidenceUrl: "https://namu.wiki/w/%ED%8C%8C%ED%80%B4%20%EC%9B%90%20%EC%B9%A9%20%EC%B1%8C%EB%A6%B0%EC%A7%80" },
  { slug: "프레피룩", country: "US", localTitle: "Preppy style", evidenceUrl: "https://www.instagram.com/reel/DLmt9BtRWnr/" },
  { slug: "50번-점프-챌린지", country: "US", localTitle: "50 Jumps Challenge", evidenceUrl: "https://www.tiktok.com/@ccatch_upp/video/7567253148931247367" },
  { slug: "찹츄찹찹츄", country: "CN", localTitle: "恰恰恰恰恰", evidenceUrl: "https://www.tiktok.com/@bookssoon/video/7598786065373121810" },
  { slug: "흑당버블티-대란", country: "TW", localTitle: "黑糖珍珠奶茶", evidenceUrl: "https://namu.wiki/w/%ED%9D%91%EB%8B%B9%20%EB%B2%84%EB%B8%94%ED%8B%B0" },
];

function usage() {
  return [
    "Usage: node scripts/review-international-meme-origins.mjs [--apply] [--confirm-remote] [--json]",
    "",
    "Defaults to a read-only dry run. --apply requires MEMECATCH_OPERATOR_JWT.",
    "Remote writes also require --confirm-remote. The RPC records the authenticated operator.",
  ].join("\n");
}

function parseArgs(argv) {
  const flags = new Set(argv);
  const allowed = new Set(["--apply", "--confirm-remote", "--help", "--json"]);
  const unknown = argv.find((arg) => !allowed.has(arg));
  if (unknown) throw new Error(`unknown argument: ${unknown}`);
  return {
    apply: flags.has("--apply"),
    confirmRemote: flags.has("--confirm-remote"),
    help: flags.has("--help"),
    json: flags.has("--json"),
  };
}

function requiredEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function isLocalSupabase(url) {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost";
}

async function jsonResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String(payload.message)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function loadCandidate({ baseUrl, anonKey, candidate, fetchImpl }) {
  const search = new URLSearchParams({
    select: "id,slug,title,meme_sources(id,source_url)",
    slug: `eq.${candidate.slug}`,
    limit: "2",
  });
  const rows = await jsonResponse(await fetchImpl(`${baseUrl}/rest/v1/memes?${search}`, {
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
  }));
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(`${candidate.slug}: expected exactly one public meme`);
  }
  const row = rows[0];
  const sources = Array.isArray(row.meme_sources) ? row.meme_sources : [];
  const evidenceSource = sources.find((source) => source?.source_url === candidate.evidenceUrl);
  if (!evidenceSource?.id) {
    throw new Error(`${candidate.slug}: reviewed evidence source is missing`);
  }
  return { row, evidenceSourceId: evidenceSource.id };
}

async function applyCountry({ baseUrl, anonKey, operatorJwt, candidate, memeId, evidenceSourceId, fetchImpl }) {
  await jsonResponse(await fetchImpl(`${baseUrl}/rest/v1/rpc/set_meme_origin_country_with_evidence`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${operatorJwt}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_meme_id: memeId,
      p_market_code: candidate.country,
      p_local_title: candidate.localTitle,
      p_evidence_source_id: evidenceSourceId,
    }),
  }));
}

export async function reviewInternationalMemeOrigins({
  env = process.env,
  argv = process.argv.slice(2),
  fetchImpl = fetch,
} = {}) {
  const options = parseArgs(argv);
  if (options.help) return { help: usage() };

  const baseUrl = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const anonKey = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const remote = !isLocalSupabase(baseUrl);
  if (options.apply && remote && !options.confirmRemote) {
    throw new Error("remote apply requires --confirm-remote");
  }
  const operatorJwt = options.apply ? requiredEnv(env, "MEMECATCH_OPERATOR_JWT") : null;

  const reviewed = [];
  for (const candidate of ORIGIN_REVIEW_PACK) {
    const { row, evidenceSourceId } = await loadCandidate({
      baseUrl,
      anonKey,
      candidate,
      fetchImpl,
    });
    if (options.apply && operatorJwt) {
      await applyCountry({
        baseUrl,
        anonKey,
        operatorJwt,
        candidate,
        memeId: row.id,
        evidenceSourceId,
        fetchImpl,
      });
    }
    reviewed.push({ slug: candidate.slug, country: candidate.country });
  }

  return {
    mode: options.apply ? "apply" : "dry-run",
    remote,
    reviewed: reviewed.length,
    countries: reviewed.reduce((counts, item) => ({
      ...counts,
      [item.country]: (counts[item.country] ?? 0) + 1,
    }), {}),
  };
}

export { ORIGIN_REVIEW_PACK };

if (import.meta.url === `file://${process.argv[1]}`) {
  reviewInternationalMemeOrigins()
    .then((result) => {
      if ("help" in result) console.log(result.help);
      else console.log(JSON.stringify(result, null, process.argv.includes("--json") ? 0 : 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
