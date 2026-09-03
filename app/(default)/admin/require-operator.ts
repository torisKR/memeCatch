import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  withAllowlistedSearch,
  type AuthReturnSearch,
} from "@/lib/safe-redirect";

/**
 * 관리자 페이지 방어심화(defense-in-depth) — proxy가 /admin 라우팅을 지키더라도
 * 각 페이지 상단에서 operator를 재확인한다(미들웨어 단독 의존 금지).
 * 비로그인 → /login?next=…, 비운영자 → /.
 * `next`는 경로 + allowlist된 search만 담는다(예: focus=unsourced).
 * 통과 시 세션 supabase 클라이언트와 user를 반환해 페이지가 재사용한다.
 * (Server Action 쪽은 lib/actions/admin.ts의 requireOperator가 동일 검증을 수행)
 */
export async function requireOperatorPage(
  nextPath: string = "/admin",
  search?: AuthReturnSearch,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const next = withAllowlistedSearch(nextPath, search);
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: isOperator } = await supabase.rpc("is_operator");
  if (!isOperator) redirect("/");
  return { supabase, user };
}
