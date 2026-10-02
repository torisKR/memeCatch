import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { createPublicCountFetch } from "@/lib/supabase/public-count-cache";

type RetryConfigurableClient = {
  rest: { retry?: boolean };
};

function isLoopbackUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출된 경우 — 미들웨어가 세션을 갱신함
          }
        },
      },
    }
  );
}

/** 인증 쿠키를 읽지 않는다. 공개 플랫폼 집계만 명시적으로 Data Cache에 넣는다. */
export function createStaticClient(options: { cachePublicCounts?: boolean } = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const client = createServerClient<Database>(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      ...(options.cachePublicCounts ? {
        global: { fetch: createPublicCountFetch(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) },
      } : {}),
    }
  );

  // 로컬 스택이 꺼졌을 때 PostgREST의 1s+2s+4s 재시도가 모든 공개 화면을
  // 붙잡지 않게 한다. 원격/프로덕션의 일시적 장애 재시도는 그대로 보존한다.
  if (isLoopbackUrl(supabaseUrl)) {
    (client as unknown as RetryConfigurableClient).rest.retry = false;
  }

  return client;
}
