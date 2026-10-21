import type { PublicMemeProducedVideo } from "@/lib/video-production/public.server";
import { parseProducedVideoMetadata, producedVideoEmbedUrl } from "@/lib/video-production/video-schema.mjs";
import { MemeProducedVideoJsonLd } from "@/components/json-ld";

function isPublicProducedVideo(value: unknown): value is PublicMemeProducedVideo {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const video = value as Record<string, unknown>;
  return video.privacy_status === "public"
    && typeof video.meme_id === "string"
    && typeof video.production_id === "string" && video.production_id.trim() !== ""
    && typeof video.youtube_video_id === "string" && producedVideoEmbedUrl(video.youtube_video_id) !== null
    && typeof video.content_id === "string" && video.content_id.trim() !== ""
    && (video.caption === null || typeof video.caption === "string")
    && typeof video.site_linked_at === "string" && Number.isFinite(Date.parse(video.site_linked_at))
    && typeof video.public_embed_verified === "boolean"
    && (video.schema_metadata === null
      || (typeof video.schema_metadata === "object" && !Array.isArray(video.schema_metadata)));
}

export function MemeProducedVideos({ videos, memeTitle, structuredDataPath }: {
  videos: readonly unknown[];
  memeTitle: string;
  /** Only indexable detail pages opt in. The video itself still has a separate proof gate. */
  structuredDataPath?: string;
}) {
  const seen = new Set<string>();
  const visibleVideos = videos.filter((video): video is PublicMemeProducedVideo => {
    if (!isPublicProducedVideo(video) || seen.has(video.youtube_video_id)) return false;
    seen.add(video.youtube_video_id);
    return true;
  });
  if (visibleVideos.length === 0) return null;
  return (
    <section aria-labelledby="meme-produced-videos-title" className="space-y-3">
      <div>
        <h2 id="meme-produced-videos-title" className="text-lg font-bold">밈캐치가 설명하는 영상</h2>
        <p className="mt-1 text-sm text-muted">원본 영상이 아니라 밈의 뜻과 사용 맥락을 밈캐치가 직접 설명합니다.</p>
      </div>
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {visibleVideos.map((video) => {
          const metadata = video.privacy_status === "public" && video.public_embed_verified === true
            ? parseProducedVideoMetadata(video.schema_metadata, video.youtube_video_id) : null;
          return (
          <li id={`produced-video-${video.youtube_video_id}`} key={video.production_id} className="overflow-hidden rounded-2xl border border-border bg-surface">
            {structuredDataPath && <MemeProducedVideoJsonLd video={video} path={structuredDataPath} />}
            <div className="aspect-video bg-black">
              <iframe
                className="h-full w-full"
                src={producedVideoEmbedUrl(video.youtube_video_id)!}
                title={metadata?.name ?? `${memeTitle} 밈캐치 설명 영상`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            {metadata && <h3 className="px-4 pt-4 font-semibold">{metadata.name}</h3>}
            {(metadata?.description || video.caption) && (
              <p className="whitespace-pre-wrap p-4 text-sm text-muted">{metadata?.description || video.caption}</p>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}
