#!/usr/bin/env node
/**
 * 레인 3 — 커뮤니티 시드 스크립트.
 * 1) auth admin API로 봇 유저 3명 생성(이미 있으면 재사용) + profiles 닉네임 upsert
 * 2) 실제 DB의 밈을 참조하는 자연스러운 한국어 글 10개 삽입 (service_role 직접 insert — RLS 우회)
 *
 * 실행: node scripts/seed-community.mjs
 * .env.local의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 사용 (키 값 출력 금지).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) env[m[1]] = v;
    }
  } catch {
    /* .env.local 없으면 process.env만 사용 */
  }
  return env;
}

const env = loadEnv();
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요해요.");
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  return { ok: res.ok, status: res.status, json, text };
}

// ── 1. 봇 유저 생성 ────────────────────────────────────────
const BOTS = [
  { email: "bot1@memecatch.internal", nickname: "밈수집가" },
  { email: "bot2@memecatch.internal", nickname: "옛날밈덕후" },
  { email: "bot3@memecatch.internal", nickname: "트렌드헌터" },
];

async function findUserByEmail(email) {
  // GoTrue admin: 페이지 순회로 이메일 매칭 (소규모 프로젝트 전제)
  for (let page = 1; page <= 10; page++) {
    const { ok, json } = await api(
      `/auth/v1/admin/users?page=${page}&per_page=100`
    );
    if (!ok) return null;
    const users = json?.users ?? [];
    const hit = users.find((u) => u.email === email);
    if (hit) return hit;
    if (users.length < 100) return null;
  }
  return null;
}

async function ensureBot(bot) {
  const created = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: bot.email,
      email_confirm: true,
      user_metadata: { nickname: bot.nickname },
    }),
  });
  let userId = created.ok ? created.json?.id : null;
  if (!userId) {
    const existing = await findUserByEmail(bot.email);
    if (!existing) {
      throw new Error(`봇 생성 실패: ${bot.email} (status ${created.status})`);
    }
    userId = existing.id;
  }
  // 프로필 닉네임 upsert (handle_new_user 트리거가 이미 만들었어도 덮어씀)
  const upsert = await api("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ id: userId, nickname: bot.nickname }]),
  });
  if (!upsert.ok) {
    // 닉네임 unique 충돌 등 — 트리거 기본 닉네임 유지, 시드는 계속 진행
    console.warn(`profiles upsert 경고: ${bot.nickname} (status ${upsert.status})`);
  }
  return userId;
}

// ── 2. 실제 밈 조회 ────────────────────────────────────────
async function fetchMemes() {
  const { ok, json } = await api(
    "/rest/v1/memes?select=id,title,origin_year&moderation_status=in.(approved,limited)&order=trend_score.desc&limit=12"
  );
  if (!ok || !Array.isArray(json)) throw new Error("밈 조회 실패");
  return json;
}

