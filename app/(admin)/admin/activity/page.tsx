import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { ActivityDashboard } from "@/components/admin/activity-dashboard";
import { adminActivitySchema, parseActivityFilters, type ActivitySearch } from "@/lib/admin-activity";

export const metadata = { title: "사용자 활동" };
export const dynamic = "force-dynamic";

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<ActivitySearch> }) {
  const { supabase } = await requireOperatorPage("/admin/activity");
  const { filters, today, error: inputError } = parseActivityFilters(await searchParams);
  let data = null;
  let error = inputError;
  if (!error) {
    try {
      const result = await supabase.rpc("get_admin_activity_dashboard", {
        p_from: filters.from, p_to: filters.to, p_hour_date: filters.hourDate,
        p_user_id: filters.userId || undefined, p_subscribers_only: filters.subscribersOnly,
        p_users_page: filters.usersPage, p_views_page: filters.viewsPage,
      });
      const parsed = adminActivitySchema.safeParse(result.data);
      if (result.error || !parsed.success) throw new Error("activity_unavailable");
      data = parsed.data;
    } catch {
      error = "활동 데이터를 불러오지 못했습니다. 관리자 권한과 DB 마이그레이션 상태를 확인한 뒤 다시 조회해 주세요.";
    }
  }
  return <ActivityDashboard data={data} error={error} filters={filters} today={today} />;
}
