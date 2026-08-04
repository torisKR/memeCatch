// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocClassNote } from "./doc-class-note";

describe("DocClassNote", () => {
  it("event 문서엔 밈이 아니라는 안내를 렌더한다", () => {
    const html = renderToStaticMarkup(<DocClassNote docClass="event" />);
    expect(html).toContain("밈이 아니라 인터넷 문화 사건 기록이에요");
  });

  it("meme 문서엔 아무것도 렌더하지 않는다", () => {
    const html = renderToStaticMarkup(<DocClassNote docClass="meme" />);
    expect(html).toBe("");
  });
});
