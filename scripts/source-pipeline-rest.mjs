/**
 * 출처 파이프라인 스크립트 공용 PostgREST 헬퍼.
 * 키는 .env.local의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY에서 읽는다.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local이 없으면 프로세스 환경변수만 사용한다(CI).
  }
  return env;
}

export function createRestClient(env = loadEnv()) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락 (.env.local)");
    process.exit(1);
  }

  return async function rest(path, init = {}) {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 300)}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
}

/** 행 전체를 페이지네이션으로 가져온다(PostgREST 기본 1000행 제한 우회). */
export async function restAll(rest, path, { pageSize = 1000 } = {}) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await rest(`${path}${sep}offset=${offset}&limit=${pageSize}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}
