"use server";

/**
 * 레인 D — 관리자 사용자 관리.
 * auth.users는 RLS 대상이 아니라 Admin API로만 읽고, 다른 사용자의 billing_*는
 * RLS가 self-read만 허용하므로 service-role 클라이언트로 조회한다.
 * 모든 액션은 requireOperator로 운영자를 재확인하고, 변경은 admin_audit_log에 남긴다.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "operator") throw new Error("운영자 권한이 없어요.");
  return { uid: user.id };
}

async function logAudit(
  actorId: string,
  action: string,
  entityId: string | null,
  detail?: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "user",
    entity_id: entityId,
    detail: (detail ?? null) as Json,
  });
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.";
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  nickname: string | null;
  role: string | null;
  provider: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  isPremium: boolean;
  plusStatus: string | null;
  plusUntil: string | null;
};

export type AdminPaymentEvent = {
  id: string;
  orderId: string;
  status: string;
  amount: number | null;
  customerEmail: string;
  occurredAt: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  processingError: string | null;
};

export type AdminUserDetail = AdminUserRow & {
  ageGroup: string | null;
  interests: string[] | null;
  trustScore: number | null;
  hasBillingIdentity: boolean;
  subscriptions: {
    orderId: string;
    status: string;
    amount: number;
    currentPeriodEnd: string;
    lastEventAt: string;
    isManual: boolean;
  }[];
  payments: AdminPaymentEvent[];
};

function isActive(status: string | null, until: string | null): boolean {
  if (status !== "active" || !until) return false;
  const end = Date.parse(until);
  return Number.isFinite(end) && end > Date.now();
}

/** 사용자 목록 — 이메일/닉네임 부분 검색, 최신 가입순 */
export async function listUsers(input: {
  query?: string;
  limit?: number;
}): Promise<ActionResult<AdminUserRow[]>> {
  try {
    await requireOperator();
    const admin = createAdminClient();
    const limit = Math.max(1, Math.min(input.limit ?? 200, 1000));

    const { data: authList, error: authErr } =
      await admin.auth.admin.listUsers({ page: 1, perPage: limit });
    if (authErr) return { ok: false, error: authErr.message };

    const ids = authList.users.map((u) => u.id);
    if (ids.length === 0) return { ok: true, data: [] };

    const [{ data: profiles }, { data: subs }] = await Promise.all([
      admin.from("profiles").select("id, nickname, role").in("id", ids),
      admin
        .from("billing_subscriptions")
        .select("user_id, status, current_period_end, external_order_id")
        .in("user_id", ids),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const bestSub = new Map<
      string,
      { status: string; current_period_end: string }
    >();
    for (const s of subs ?? []) {
      const prev = bestSub.get(s.user_id);
      const better =
        !prev ||
        (isActive(s.status, s.current_period_end) &&
          !isActive(prev.status, prev.current_period_end)) ||
        Date.parse(s.current_period_end) > Date.parse(prev.current_period_end);
      if (better) {
        bestSub.set(s.user_id, {
          status: s.status,
          current_period_end: s.current_period_end,
        });
      }
    }

    const q = (input.query ?? "").trim().toLowerCase();
    const rows: AdminUserRow[] = authList.users
      .map((u) => {
        const p = profileById.get(u.id);
        const sub = bestSub.get(u.id) ?? null;
        return {
          id: u.id,
          email: u.email ?? null,
          nickname: p?.nickname ?? null,
          role: p?.role ?? null,
          provider:
            (u.app_metadata as { provider?: string } | null)?.provider ?? null,
          createdAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
          isPremium: isActive(sub?.status ?? null, sub?.current_period_end ?? null),
          plusStatus: sub?.status ?? null,
          plusUntil: sub?.current_period_end ?? null,
        };
      })
      .filter((r) =>
        q
          ? (r.email ?? "").toLowerCase().includes(q) ||
            (r.nickname ?? "").toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 사용자 상세 — 계정정보 + 구독 + 결제 이력 */
export async function getUserDetail(
  userId: string
): Promise<ActionResult<AdminUserDetail>> {
  try {
    await requireOperator();
    const admin = createAdminClient();

    const { data: authUser, error: authErr } =
      await admin.auth.admin.getUserById(userId);
    if (authErr || !authUser?.user) {
      return { ok: false, error: "사용자를 찾을 수 없어요." };
    }
    const u = authUser.user;

    const [{ data: profile }, { data: subs }, { data: identity }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("nickname, role, age_group, interests, trust_score")
          .eq("id", userId)
          .maybeSingle(),
        admin
          .from("billing_subscriptions")
          .select(
            "external_order_id, status, amount, current_period_end, last_event_at"
          )
          .eq("user_id", userId)
          .order("current_period_end", { ascending: false }),
        admin
          .from("billing_identities")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    // 결제 이력: 계정에 매칭된 이벤트 + 같은 이메일로 들어온 미매칭 이벤트까지
    const email = (u.email ?? "").toLowerCase();
    const { data: events } = await admin
      .from("billing_webhook_events")
      .select(
        "id, order_id, status, amount, customer_email, occurred_at, received_at, processed_at, processing_error, matched_user_id"
      )
      .or(
        email
          ? `matched_user_id.eq.${userId},customer_email.eq.${email}`
          : `matched_user_id.eq.${userId}`
      )
      .order("occurred_at", { ascending: false })
      .limit(100);

    const subRows = (subs ?? []).map((s) => ({
      orderId: s.external_order_id,
      status: s.status,
      amount: s.amount,
      currentPeriodEnd: s.current_period_end,
      lastEventAt: s.last_event_at,
      isManual: s.external_order_id.startsWith("manual:"),
    }));
    const best = subRows.find((s) => isActive(s.status, s.currentPeriodEnd)) ??
      subRows[0] ?? null;

    return {
      ok: true,
      data: {
        id: u.id,
        email: u.email ?? null,
        nickname: profile?.nickname ?? null,
        role: profile?.role ?? null,
        provider:
          (u.app_metadata as { provider?: string } | null)?.provider ?? null,
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        isPremium: best ? isActive(best.status, best.currentPeriodEnd) : false,
        plusStatus: best?.status ?? null,
        plusUntil: best?.currentPeriodEnd ?? null,
        ageGroup: profile?.age_group ?? null,
        interests: (profile?.interests as string[] | null) ?? null,
        trustScore: profile?.trust_score ?? null,
        hasBillingIdentity: !!identity,
        subscriptions: subRows,
        payments: (events ?? []).map((e) => ({
          id: e.id,
          orderId: e.order_id,
          status: e.status,
          amount: e.amount,
          customerEmail: e.customer_email,
          occurredAt: e.occurred_at,
          receivedAt: e.received_at,
          processedAt: e.processed_at,
          processingError: e.processing_error,
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 운영자가 사용자 비밀번호를 직접 설정 */
export async function setUserPassword(input: {
  userId: string;
  password: string;
}): Promise<ActionResult> {
  try {
    const { uid } = await requireOperator();
    if (input.password.length < 8) {
      return { ok: false, error: "비밀번호는 8자 이상으로 정해 주세요." };
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(input.userId, {
      password: input.password,
    });
    if (error) return { ok: false, error: error.message };
    // 비밀번호 값 자체는 절대 로그에 남기지 않는다
    await logAudit(uid, "user.password_set", input.userId);
    revalidatePath(`/admin/users/${input.userId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 사용자에게 비밀번호 재설정 메일 발송 (운영자가 값을 몰라도 되는 안전한 경로) */
export async function sendPasswordReset(
  email: string
): Promise<ActionResult> {
  try {
    const { uid } = await requireOperator();
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://catchmeme.com"}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "user.password_reset_sent", null, { email });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 권한 변경 — 자기 자신의 운영자 권한 해제는 잠금 방지를 위해 막는다 */
export async function setUserRole(input: {
  userId: string;
  role: "user" | "operator";
}): Promise<ActionResult> {
  try {
    const { uid } = await requireOperator();
    if (input.userId === uid && input.role !== "operator") {
      return {
        ok: false,
        error: "자기 자신의 운영자 권한은 해제할 수 없어요(잠금 방지).",
      };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ role: input.role })
      .eq("id", input.userId);
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "user.role_set", input.userId, { role: input.role });
    revalidatePath(`/admin/users/${input.userId}`);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
