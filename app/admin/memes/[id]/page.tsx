import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperatorPage } from "@/app/admin/require-operator";
import { ModerationBadge } from "@/components/admin/badges";
import { MemeEditForm } from "@/components/admin/meme-edit-form";
import { MemeStatusControls } from "@/components/admin/meme-status-controls";
import { memePathFrom, type SafetyLevel } from "@/lib/labels";
import type { ModerationStatus } from "@/components/admin/constants";

export const metadata = { title: "밈 편집" };

type UsageContext = Record<"work" | "friends" | "family" | "sns", SafetyLevel>;

export default async function AdminMemeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 방어심화 — 미들웨어와 별개로 페이지에서 operator 재검증
  const { supabase } = await requireOperatorPage(`/admin/memes/${id}`);
  const { data: meme } = await supabase.from("memes").select("*").eq("id", id).single();
  if (!meme) notFound();

  const rawCtx = (meme.usage_context ?? {}) as Partial<UsageContext>;
  const usageContext: UsageContext = {
    work: rawCtx.work ?? "yellow",
    friends: rawCtx.friends ?? "yellow",
    family: rawCtx.family ?? "yellow",
    sns: rawCtx.sns ?? "yellow",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/memes" className="text-base text-muted hover:text-foreground">
          ← 밈 관리로
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{meme.title}</h1>
          <ModerationBadge status={meme.moderation_status as ModerationStatus} />
          {["approved", "limited"].includes(meme.moderation_status) && (
            <Link
              href={memePathFrom(meme.short_id, meme.slug)}
              className="flex min-h-11 items-center text-base text-accent-text underline"
            >
              공개 페이지 보기
            </Link>
          )}
        </div>
      </div>

      <MemeStatusControls
        memeId={meme.id}
        currentStatus={meme.moderation_status as ModerationStatus}
      />

      <MemeEditForm
        memeId={meme.id}
        hasAnthropicKey={Boolean(process.env.ANTHROPIC_API_KEY)}
        initial={{
          title: meme.title,
          summary: meme.summary,
          description: meme.description,
          origin: meme.origin,
          usageNote: meme.usage_note ?? "",
          caution: meme.caution ?? "",
          aliases: meme.aliases,
          safetyLevel: meme.safety_level,
          lifecycleStatus: meme.lifecycle_status,
          category: meme.category,
          difficulty: meme.difficulty,
          sentiment: meme.sentiment,
          originYear: meme.origin_year,
          usageContext,
        }}
      />
    </div>
  );
}
