import Link from "next/link";
import { requireOperatorPage } from "@/app/admin/require-operator";
import { SourceReviewCard } from "@/components/admin/source-review-card";
import { memePathFrom } from "@/lib/labels";

export const metadata = { title: "출처 검수" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

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
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireOperatorPage("/admin/sources");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const { data, count } = await supabase
    .from("meme_media")
    .select(
      "meme_id, source_id, created_at, memes(title, slug, short_id, origin_year, source_work_year, korea_viral_year), media_sources(id, platform, external_id, canonical_url, title, channel_name, platform_published_at, duration_seconds, public_status, embeddable, license_code, thumbnail_url, removed_at)",
      { count: "exact" },
    )
    .eq("review_state", "pending")
    .order("created_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .returns<QueueRow[]>();

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
                    href={memePathFrom(meme.short_id, meme.slug)}
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
            <Link href={`/admin/sources?page=${page - 1}`} className="text-accent hover:underline">
              ← 이전
            </Link>
          )}
          <span className="text-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/admin/sources?page=${page + 1}`} className="text-accent hover:underline">
              다음 →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