// ── 3. 시드 글 ─────────────────────────────────────────────
function buildPosts(botIds, memes) {
  const m = (i) => memes[i % memes.length];
  const now = Date.now();
  const daysAgo = (d, h = 0) =>
    new Date(now - d * 86400000 - h * 3600000).toISOString();

  return [
    {
      user_id: botIds[0],
      title: `요즘 "${m(0).title}" 아직도 쓰는 사람 있나요?`,
      body: `회사 단톡에서 "${m(0).title}" 썼다가 순간 정적이 흘렀는데... 저만 아직 쓰는 건가요?\n다들 요즘도 쓰시는지, 아니면 이미 한물간 밈인지 궁금해요.`,
      meme_id: m(0).id,
      created_at: daysAgo(6, 3),
    },
    {
      user_id: botIds[1],
      title: "1990~2000년대 밈 중에 최고는 뭐라고 생각하세요?",
      body: `요즘 밈도 좋지만 옛날 밈 특유의 감성이 있잖아요.\n개인적으로는 싸이월드 시절 유행어들이 제일 그리운데, 여러분의 최고 추억 밈은 뭔가요?\n댓글로 공유해 주세요. 하나씩 찾아보는 재미가 있네요.`,
      meme_id: null,
      created_at: daysAgo(5, 7),
    },
    {
      user_id: botIds[2],
      title: `"${m(1).title}" 이거 유래 아는 분?`,
      body: `SNS에서 "${m(1).title}" 계속 보이는데 정확한 유래가 궁금해요.\n밈캐치 사전 보고 대충 감은 잡았는데, 실제로 처음 퍼진 곳이 어딘지 아시는 분 있으면 알려 주세요!`,
      meme_id: m(1).id,
      created_at: daysAgo(5, 1),
    },
    {
      user_id: botIds[0],
      title: "부장님이 밈 쓰기 시작하면 그 밈은 끝난 걸까요?",
      body: `오늘 저희 부장님이 회의에서 밈을 쓰셨어요. 순간 다들 웃긴 했는데,\n"윗세대까지 퍼지면 그 밈은 수명이 끝났다"는 말이 있잖아요.\n여러분 생각은 어때요? 오히려 국민 밈으로 등극한 거라는 의견도 있던데.`,
      meme_id: null,
      created_at: daysAgo(4, 5),
    },
    {
      user_id: botIds[1],
      title: `"${m(2).title}" 처음 봤을 때 무슨 뜻인지 몰랐던 사람 저뿐인가요`,
      body: `솔직히 고백합니다. "${m(2).title}" 처음 봤을 때 한참 검색했어요.\n주변에 물어보기는 좀 그렇고... 밈캐치 덕분에 겨우 따라잡았네요.\n다들 처음에 뜻 몰라서 검색해 본 밈 하나씩 있죠? 뭐였는지 궁금해요.`,
      meme_id: m(2).id,
      created_at: daysAgo(4, 2),
    },
    {
      user_id: botIds[2],
      title: "이번 주 뜨는 밈 정리해 봤어요",
      body: `탐색 탭 급상승 보다가 정리해 봤는데, 이번 주는 유독 짤 계열이 강세네요.\n숏폼에서 시작된 밈이 커뮤니티로 넘어오는 속도가 점점 빨라지는 느낌이에요.\n다음 주에 뜰 것 같은 밈 예측해 보실 분?`,
      meme_id: null,
      created_at: daysAgo(3, 6),
    },
    {
      user_id: botIds[0],
      title: `밈 모으는 사람 특: "${m(3).title}" 같은 거 폴더에 저장함`,
      body: `저는 웃긴 밈 보면 일단 저장부터 하는데, 폴더 열어 보니 몇 년치가 쌓여 있더라고요.\n"${m(3).title}"도 그중 하나인데 지금 봐도 웃겨요.\n여러분도 밈 저장하는 습관 있나요? 제일 오래된 저장 밈 뭔지 궁금하네요.`,
      meme_id: m(3).id,
      created_at: daysAgo(3, 1),
    },
    {
      user_id: botIds[1],
      title: "밈 때문에 세대 차이 느낀 순간",
      body: `조카(10대)랑 대화하다가 요즘 밈을 하나도 못 알아들어서 충격받았어요.\n반대로 제가 아는 밈 얘기하니까 조카가 "그게 뭐예요?" 하더라고요...\n다들 밈으로 세대 차이 느낀 에피소드 있으면 풀어 주세요. 위로가 필요합니다.`,
      meme_id: null,
      created_at: daysAgo(2, 4),
    },
    {
      user_id: botIds[2],
      title: `"${m(4).title}" 지금 써도 되는 밈인지 궁금해요`,
      body: `친구들이랑은 잘 쓰는데 공적인 자리에서 써도 되는 밈인지 애매하더라고요.\n밈캐치 신호등 보니까 상황에 따라 다른 것 같던데,\n실제로 회사나 학교에서 써 보신 분들 반응이 어땠는지 궁금해요.`,
      meme_id: m(4).id,
      created_at: daysAgo(1, 8),
    },
    {
      user_id: botIds[0],
      title: "여러분 인생 밈 하나만 공유해 주세요",
      body: `힘들 때마다 꺼내 보는 인생 밈 하나쯤 다들 있잖아요.\n저는 몇 년째 같은 밈 보면서 웃고 있는데, 새로운 인생 밈을 영입하고 싶어요.\n제목만 남겨 주셔도 제가 검색해서 찾아볼게요!`,
      meme_id: null,
      created_at: daysAgo(0, 5),
    },
  ];
}

// ── 실행 ──────────────────────────────────────────────────
async function main() {
  const botIds = [];
  for (const bot of BOTS) {
    const id = await ensureBot(bot);
    botIds.push(id);
    console.log(`봇 준비 완료: ${bot.nickname}`);
  }

  const memes = await fetchMemes();
  if (memes.length === 0) throw new Error("참조할 밈이 없어요.");
  console.log(`밈 ${memes.length}개 참조 대상 확보`);

  const posts = buildPosts(botIds, memes);
  const inserted = await api("/rest/v1/community_posts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(posts),
  });
  if (!inserted.ok) {
    throw new Error(`글 삽입 실패 (status ${inserted.status}): ${inserted.text.slice(0, 300)}`);
  }
  console.log(`커뮤니티 글 ${inserted.json.length}개 삽입 완료`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
