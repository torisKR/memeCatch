import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { SITE_URL } from "@/lib/site";

/** OAuth/매직링크 코드 교환 콜백 — 이메일+비밀번호 로그인은 사용하지 않지만 확장 대비 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = rawNext === "/reset-password" ? rawNext : safeNext(rawNext);

  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${SITE_URL}${next}`);
    return NextResponse.redirect(`${SITE_URL}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(`${SITE_URL}${next}`);

  return NextResponse.redirect(`${SITE_URL}/login?error=auth`);
}
