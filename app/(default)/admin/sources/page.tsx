import Link from "next/link";
import { z } from "zod";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { SourceIngestionForm, type SourceIngestionMeme } from "@/components/admin/source-ingestion-form";
import { SourceReviewCard } from "@/components/admin/source-review-card";
import { SourceRecoveryPanel } from "@/components/admin/source-recovery-panel";
import { listActiveSourceAcquisitionRecovery, type SourceAcquisitionRecoveryDto } from "@/lib/sources/recovery.server";

export const metadata = { title: "출처 검수" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const MEME_ID_SCHEMA = z.uuid();

type SearchParams = {
  page?: string | string[];
  memeId?: string | string[];
};

function pageHref(page: number, memeId: string | null): string {
  const params = new URLSearchParams({ page: String(page) });
  if (memeId) params.set("memeId", memeId);
  return `/admin/sources?${params.toString()}`;
}

type QueueRow = {
  meme_id: string;
  source_id: string;
  created_at: string;
  memes: {
    title: string;
    slug: string;
    short_id: string;
    origin_year: number | null;
    source_work_year: number | null;
    korea_viral_year: number | null;
  } | null;
  media_sources: {
    id: string;
    platform: string;
    external_id: string | null;
    canonical_url: string;
    title: string | null;
    channel_name: string | null;
    platform_published_at: string | null;
    duration_seconds: number | null;
    public_status: string | null;
    embeddable: boolean | null;
    license_code: string | null;
    thumbnail_url: string | null;
    removed_at: string | null;
  } | null;
};

export default async function AdminSourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawSearch = await searchParams;
  const { supabase } = await requireOperatorPage("/admin/sources", rawSearch);
  const pageParam = typeof rawSearch.page === "string" ? rawSearch.page : undefined;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);
  const normalizedMemeId =
    typeof rawSearch.memeId === "string" ? rawSearch.memeId.toLowerCase() : null;
  const requestedMemeId =
    normalizedMemeId && MEME_ID_SCHEMA.safeParse(normalizedMemeId).success
      ? normalizedMemeId
      : null;

  const [{ data, count, error: queueError }, { data: memes, error: memesError }] = await Promise.all([
    supabase
      .from("meme_media")
      .select(
        "meme_id, source_id, created_at, memes(title, slug, short_id, origin_year, source_work_year, korea_viral_year), media_sources(id, platform, external_id, canonical_url, title, channel_name, platform_published_at, duration_seconds, public_status, embeddable, license_code, thumbnail_url, removed_at)",
        { count: "exact" },
      )
      .eq("review_state", "pending")
      .order("created_at", { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      .returns<QueueRow[]>(),
    supabase
      .from("memes")
      .select("id, title, short_id")
      .order("updated_at", { ascending: false })
      .limit(200)
      .returns<SourceIngestionMeme[]>(),
  ]);

  if (queueError) throw new Error(`출처 검수 대기열을 불러오지 못했어요: ${queueError.message}`);
  if (memesError) throw new Error(`밈 목록을 불러오지 못했어요: ${memesError.message}`);

  const recentMemes = memes ?? [];
  let targetMeme = requestedMemeId
    ? recentMemes.find((meme) => meme.id === requestedMemeId) ?? null
    : null;
  let targetFeedback: string | null = null;
  let targetFormKey = "target:manual";

  if (rawSearch.memeId !== undefined && !requestedMemeId) {
    targetFeedback = "복구할 밈 주소가 올바르지 않아요. 연결 대상을 비웠습니다.";
    targetFormKey = "target:invalid";
  } else if (requestedMemeId && !targetMeme) {
    const { data: exactMeme, error: exactMemeError } = await supabase
      .from("memes")
      .select("id, title, short_id")
      .eq("id", requestedMemeId)
      .maybeSingle<SourceIngestionMeme>();

    if (exactMemeError) {
      targetFeedback = "요청한 밈을 확인하지 못했어요. 연결 대상을 비운 채 다시 시도해 주세요.";
      targetFormKey = `target:error:${requestedMemeId}`;
    } else if (!exactMeme || exactMeme.id !== requestedMemeId) {
      targetFeedback = "요청한 밈을 찾지 못했어요. 연결 대상을 비웠습니다.";
      targetFormKey = `target:missing:${requestedMemeId}`;
    } else {
      targetMeme = exactMeme;
    }
  }

  if (targetMeme) targetFormKey = `target:${targetMeme.id}`;
  const ingestionMemes = targetMeme
    ? [targetMeme, ...recentMemes.filter((meme) => meme.id !== targetMeme.id)]
    : recentMemes;

  let recoveryEntries: SourceAcquisitionRecoveryDto[] = [];
  let recoveryError: string | null = null;
  try {
    recoveryEntries = await listActiveSourceAcquisitionRecovery();
  } catch (error) {
    recoveryError = error instanceof Error ? error.message : "복구 상태 조회 오류";
  }

  const rows = (data ?? []).filter((row) => row.memes && row.media_sources);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">출처 검수</h1>
        <p className="mt-1 text-sm text-muted">
          수집 파이프라인이 찾은 후보예요. 원본 파일은 저장하지 않고 공식 임베드 또는
          링크만 게시합니다. 승인 전에 공식 채널 여부와 연도를 반드시 확인하세요.
        </p>
      </div>

      {targetFeedback && (
        <p role="alert" className="rounded-xl bg-safety-yellow-bg px-4 py-3 text-sm text-safety-yellow">
          {targetFeedback}
        </p>
      )}

      <SourceIngestionForm
        key={targetFormKey}
        memes={ingestionMemes}
        initialTargetMemeId={targetMeme?.id}
      />
      <SourceRecoveryPanel entries={recoveryEntries} memes={ingestionMemes} loadError={recoveryError} />

      <p className="text-sm text-muted">
        대기 중 <strong className="text-foreground">{(count ?? 0).toLocaleString("ko-KR")}</strong>건
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
          대기 중인 출처 후보가 없어요.
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => {
            const meme = row.memes!;
            const source = row.media_sources!;
            return (
              <li key={`${row.meme_id}:${row.source_id}`}>
                <div className="mb-2 flex flex-wrap items-baseline gap-2 text-sm">
                  <Link
                    href={`/admin/memes/${row.meme_id}`}
                    className="font-semibold hover:text-accent"
                  >
                    {meme.title}
                  </Link>
                  <span className="text-muted">
                    밈 연도 {meme.origin_year ?? "?"} · 원작{" "}
                    {meme.source_work_year ?? "?"} · 국내 유행{" "}
                    {meme.korea_viral_year ?? "?"}
                  </span>
                </div>
                <SourceReviewCard
                  memeId={row.meme_id}
                  memeTitle={meme.title}
                  memeOriginYear={meme.origin_year}
                  source={source}
                />
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center gap-3 text-sm" aria-label="페이지 이동">
          {page > 1 && (
            <Link href={pageHref(page - 1, requestedMemeId)} className="text-accent hover:underline">
              ← 이전
            </Link>
          )}
          <span className="text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1, requestedMemeId)} className="text-accent hover:underline">
              다음 →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
