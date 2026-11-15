"use server";

/**
 * 레인 D — 관리자 사용자 관리.
 * auth.users는 RLS 대상이 아니라 Admin API로만 읽으므로 service-role 클라이언트로 조회한다.
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
  const { data: isOperator } = await supabase.rpc("is_operator");
  if (!isOperator) throw new Error("운영자 권한이 없어요.");
  return { uid: user.id };
}

async function logAudit(
  actorId: string,
  action: string,
  entityId: string | null,
  detail?: Record<string, unknown>
) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: "user",
    entity_id: entityId,
    detail: (detail ?? null) as Json,
  });
  if (error) throw new Error("감사 로그 저장에 실패했어요.");
}

async function logAuditOutcome(
  actorId: string,
  action: string,
  entityId: string | null,
  outcome: "intent" | "completed" | "failed",
  detail?: Record<string, unknown>,
) {
  await logAudit(actorId, `${action}.${outcome}`, entityId, detail);
}

async function finalizeAudit(
  actorId: string,
  action: string,
  entityId: string | null,
  detail?: Record<string, unknown>,
) {
  try {
    await logAuditOutcome(actorId, action, entityId, "completed", detail);
  } catch {
    console.error({ event: "admin_audit_completion_pending", action });
  }
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
};

export type AdminUserDetail = AdminUserRow & {
  ageGroup: string | null;
  interests: string[] | null;
  trustScore: number | null;
};

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

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, nickname, role")
      .in("id", ids);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const q = (input.query ?? "").trim().toLowerCase();
    const rows: AdminUserRow[] = authList.users
      .map((u) => {
        const p = profileById.get(u.id);
        return {
          id: u.id,
          email: u.email ?? null,
          nickname: p?.nickname ?? null,
          role: p?.role ?? null,
          provider:
            (u.app_metadata as { provider?: string } | null)?.provider ?? null,
          createdAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
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

/** 사용자 상세 — 계정정보 */
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

    const { data: profile } = await admin
      .from("profiles")
      .select("nickname, role, age_group, interests, trust_score")
      .eq("id", userId)
      .maybeSingle();

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
        ageGroup: profile?.age_group ?? null,
        interests: (profile?.interests as string[] | null) ?? null,
        trustScore: profile?.trust_score ?? null,
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
    await logAuditOutcome(uid, "user.password_set", input.userId, "intent");
    const admin = createAdminClient();
    const { error } = await (async () => {
      try {
        return await admin.auth.admin.updateUserById(input.userId, {
          password: input.password,
        });
      } catch (cause) {
        await logAuditOutcome(uid, "user.password_set", input.userId, "failed");
        throw cause;
      }
    })();
    if (error) {
      await logAuditOutcome(uid, "user.password_set", input.userId, "failed");
      return { ok: false, error: error.message };
    }
    await finalizeAudit(uid, "user.password_set", input.userId);
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
    await logAuditOutcome(uid, "user.password_reset_sent", null, "intent", { email });
    const supabase = await createClient();
    const { error } = await (async () => {
      try {
        return await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://catchmeme.com"}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
        });
      } catch (cause) {
        await logAuditOutcome(uid, "user.password_reset_sent", null, "failed", { email });
        throw cause;
      }
    })();
    if (error) {
      await logAuditOutcome(uid, "user.password_reset_sent", null, "failed", { email });
      return { ok: false, error: error.message };
    }
    await finalizeAudit(uid, "user.password_reset_sent", null, { email });
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
    await logAuditOutcome(uid, "user.role_set", input.userId, "intent", {
      role: input.role,
    });
    const admin = createAdminClient();
    const { error } = await (async () => {
      try {
        return await admin
          .from("profiles")
          .update({ role: input.role })
          .eq("id", input.userId);
      } catch (cause) {
        await logAuditOutcome(uid, "user.role_set", input.userId, "failed", {
          role: input.role,
        });
        throw cause;
      }
    })();
    if (error) {
      await logAuditOutcome(uid, "user.role_set", input.userId, "failed", {
        role: input.role,
      });
      return { ok: false, error: error.message };
    }
    await finalizeAudit(uid, "user.role_set", input.userId, {
      role: input.role,
    });
    revalidatePath(`/admin/users/${input.userId}`);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
