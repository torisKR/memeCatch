import { NextResponse } from "next/server";
import { z } from "zod";

import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";
import { createClient } from "@/lib/supabase/server";
import {
  generateMemeConcepts,
  MEME_FORMATS,
  MEME_TONES,
} from "@/lib/meme-studio.server";

/** AI 밈 스튜디오 생성 엔드포인트 — IP당 시간 10회, 결과는 캐시하지 않는다. */

const bodySchema = z.object({
  topic: z.string().trim().min(2).max(120),
  tone: z.enum(MEME_TONES),
  format: z.enum(MEME_FORMATS),
});

const RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 } as const;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await readBoundedJson(request, 4 * 1024);
  } catch {
    return NextResponse.json({ error: "JSON 요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "topic(2~120자), tone, format을 올바르게 보내 주세요." },
      { status: 400 }
    );
  }

  const limit = rateLimit(`meme-studio:${getClientIp(request)}`, RATE_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } }
    );
  }

  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    const result = await generateMemeConcepts(parsed.data, Boolean(user));
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "아이디어 생성에 실패했습니다. 다시 시도해 주세요." },
      { status: 503 }
    );
  }
}
