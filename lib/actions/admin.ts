"use server";

/**
 * 레인 D — 관리자 콘솔 Server Actions.
 * proxy.ts가 /admin 라우팅을 지키지만, Server Action은 URL과 무관하게 POST로 직접
 * 호출될 수 있으므로 모든 액션에서 is_operator를 재확인한다 (D-1).
 * 감사 로그(admin_audit_log)는 operator INSERT 정책이 없으므로 service-role로 기록한다.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memePathFrom, type SafetyLevel } from "@/lib/labels";
import type { Json } from "@/lib/database.types";
import { getOEmbed, isSupportedOEmbedUrl } from "@/lib/oembed";
import {
  isSeoContentLocale,
  localizedMemePath,
  SEO_CONTENT_LOCALES,
} from "@/lib/i18n-routing";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

type UsageContext = Record<"work" | "friends" | "family" | "sns", SafetyLevel>;

/** 운영자 인증 확인 — 통과 시 operator 세션 클라이언트와 uid 반환 */
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
  return { supabase, uid: user.id };
}

/** 감사 로그 기록 — service-role 전용 (RLS상 operator 직접 INSERT 불가) */
async function logAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail: (detail ?? null) as Json,
  });
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했어요.";
}

type MemeRevalidationIdentity = {
  short_id: string;
  slug: string;
  meme_translations: Array<{ locale: string; localized_slug: string }>;
};

async function loadMemeRevalidationIdentity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memeId: string,
): Promise<MemeRevalidationIdentity | null> {
  const { data, error } = await supabase
    .from("memes")
    .select("short_id, slug, meme_translations(locale, localized_slug)")
    .eq("id", memeId)
    .maybeSingle();
  return error ? null : data;
}

/** 한국어 원문/공개 상태를 소비하는 모든 public artifact를 즉시 갱신한다. */
function revalidateCanonicalMemePaths(meme: MemeRevalidationIdentity | null) {
  const paths = new Set(["/", "/sitemap.xml", "/llms.txt", "/llms-full.txt"]);

  for (const locale of SEO_CONTENT_LOCALES) {
    paths.add(`/${locale}`);
    paths.add(`/${locale}/llms.txt`);
    paths.add(`/${locale}/llms-full.txt`);
  }

  if (meme) {
    paths.add(memePathFrom(meme.short_id, meme.slug));
    for (const translation of meme.meme_translations) {
      if (!isSeoContentLocale(translation.locale)) continue;
      paths.add(
        localizedMemePath(
          translation.locale,
          meme.short_id,
          translation.localized_slug,
        ),
      );
    }
  }

  for (const path of paths) revalidatePath(path);
}

/* ── 제보 큐 ─────────────────────────────────────────── */

