"use server";

import { revalidatePath } from "next/cache";
import {
  catalogDuplicateCheckSchema,
  catalogRegistrationSchema,
  normalizeCatalogRegistration,
  normalizeCatalogSourceUrl,
  type CatalogRegistrationInput,
} from "@/lib/catalog-registration";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type ActionError = {
  ok: false;
  error: { code: string; message: string; retryable: boolean; fieldErrors?: Record<string, string> };
};

type DuplicateMatch = {
  reason: "title" | "source";
  memeId: string;
  title: string;
  shortId: string;
  slug: string;
  sourceUrl?: string | null;
};

export type CatalogDuplicateResult =
  | { ok: true; data: { matches: DuplicateMatch[] } }
  | ActionError;

export type CatalogRegistrationResult =
  | {
      ok: true;
      data:
        | { status: "created" | "duplicate_request"; memeId: string; shortId: string; slug: string }
        | { status: "duplicate"; matches: DuplicateMatch[] };
    }
  | ActionError;

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, result: failure("signed_out", "로그인이 필요해요.") } as const;
  const { data: isOperator, error } = await supabase.rpc("is_operator");
  if (error || !isOperator) {
    return { ok: false, result: failure("operator_required", "운영자 권한이 필요해요.") } as const;
  }
  return { ok: true, supabase, user } as const;
}

function failure(code: string, message: string, retryable = false): ActionError {
  return { ok: false, error: { code, message, retryable } };
}

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "input", issue.message]),
  );
}

function parseMatches(value: unknown): DuplicateMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    if (
      (row.reason !== "title" && row.reason !== "source") ||
      typeof row.memeId !== "string" ||
      typeof row.title !== "string" ||
      typeof row.shortId !== "string" ||
      typeof row.slug !== "string"
    ) return [];
    return [{
      reason: row.reason,
      memeId: row.memeId,
      title: row.title,
      shortId: row.shortId,
      slug: row.slug,
      sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : null,
    }];
  });
}

export async function checkCatalogMemeDuplicates(input: {
  title: string;
  sourceUrls: string[];
}): Promise<CatalogDuplicateResult> {
  const parsed = catalogDuplicateCheckSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ...failure("invalid_input", "제목과 출처 URL을 확인해 주세요."),
      error: {
        ...failure("invalid_input", "제목과 출처 URL을 확인해 주세요.").error,
        fieldErrors: fieldErrors(parsed.error),
      },
    };
  }
  const auth = await requireOperator();
  if (!auth.ok) return auth.result;
  const sourceUrls = parsed.data.sourceUrls.map((url) => normalizeCatalogSourceUrl(url)!);
  const { data, error } = await auth.supabase.rpc("find_catalog_meme_duplicates", {
    p_title: parsed.data.title,
    p_source_urls: sourceUrls,
  });
  if (error) return failure("duplicate_check_failed", "중복 검사를 완료하지 못했어요.", true);
  return { ok: true, data: { matches: parseMatches(data) } };
}

export async function registerCatalogMeme(
  input: CatalogRegistrationInput,
): Promise<CatalogRegistrationResult> {
  const parsed = catalogRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ...failure("invalid_input", "등록 내용을 확인해 주세요."),
      error: {
        ...failure("invalid_input", "등록 내용을 확인해 주세요.").error,
        fieldErrors: fieldErrors(parsed.error),
      },
    };
  }
  const auth = await requireOperator();
  if (!auth.ok) return auth.result;

  const normalized = normalizeCatalogRegistration(parsed.data);
  const { data, error } = await auth.supabase.rpc("register_catalog_meme", {
    p_input: normalized as unknown as Json,
  });
  if (error) {
    const authError = error.message.includes("operator_required") || error.message.includes("signed_out");
    return failure(
      authError ? "operator_required" : "save_failed",
      authError ? "운영자 권한이 필요해요." : "등록을 저장하지 못했어요. 같은 요청 ID로 다시 시도해 주세요.",
      !authError,
    );
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return failure("invalid_response", "등록 결과를 확인하지 못했어요.", true);
  }
  const result = data as Record<string, unknown>;
  if (result.status === "duplicate") {
    return { ok: true, data: { status: "duplicate", matches: parseMatches(result.matches) } };
  }
  if (
    (result.status === "created" || result.status === "duplicate_request") &&
    typeof result.memeId === "string" &&
    typeof result.shortId === "string" &&
    typeof result.slug === "string"
  ) {
    revalidatePath("/admin/memes");
    revalidatePath("/admin/sources");
    revalidatePath(`/admin/memes/${result.memeId}`);
    return {
      ok: true,
      data: {
        status: result.status,
        memeId: result.memeId,
        shortId: result.shortId,
        slug: result.slug,
      },
    };
  }
  return failure("invalid_response", "등록 결과를 확인하지 못했어요.", true);
}
