import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { isVideoUrl, sanitizeMarkdownUrl } from "@/lib/markdown";

/**
 * 커뮤니티 본문 마크다운 렌더러 — 상세 페이지(서버)와 글쓰기 미리보기(클라이언트) 공용.
 *
 * 안전 정책:
 * - raw HTML은 렌더하지 않는다(react-markdown 기본 동작 — rehype-raw 미사용). <script> 등은 텍스트로만 보인다.
 * - URL은 sanitizeMarkdownUrl로 http(s)·자기 도메인 상대 경로(/api/media/…)만 허용 — javascript: 등 차단.
 * - 외부 링크는 rel="noopener noreferrer nofollow" target="_blank".
 * - remark-breaks: 단일 줄바꿈을 <br>로 — 기존 플레인 텍스트 글(whitespace-pre-wrap 시절)과 하위호환.
 *
 * 미디어 규약(lib/markdown.ts 참고): `![alt](url)` 이미지, URL이 .mp4/.webm이면
 * 이미지 구문이든 단독 링크 `[동영상](url)`이든 <video controls>로 렌더(자동재생 없음).
 */

function MediaVideo({ src }: { src: string }) {
  return (
    <video
      src={src}
      controls
      preload="metadata"
      playsInline
      className="my-3 max-h-[28rem] w-auto max-w-full rounded-xl border border-border bg-black"
    />
  );
}

const mdComponents: Components = {
  a({ href, children }) {
    const url = typeof href === "string" ? href : "";
    if (!url) return <span>{children}</span>;
    if (isVideoUrl(url)) return <MediaVideo src={url} />;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-words font-semibold text-accent underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    const url = typeof src === "string" ? src : "";
    if (!url) return null;
    if (isVideoUrl(url)) return <MediaVideo src={url} />;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 사용자 업로드 원본(프록시 경유) — next/image 최적화 대상 아님
      <img
        src={url}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="my-3 max-h-[28rem] w-auto max-w-full rounded-xl border border-border"
      />
    );
  },
  p({ children }) {
    return <p className="my-3 leading-relaxed first:mt-0 last:mb-0">{children}</p>;
  },
  h1({ children }) {
    return <h2 className="mb-2 mt-5 text-xl font-extrabold first:mt-0">{children}</h2>;
  },
  h2({ children }) {
    return <h3 className="mb-2 mt-5 text-lg font-bold first:mt-0">{children}</h3>;
  },
  h3({ children }) {
    return <h4 className="mb-1.5 mt-4 text-base font-bold first:mt-0">{children}</h4>;
  },
  h4({ children }) {
    return <h5 className="mb-1.5 mt-4 text-base font-bold first:mt-0">{children}</h5>;
  },
  h5({ children }) {
    return <h6 className="mb-1 mt-3 text-sm font-bold first:mt-0">{children}</h6>;
  },
  h6({ children }) {
    return <h6 className="mb-1 mt-3 text-sm font-bold text-muted first:mt-0">{children}</h6>;
  },
  ul({ children }) {
    return <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-2 border-border pl-3 text-muted">
        {children}
      </blockquote>
    );
  },
  code({ className, children }) {
    // 코드 블록(pre 내부)은 언어 className이 붙거나 줄바꿈 포함 — 인라인만 칩 스타일
    const isBlock = Boolean(className) || String(children).includes("\n");
    if (isBlock) return <code className={className}>{children}</code>;
    return (
      <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.9em]">{children}</code>
    );
  },
  pre({ children }) {
    return (
      <pre className="my-3 overflow-x-auto rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
        {children}
      </pre>
    );
  },
  hr() {
    return <hr className="my-4 border-border" />;
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-border bg-surface-2 px-2.5 py-1.5 text-left font-bold">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border border-border px-2.5 py-1.5">{children}</td>;
  },
};

export function MarkdownBody({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={`break-words text-base leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={sanitizeMarkdownUrl}
        components={mdComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