export async function claimSubmission(submissionId: string): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase
      .from("meme_submissions")
      .update({ claimed_by: uid, status: "reviewing", updated_at: new Date().toISOString() })
      .eq("id", submissionId)
      .eq("status", "pending");
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "submission.claim", "meme_submission", submissionId);
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${submissionId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

const REJECT_CATEGORIES = ["중복", "출처 부족", "저작권", "부적절"] as const;
export type RejectCategory = (typeof REJECT_CATEGORIES)[number];

export async function rejectSubmission(input: {
  submissionId: string;
  category: RejectCategory;
  reason: string;
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    if (!REJECT_CATEGORIES.includes(input.category)) {
      return { ok: false, error: "반려 사유 카테고리를 선택해 주세요." };
    }
    if (!input.reason.trim()) {
      return { ok: false, error: "반려 사유를 입력해 주세요." };
    }
    const { error } = await supabase
      .from("meme_submissions")
      .update({
        status: "rejected",
        reject_reason: `[${input.category}] ${input.reason.trim()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.submissionId);
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "submission.reject", "meme_submission", input.submissionId, {
      category: input.category,
      reason: input.reason.trim(),
    });
    revalidatePath("/admin/submissions");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

function slugify(title: string): string {
  const s = title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .toLowerCase();
  return s || "밈";
}

export async function approveSubmission(input: {
  submissionId: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  safetyLevel: SafetyLevel;
  category: "phrase" | "dance" | "song" | "image" | "comment" | "challenge";
  difficulty: "beginner" | "normal" | "deep";
  originYear: number | null;
  tags: string[];
  usageContext: UsageContext;
}): Promise<ActionResult<{ memeId: string }>> {
  try {
    const { supabase, uid } = await requireOperator();
    if (!input.title.trim()) return { ok: false, error: "제목을 입력해 주세요." };
    if (!input.summary.trim()) return { ok: false, error: "한 줄 요약을 입력해 주세요." };

    const { data: submission, error: subErr } = await supabase
      .from("meme_submissions")
      .select("*")
      .eq("id", input.submissionId)
      .single();
    if (subErr || !submission) return { ok: false, error: "제보를 찾을 수 없어요." };

    // 1) 밈 생성 (운영자 RLS로 직접 INSERT 가능 — moderation_status 기본값 pending)
    const baseRow = {
      title: input.title.trim(),
      summary: input.summary.trim(),
      description: input.description.trim(),
      origin: input.origin.trim(),
      safety_level: input.safetyLevel,
      category: input.category,
      difficulty: input.difficulty,
      origin_year: input.originYear,
      usage_context: input.usageContext,
      submitted_by: submission.submitter_id,
    };
    let memeId: string | null = null;
    let revalidationIdentity: MemeRevalidationIdentity | null = null;
    let insertError: string | null = null;
    for (const slug of [slugify(input.title), `${slugify(input.title)}-${Date.now().toString(36)}`]) {
      const { data, error } = await supabase
        .from("memes")
        .insert({ ...baseRow, slug })
        .select("id, short_id, slug")
        .single();
      if (!error && data) {
        memeId = data.id;
        revalidationIdentity = { ...data, meme_translations: [] };
        insertError = null;
        break;
      }
      insertError = error?.message ?? "밈 생성에 실패했어요.";
      if (error?.code !== "23505") break; // slug 중복이 아니면 재시도 의미 없음
    }
    if (!memeId) return { ok: false, error: insertError ?? "밈 생성에 실패했어요." };

    // 2) 검수 상태 전이 — 트리거가 역행을 차단하므로 순서대로 전진
    for (const status of ["fact_checking", "rights_checking", "approved"] as const) {
      const { error } = await supabase
        .from("memes")
        .update({ moderation_status: status, updated_at: new Date().toISOString() })
        .eq("id", memeId);
      if (error) {
        return {
          ok: false,
          error: `밈은 생성됐지만 상태 전이(${status})에 실패했어요: ${error.message} — 밈 관리에서 이어서 처리해 주세요.`,
        };
      }
    }

    // 3) 출처 기록
    if (submission.source_url) {
      let platform = "web";
      try {
        platform = new URL(submission.source_url).hostname.replace(/^www\./, "");
      } catch {
        /* URL 파싱 실패 시 web 유지 */
      }
      await supabase.from("meme_sources").insert({
        meme_id: memeId,
        platform,
        source_url: submission.source_url,
      });

      // 지원 플랫폼 제보는 승인과 함께 대표 임베드 콘텐츠로 연결한다.
      // 원본 파일을 복제하지 않고 플랫폼의 공식 플레이어만 사용한다.
      if (isSupportedOEmbedUrl(submission.source_url)) {
        try {
          const embed = await getOEmbed(submission.source_url);
          await supabase.from("meme_contents").insert({
            meme_id: memeId,
            platform: embed.provider,
            content_id: embed.contentId,
            type: "embed",
            url: embed.sourceUrl,
            caption: embed.title,
            availability: "live",
            moderation_status: "approved",
            is_representative: true,
          });
        } catch {
          // 플랫폼 일시 장애가 승인 자체를 막지 않도록 출처 링크는 유지한다.
        }
      }
    }

    // 4) 태그 연결
    for (const raw of input.tags) {
      const name = raw.trim();
      if (!name) continue;
      const { data: existing } = await supabase
        .from("tags")
        .select("id")
        .eq("name", name)
        .maybeSingle();
      let tagId = existing?.id ?? null;
      if (!tagId) {
        const { data: created } = await supabase
          .from("tags")
          .insert({ name })
          .select("id")
          .single();
        tagId = created?.id ?? null;
      }
      if (tagId) {
        await supabase
          .from("meme_tags_map")
          .upsert({ meme_id: memeId, tag_id: tagId }, { onConflict: "meme_id,tag_id" });
      }
    }

    // 5) 제보 상태 갱신
    await supabase
      .from("meme_submissions")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", input.submissionId);

    await logAudit(uid, "submission.approve", "meme_submission", input.submissionId, {
      meme_id: memeId,
      title: input.title.trim(),
    });
    revalidatePath("/admin/submissions");
    revalidatePath("/admin/memes");
    revalidateCanonicalMemePaths(revalidationIdentity);
    return { ok: true, data: { memeId } };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/* ── 밈 관리 ─────────────────────────────────────────── */

export async function updateMeme(input: {
  memeId: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string;
  caution: string;
  aliases: string[];
  safetyLevel: SafetyLevel;
  lifecycleStatus: "rising" | "active" | "cooling" | "archived";
  category: "phrase" | "dance" | "song" | "image" | "comment" | "challenge";
  difficulty: "beginner" | "normal" | "deep";
  sentiment: "funny" | "ironic" | "controversial" | "negative" | "wholesome";
  originYear: number | null;
  usageContext: UsageContext;
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    if (!input.title.trim()) return { ok: false, error: "제목을 입력해 주세요." };
    const revalidationIdentity = await loadMemeRevalidationIdentity(
      supabase,
      input.memeId,
    );
    const { error } = await supabase
      .from("memes")
      .update({
        title: input.title.trim(),
        summary: input.summary.trim(),
        description: input.description.trim(),
        origin: input.origin.trim(),
        usage_note: input.usageNote.trim() || null,
        caution: input.caution.trim() || null,
        aliases: input.aliases.map((a) => a.trim()).filter(Boolean),
        safety_level: input.safetyLevel,
        lifecycle_status: input.lifecycleStatus,
        category: input.category,
        difficulty: input.difficulty,
        sentiment: input.sentiment,
        origin_year: input.originYear,
        usage_context: input.usageContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.memeId);
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "meme.update", "meme", input.memeId);
    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${input.memeId}`);
    revalidateCanonicalMemePaths(revalidationIdentity);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export type KoreanReviewDraft = {
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string;
  caution: string;
  review_basis: "ai_translation" | "korean_wikipedia";
};

type KoreanReviewFields = Omit<KoreanReviewDraft, "review_basis">;

const KOREAN_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "description", "origin", "usage_note", "caution"],
  properties: {
    title: { type: "string", description: "한국어 표기 제목. 고유명사는 원문을 보존" },
    summary: { type: "string", description: "80자 이내의 자연스러운 한국어 한 줄 요약" },
    description: { type: "string", description: "뜻과 쓰임새를 설명하는 한국어 본문" },
    origin: { type: "string", description: "확인된 범위만 반영한 한국어 유래 설명" },
    usage_note: { type: "string", description: "한국어 사용 팁. 원문이 비어 있으면 빈 문자열" },
    caution: { type: "string", description: "한국어 주의 문구. 원문이 비어 있으면 빈 문자열" },
  },
} as const;

function containsHangul(value: string | null | undefined) {
  return /[가-힣]/.test(value ?? "");
}

function firstSentence(value: string) {
  const sentence = value.match(/^.*?[.!?。](?:\s|$)/)?.[0]?.trim() ?? value.trim();
  return sentence.slice(0, 120);
}

/** API 키가 없는 환경에서도 운영자가 한국어 자료를 바탕으로 검수할 수 있는 보수적 폴백. */
async function koreanWikipediaReviewDraft(meme: {
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
}): Promise<KoreanReviewDraft | null> {
  const commonHeaders = {
    accept: "application/json",
    "accept-language": "ko-KR,ko;q=0.9",
    "user-agent": "MemeCatchReview/1.0 (+https://catchmeme.com/about)",
  };

  // Wikimedia에서 수집한 영문 표제는 먼저 언어 링크로 한국어 문서와 정확히 연결한다.
  const languageLinkEndpoint = new URL("https://en.wikipedia.org/w/api.php");
  languageLinkEndpoint.searchParams.set("action", "query");
  languageLinkEndpoint.searchParams.set("titles", meme.title.slice(0, 180));
  languageLinkEndpoint.searchParams.set("redirects", "1");
  languageLinkEndpoint.searchParams.set("prop", "langlinks");
  languageLinkEndpoint.searchParams.set("lllang", "ko");
  languageLinkEndpoint.searchParams.set("lllimit", "1");
  languageLinkEndpoint.searchParams.set("format", "json");
  languageLinkEndpoint.searchParams.set("formatversion", "2");
  languageLinkEndpoint.searchParams.set("origin", "*");

  let linkedKoreanTitle: string | null = null;
  try {
    const linkResponse = await fetch(languageLinkEndpoint, {
      headers: commonHeaders,
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
    if (linkResponse.ok) {
      const linkPayload = (await linkResponse.json()) as {
        query?: { pages?: Array<{ langlinks?: Array<{ title?: string }> }> };
      };
      linkedKoreanTitle =
        linkPayload.query?.pages?.[0]?.langlinks?.[0]?.title?.trim() ?? null;
    }
  } catch {
    // 언어 링크 조회가 실패해도 아래 한국어 검색 폴백을 시도한다.
  }

  const endpoint = new URL("https://ko.wikipedia.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  if (linkedKoreanTitle) {
    endpoint.searchParams.set("titles", linkedKoreanTitle);
  } else {
    endpoint.searchParams.set("generator", "search");
    endpoint.searchParams.set("gsrsearch", meme.title.slice(0, 120));
    endpoint.searchParams.set("gsrnamespace", "0");
    endpoint.searchParams.set("gsrlimit", "1");
  }
  endpoint.searchParams.set("prop", "extracts");
  endpoint.searchParams.set("exintro", "1");
  endpoint.searchParams.set("explaintext", "1");
  endpoint.searchParams.set("exsentences", "5");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("formatversion", "2");
  endpoint.searchParams.set("origin", "*");

  const response = await fetch(endpoint, {
    headers: commonHeaders,
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    query?: { pages?: Array<{ title?: string; extract?: string }> };
  };
  const page = payload.query?.pages?.find(
    (candidate) => candidate.title?.trim() && candidate.extract?.trim()
  );
  if (!page?.title || !page.extract || !containsHangul(page.extract)) return null;

  const extract = page.extract.trim().slice(0, 2_400);
  return {
    title: containsHangul(meme.title) ? meme.title : page.title.trim(),
    summary: firstSentence(extract),
    description: extract,
    origin: containsHangul(meme.origin)
      ? meme.origin
      : `한국어 위키백과의 ‘${page.title.trim()}’ 문서를 참고했으며, 정확한 최초 유래는 추가 확인이 필요해요.`,
    usage_note: containsHangul(meme.usage_note)
      ? meme.usage_note!.trim()
      : "상황과 상대를 고려해 사용해 주세요.",
    caution: containsHangul(meme.caution)
      ? meme.caution!.trim()
      : "정확한 최초 출처와 연도는 추가 확인이 필요해요.",
    review_basis: "korean_wikipedia",
  };
}

/**
 * 기존 밈의 영문·혼합 언어 설명을 운영자 검수용 한국어 초안으로 바꾼다.
 * 결과를 자동 저장하지 않아 운영자가 사실관계와 고유명사를 확인한 뒤 저장할 수 있다.
 */
export async function generateKoreanReviewDraft(
  memeId: string
): Promise<ActionResult<KoreanReviewDraft>> {
  try {
    const { supabase, uid } = await requireOperator();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const { data: meme, error } = await supabase
      .from("memes")
      .select("title, summary, description, origin, usage_note, caution")
      .eq("id", memeId)
      .single();
    if (error || !meme) return { ok: false, error: "밈을 찾을 수 없어요." };

    if (!apiKey) {
      const fallbackDraft = await koreanWikipediaReviewDraft(meme);
      if (!fallbackDraft) {
        return {
          ok: false,
          error: "일치하는 한국어 자료를 찾지 못했어요. 직접 번역하거나 ANTHROPIC_API_KEY를 설정해 주세요.",
        };
      }
      await logAudit(uid, "reference.generate_korean_review", "meme", memeId, {
        source: "ko.wikipedia.org",
        auto_saved: false,
      });
      return { ok: true, data: fallbackDraft };
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        system:
          "당신은 한국 밈 사전 서비스 '밈캐치'의 한국어 편집자입니다. 입력에 영어 또는 혼합 언어가 있으면 자연스러운 한국어 해요체로 번역·정리합니다. " +
          "고유명사, 작품명, 인물명, 서비스명은 널리 쓰이는 한국어 표기가 확인될 때만 바꾸고 그렇지 않으면 원문을 보존합니다. " +
          "입력에 없는 사실, 연도, 원출처를 만들지 않습니다. 불확실한 내용은 단정하지 말고 '확인 중이에요' 또는 '~로 알려져 있어요'처럼 표시합니다. " +
          "출력은 JSON 스키마의 문자열 값까지 한국어를 기본으로 하며 불가피한 고유명사만 원문을 허용합니다.",
        messages: [
          {
            role: "user",
            content:
              "다음 밈 항목을 한국어 검수 초안으로 정리해 주세요. 자동 게시되지 않으며 운영자가 검토할 예정입니다.\n\n" +
              JSON.stringify(meme, null, 2),
          },
        ],
        output_config: { format: { type: "json_schema", schema: KOREAN_REVIEW_SCHEMA } },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `한국어 초안 생성에 실패했어요 (${res.status}). ${body.slice(0, 200)}` };
    }
    const message: {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    } = await res.json();
    if (message.stop_reason === "refusal") {
      return { ok: false, error: "AI가 이 항목의 한국어 초안 생성을 거절했어요. 직접 작성해 주세요." };
    }
    const textBlock = message.content?.find((block) => block.type === "text" && block.text);
    if (!textBlock?.text) return { ok: false, error: "AI 응답이 비어 있어요. 다시 시도해 주세요." };

    let draft: KoreanReviewFields;
    try {
      draft = JSON.parse(textBlock.text) as KoreanReviewFields;
    } catch {
      return { ok: false, error: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요." };
    }

    await logAudit(uid, "ai.generate_korean_review", "meme", memeId, {
      model: "claude-sonnet-5",
      auto_saved: false,
    });
    return { ok: true, data: { ...draft, review_basis: "ai_translation" } };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function transitionMemeStatus(input: {
  memeId: string;
  to: "pending" | "fact_checking" | "rights_checking" | "approved" | "limited" | "rejected";
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const revalidationIdentity = await loadMemeRevalidationIdentity(
      supabase,
      input.memeId,
    );
    const { error } = await supabase
      .from("memes")
      .update({ moderation_status: input.to, updated_at: new Date().toISOString() })
      .eq("id", input.memeId);
    if (error) {
      // 트리거의 invalid moderation transition 에러를 사용자 친화적으로
      const msg = error.message.includes("invalid moderation transition")
        ? "허용되지 않는 상태 전이예요. 현재 상태를 다시 확인해 주세요."
        : error.message;
      return { ok: false, error: msg };
    }
    await logAudit(uid, "meme.transition", "meme", input.memeId, { to: input.to });
    revalidatePath("/admin/memes");
    revalidatePath(`/admin/memes/${input.memeId}`);
    revalidateCanonicalMemePaths(revalidationIdentity);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/* ── 신고 처리 ────────────────────────────────────────── */

export async function handleReport(input: {
  reportId: string;
  action: "resolved" | "dismissed";
}): Promise<ActionResult> {
  try {
    const { supabase, uid } = await requireOperator();
    const { error } = await supabase
      .from("reports")
      .update({ status: input.action, handled_by: uid })
      .eq("id", input.reportId)
      .eq("status", "open");
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, `report.${input.action}`, "report", input.reportId);
    revalidatePath("/admin/reports");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 신고 대상 댓글 숨김 유지/해제 — discussions에 operator UPDATE 정책이 없어 service-role 사용 */
export async function setDiscussionVisibility(input: {
  discussionId: string;
  status: "visible" | "hidden";
}): Promise<ActionResult> {
  try {
    const { uid } = await requireOperator();
    const admin = createAdminClient();
    const { error } = await admin
      .from("discussions")
      .update({ status: input.status })
      .eq("id", input.discussionId);
    if (error) return { ok: false, error: error.message };
    await logAudit(uid, "discussion.set_status", "discussion", input.discussionId, {
      status: input.status,
    });
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/* ── AI 초안 (Anthropic Messages API — fetch 직접 호출) ── */

export type DraftResult = {
  summary: string;
  description: string;
  origin: string;
  safety_level: SafetyLevel;
  usage_context: UsageContext;
};

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "description", "origin", "safety_level", "usage_context"],
  properties: {
    summary: { type: "string", description: "80자 이내 한 줄 요약 (해요체)" },
    description: { type: "string", description: "뜻과 쓰임새 설명 2~3문단 (해요체)" },
    origin: { type: "string", description: "유래·확산 경로 1~2문단 (해요체)" },
    safety_level: { type: "string", enum: ["green", "yellow", "gray", "red"] },
    usage_context: {
      type: "object",
      additionalProperties: false,
      required: ["work", "friends", "family", "sns"],
      properties: {
        work: { type: "string", enum: ["green", "yellow", "gray", "red"] },
        friends: { type: "string", enum: ["green", "yellow", "gray", "red"] },
        family: { type: "string", enum: ["green", "yellow", "gray", "red"] },
        sns: { type: "string", enum: ["green", "yellow", "gray", "red"] },
      },
    },
  },
} as const;

export async function generateDraft(submissionId: string): Promise<ActionResult<DraftResult>> {
  try {
    const { supabase, uid } = await requireOperator();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY 설정 필요" };

    const { data: submission } = await supabase
      .from("meme_submissions")
      .select("name, source_url, description, seen_at, guess_reason, tags")
      .eq("id", submissionId)
      .single();
    if (!submission) return { ok: false, error: "제보를 찾을 수 없어요." };

    const userPrompt = [
      `밈 이름: ${submission.name}`,
      submission.source_url ? `출처 링크: ${submission.source_url}` : null,
      submission.seen_at ? `제보자가 본 곳: ${submission.seen_at}` : null,
      submission.description ? `제보자 설명: ${submission.description}` : null,
      submission.guess_reason ? `유행 이유 추측: ${submission.guess_reason}` : null,
      submission.tags.length ? `태그: ${submission.tags.join(", ")}` : null,
      "",
      "위 제보를 바탕으로 밈 사전 초안을 JSON으로 작성해 주세요.",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        system:
          "당신은 한국 밈 사전 서비스 '밈캐치'의 운영 보조입니다. 제보된 밈 정보를 바탕으로 사전 항목 초안을 작성합니다. " +
          "제보가 영어 또는 혼합 언어이면 먼저 의미를 자연스러운 한국어로 해석하고, 출력 문자열은 불가피한 고유명사를 제외하면 모두 한국어로 작성합니다. " +
          "모든 문장은 해요체로 씁니다. 확실하지 않은 사실은 단정하지 말고 '~로 알려져 있어요'처럼 표현합니다. " +
          "safety_level 기준: green=써도 됨, yellow=맥락 주의, gray=이미 유행이 지남, red=쓰면 위험(차별·혐오·논란). " +
          "usage_context는 직장(work)·친구(friends)·가족(family)·공개 SNS(sns) 각각에서의 사용 안전도를 같은 기준으로 판단합니다.",
        messages: [{ role: "user", content: userPrompt }],
        output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `AI 호출에 실패했어요 (${res.status}). ${body.slice(0, 200)}` };
    }
    const message: {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    } = await res.json();

    if (message.stop_reason === "refusal") {
      return { ok: false, error: "AI가 이 요청의 초안 생성을 거절했어요. 직접 작성해 주세요." };
    }
    const textBlock = message.content?.find((b) => b.type === "text" && b.text);
    if (!textBlock?.text) return { ok: false, error: "AI 응답이 비어 있어요. 다시 시도해 주세요." };

    let draft: DraftResult;
    try {
      draft = JSON.parse(textBlock.text) as DraftResult;
    } catch {
      return { ok: false, error: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요." };
    }

    await logAudit(uid, "ai.generate_draft", "meme_submission", submissionId, {
      model: "claude-sonnet-5",
    });
    return { ok: true, data: draft };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

// ── MemeCatch Plus 수동 권한 관리 (운영자 전용) ─────────────────────
// 조회/부여 모두 service-role RPC를 쓰되(다른 사용자 구독 열람은 RLS로 막혀 있음),
// 호출 전 requireOperator로 운영자를 재확인하고 부여/해제는 감사 로그에 남긴다.

export type PlusStatusView = {
  userFound: boolean;
  userId?: string;
  email: string;
  hasBillingIdentity?: boolean;
  isPremium?: boolean;
  status?: string | null;
  currentPeriodEnd?: string | null;
  lastEventAt?: string | null;
  amount?: number | null;
  isManual?: boolean | null;
  provider?: string | null;
  subscriptions?: {
    provider: string;
    status: string;
    amount: number | null;
    currentPeriodEnd: string | null;
    lastEventAt: string | null;
    isManual: boolean;
  }[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 이메일로 Plus 상태 조회 — 부작용 없음 */
export async function lookupPlusStatus(
  email: string
): Promise<ActionResult<PlusStatusView>> {
  try {
    await requireOperator();
    const normalized = normalizeEmail(email);
    if (!normalized || normalized.indexOf("@") < 1) {
      return { ok: false, error: "이메일을 입력해 주세요." };
    }
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("admin_get_plus_status", {
      p_email: normalized,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data as unknown as PlusStatusView };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

/** 이메일 사용자에게 Plus 수동 부여(active=true, months 시한부) 또는 해제(active=false) */
export async function setUserPlus(input: {
  email: string;
  active: boolean;
  months?: number;
}): Promise<ActionResult<PlusStatusView>> {
  try {
    const { uid } = await requireOperator();
    const normalized = normalizeEmail(input.email);
    if (!normalized || normalized.indexOf("@") < 1) {
      return { ok: false, error: "이메일을 입력해 주세요." };
    }
    const months = input.active
      ? Math.max(1, Math.min(Math.trunc(input.months ?? 1), 36))
      : 1;
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("admin_set_plus_entitlement", {
      p_email: normalized,
      p_active: input.active,
      p_months: months,
    });
    if (error) {
      const msg = error.message.includes("user_not_found")
        ? "해당 이메일의 가입 계정을 찾을 수 없어요. (사용자가 먼저 로그인·가입해야 해요.)"
        : error.message.includes("invalid_email")
          ? "이메일 형식이 올바르지 않아요."
          : error.message;
      return { ok: false, error: msg };
    }
    const result = data as { userId?: string } | null;
    await logAudit(
      uid,
      input.active ? "plus.grant" : "plus.revoke",
      "billing_subscription",
      result?.userId ?? null,
      { email: normalized, active: input.active, months }
    );
    revalidatePath("/admin/subscriptions");
    const { data: latest } = await admin.rpc("admin_get_plus_status", {
      p_email: normalized,
    });
    return { ok: true, data: latest as unknown as PlusStatusView };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
