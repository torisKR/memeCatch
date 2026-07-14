import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 페이지 방어심화(defense-in-depth) — proxy가 /admin 라우팅을 지키더라도
 * 각 페이지 상단에서 operator를 재확인한다(미들웨어 단독 의존 금지).
 * 비로그인 → /login?next=…, 비운영자 → /.
 * 통과 시 세션 supabase 클라이언트와 user를 반환해 페이지가 재사용한다.
 * (Server Action 쪽은 lib/actions/admin.ts의 requireOperator가 동일 검증을 수행)
 */
export async function requireOperatorPage(nextPath: string = "/admin") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "operator") redirect("/");
  return { supabase, user };
}
