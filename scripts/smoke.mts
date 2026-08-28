/**
 * 핵심 route smoke — 프로덕션 빌드가 실제로 의미 있는 HTML을 내는지 확인한다.
 *
 *   npx next start -p 3100 &          # 또는 배포 URL
 *   SMOKE_BASE_URL=http://localhost:3100 node scripts/smoke.mts
 *
 * 원칙:
 *   - 의존성 0. Node HTTP 클라이언트 + 문자열 마커만 쓴다(구조 단언은 vitest 몫).
 *   - status 200만 믿지 않는다 — 에러 페이지도 200을 낼 수 있어, route마다
 *     "그 화면에만 있는" 한국어 마커를 함께 확인한다.
 *   - 읽기 전용. 어떤 쓰기 요청도 보내지 않는다.
 *
 * RELEASE_CHECKLIST 게이트 A의 「e2e 또는 핵심 route smoke 자동화」를 담당한다.
 */

import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");

type Check = {
  path: string;
  status?: number;
  /** 이 route가 정상 렌더될 때만 나타나는 마커들(AND) */
  markers: string[];
  /** 나타나면 실패로 보는 문자열 */
  forbidden?: string[];
};

const CHECKS: Check[] = [
  { path: "/", markers: ["밈캐치", "밈 검색"] },
  // 루프 006의 산정 기준 공개가 회귀하면 여기서 잡힌다.
  { path: "/rankings", markers: ["랭킹", "집계 기간"] },
  { path: "/explore", markers: ["탐색"] },
  {
    // 안정적인 고정 문서(루프 004~007 계측에 쓴 문서). 삭제되면 마커 교체.
    path: "/memes/uefmryky",
    markers: ["자기 직업 불법적으로 말하기", "사용 안전 신호등"],
    // 루프 003 회귀 가드 — 근거가 있으면 근거 수가, 없으면 준비 중이 보여야 하고
    // 무조건적 검수 주장 문구는 어디에도 없어야 한다.
    forbidden: ["밈캐치 검수팀 확인"],
  },
  {
    // 근거 0건 문서 — 루프 003의 정직한 표시가 살아 있어야 한다.
    path: "/memes/e8ferq5u",
    markers: ["근거 출처 준비 중"],
    forbidden: ["밈캐치 검수팀 확인"],
  },
  {
    path: "/memes/zzzzzzzz",
    status: 404,
    markers: ["신호 없음 · 404", "이 밈은... 아직 없네요"],
  },
  {
    path: "/en/memes/zzzzzzzz",
    status: 404,
    markers: ["신호 없음 · 404", "이 밈은... 아직 없네요"],
  },
];

function getDocument(url: string, redirects = 0): Promise<{ status: number; body: string }> {
  const get = url.startsWith("https:") ? httpsGet : httpGet;
  return new Promise((resolve, reject) => {
    get(url, { headers: { accept: "text/html" } }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location && redirects < 5) {
        response.resume();
        resolve(getDocument(new URL(response.headers.location, url).toString(), redirects + 1));
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status, body }));
    }).on("error", reject);
  });
}

async function run() {
  let failed = 0;
  for (const check of CHECKS) {
    const url = `${BASE}${check.path}`;
    let status = 0;
    let body = "";
    try {
      ({ status, body } = await getDocument(url));
    } catch (err) {
      console.error(`FAIL ${check.path} — 요청 실패: ${(err as Error).message}`);
      failed += 1;
      continue;
    }

    const problems: string[] = [];

    const expectedStatus = check.status ?? 200;
    if (status !== expectedStatus) problems.push(`${expectedStatus} 기대, ${status} 수신`);
    for (const marker of check.markers) {
      if (!body.includes(marker)) problems.push(`마커 누락: "${marker}"`);
    }
    for (const bad of check.forbidden ?? []) {
      if (body.includes(bad)) problems.push(`금지 문자열 검출: "${bad}"`);
    }

    if (problems.length > 0) {
      failed += 1;
      console.error(`FAIL ${check.path}\n  - ${problems.join("\n  - ")}`);
    } else {
      console.log(`ok   ${check.path} (${status})`);
    }
  }

  if (failed > 0) {
    console.error(`\nsmoke 실패: ${failed}/${CHECKS.length}`);
    process.exitCode = 1;
  } else {
    console.log(`\nsmoke 통과: ${CHECKS.length}/${CHECKS.length} (${BASE})`);
  }
}

run();
