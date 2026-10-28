import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * 과거의 조합형 1,000건 생성기는 실제 수집 근거 없이 제목·설명을 만들 수 있어
 * 비활성화했다. 실제 외부 신호는 Radar 후보 큐와 관리자 URL 등록을 사용한다.
 */
export async function POST(_request: Request) {
  void _request;
  const supabase = await createClient();
  const { data: isOperator, error } = await supabase.rpc("is_operator");
  if (error || !isOperator) {
    return NextResponse.json(
      { ok: false, error: "운영자 권한이 필요해요." },
      { status: 403 },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: "근거 없는 조합형 후보 생성은 중단되었습니다. 외부 확산 후보 큐 또는 출처 URL 등록을 사용해 주세요.",
      replacement: "/admin/trend-candidates",
    },
    { status: 410 },
  );
}
