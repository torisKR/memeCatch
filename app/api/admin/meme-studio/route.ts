import { z } from "zod";

import {
  generateAdminMemeConcepts,
  MEME_FORMATS,
  MEME_TONES,
} from "@/lib/meme-studio.server";
import { createClient } from "@/lib/supabase/server";
import { isMemeCountryCode } from "@/lib/meme-country";
import { hasTrustedOrigin } from "@/lib/origin";

const bodySchema = z.object({
  topic: z.string().trim().min(2).max(120),
  tone: z.enum(MEME_TONES),
  format: z.enum(MEME_FORMATS),
  country: z.string().refine(isMemeCountryCode),
});

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "signed_out" }, { status: 401 });
  }

  const { data: isOperator } = await supabase.rpc("is_operator");
  if (!isOperator) {
    return Response.json({ error: "operator_required" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "topic(2~120자), tone, format, country를 올바르게 보내 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await generateAdminMemeConcepts(parsed.data);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    console.error("meme_studio_bedrock_unavailable");
    return Response.json(
      { error: "bedrock_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
