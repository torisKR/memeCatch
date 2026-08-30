import { MemeEmbed } from "@/components/meme-embed";
import { adminLinkedContentsEmptyCopy } from "@/lib/house-original";
import type { MemeContentRow } from "@/lib/queries";

type AdminContent = Pick<
  MemeContentRow,
  | "id"
  | "platform"
  | "content_id"
  | "url"
  | "thumbnail_url"
  | "availability"
  | "caption"
  | "is_representative"
  | "moderation_status"
>;

/**
 * 관리자 밈 상세 — 연결된 SNS 임베드(TikTok/Instagram/YouTube 등)를 실제 영상으로
 * 미리 본다. 승인 판단을 위해 대표 콘텐츠를 먼저, 나머지를 뒤에 정렬해 렌더링한다.
 */
export function AdminMemeContents({
  contents,
  memeTitle,
  originKind,
}: {
  contents: AdminContent[];
  memeTitle: string;
  originKind?: string | null;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">연결된 SNS 콘텐츠</h2>
        <span className="text-sm text-muted">{contents.length}개</span>
      </div>

      {contents.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-2 p-5">
          <p className="text-base text-muted">{adminLinkedContentsEmptyCopy(originKind)}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {contents.map((content) => (
            <li
              key={content.id}
              className="space-y-2 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="rounded-full border border-border px-2 py-0.5 font-semibold">
                  {content.platform ?? "unknown"}
                </span>
                {content.is_representative && (
                  <span className="rounded-full border border-accent px-2 py-0.5 font-semibold text-accent">
                    대표
                  </span>
                )}
                <span className="rounded-full border border-border px-2 py-0.5 text-muted">
                  {content.availability}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-muted">
                  {content.moderation_status}
                </span>
              </div>

              <MemeEmbed
                content={content}
                title={memeTitle}
                isRepresentative={content.is_representative}
              />

              {content.url && (
                <a
                  href={content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
                >
                  {content.url}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
