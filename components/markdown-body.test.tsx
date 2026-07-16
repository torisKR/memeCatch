import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownBody } from "@/components/markdown-body";
import { isVideoUrl, sanitizeMarkdownUrl, stripMarkdownToText } from "@/lib/markdown";

function render(md: string): string {
  return renderToStaticMarkup(<MarkdownBody>{md}</MarkdownBody>);
}

describe("MarkdownBody", () => {
  it("이미지 구문을 lazy img로 렌더한다", () => {
    const html = render("![짤](/api/media/meme-uploads/u1/a.png)");
    expect(html).toContain("<img");
    expect(html).toContain('src="/api/media/meme-uploads/u1/a.png"');
    expect(html).toContain('alt="짤"');
    expect(html).toContain('loading="lazy"');
  });

  it(".mp4 단독 링크([동영상](url) 규약)를 video로 렌더한다", () => {
    const html = render("[동영상](/api/media/meme-uploads/u1/clip.mp4)");
    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain('preload="metadata"');
    expect(html).not.toContain("autoplay");
    expect(html).not.toContain("<a");
  });

  it(".webm 이미지 구문도 video로 렌더한다", () => {
    const html = render("![클립](https://example.com/clip.webm)");
    expect(html).toContain("<video");
    expect(html).not.toContain("<img");
  });

  it("raw HTML(script 태그)을 렌더하지 않는다", () => {
    const html = render('<script>alert("xss")</script>안녕');
    expect(html).not.toContain("<script>");
    expect(html).toContain("안녕");
  });

  it("외부 링크에 rel/target을 강제한다", () => {
    const html = render("[문서](https://example.com/doc)");
    expect(html).toContain('href="https://example.com/doc"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("javascript: URL은 무력화한다", () => {
    const html = render("[클릭](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("플레인 텍스트의 단일 줄바꿈을 유지한다(하위호환)", () => {
    const html = render("첫 줄\n둘째 줄");
    expect(html).toContain("<br");
  });
});

describe("isVideoUrl", () => {
  it("mp4/webm(쿼리 포함)만 참", () => {
    expect(isVideoUrl("/a/b.mp4")).toBe(true);
    expect(isVideoUrl("https://x.com/c.webm?v=1")).toBe(true);
    expect(isVideoUrl("/a/b.png")).toBe(false);
    expect(isVideoUrl("https://x.com/mp4-guide")).toBe(false);
  });
});

describe("sanitizeMarkdownUrl", () => {
  it("http(s)·사이트 상대 경로만 허용", () => {
    expect(sanitizeMarkdownUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(sanitizeMarkdownUrl("/api/media/meme-uploads/u/a.png")).toBe(
      "/api/media/meme-uploads/u/a.png"
    );
    expect(sanitizeMarkdownUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeMarkdownUrl("data:text/html,x")).toBe("");
    expect(sanitizeMarkdownUrl("//evil.com/x")).toBe("");
  });
});

describe("stripMarkdownToText", () => {
  it("이미지/링크/강조 구문을 벗겨 발췌용 텍스트만 남긴다", () => {
    const out = stripMarkdownToText(
      "# 제목\n**굵게** 그리고 ![짤](/api/media/a.png) [문서](https://a.com)\n[동영상](/api/media/b.mp4)"
    );
    expect(out).not.toContain("![");
    expect(out).not.toContain("](");
    expect(out).not.toContain("**");
    expect(out).not.toContain("#");
    expect(out).toContain("굵게");
    expect(out).toContain("문서");
    expect(out).toContain("짤");
  });
});
