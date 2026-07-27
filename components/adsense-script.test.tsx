import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AdsenseScript } from "@/components/adsense-script";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf-8");

describe("AdsenseScript", () => {
  it("env(ca-pub-…)가 없으면 아무것도 렌더하지 않는다", () => {
    // 테스트 환경에는 NEXT_PUBLIC_ADSENSE_CLIENT가 없다 —
    // 미리보기·로컬에서 실광고가 로드되지 않아야 한다.
    expect(process.env.NEXT_PUBLIC_ADSENSE_CLIENT).toBeUndefined();
    expect(AdsenseScript()).toBeNull();
  });
});

/**
 * 게시자 정책 "인벤토리 가치"는 색인이 아니라 **화면 단위**로 적용된다.
 * 이 사이트는 수동 슬롯 없는 Auto Ads라, 로더가 뜨는 화면에는 어디든 광고가
 * 주입된다. 따라서 "로더를 어디서 렌더하는가"가 유일한 통제 지점이고,
 * 아래 두 불변조건이 깨지면 저품질 화면에 광고가 되돌아온다.
 */
describe("광고 로더 게재 통제 (정책 불변조건)", () => {
  it("로더 URL은 adsense-script.tsx 한 곳에만 존재한다", () => {
    // 전역 레이아웃 등 다른 곳에서 직접 로드하면 화면 단위 통제가 무너진다.
    expect(read("components/adsense-script.tsx")).toContain("adsbygoogle.js");
    expect(read("app/layout.tsx")).not.toContain("adsbygoogle");
  });

  it("밈 상세는 충실도 판정을 통과한 문서에서만 로더를 렌더한다", () => {
    const page = read("app/memes/[key]/page.tsx");

    // isIndexableMeme(meme) && <AdsenseScript /> — 색인 판정과 같은 기준을 쓴다.
    expect(page).toMatch(/isIndexableMeme\(meme\)\s*&&\s*<AdsenseScript\s*\/>/);
    // 조건 없이 렌더하는 자리가 있으면 얇은 문서에도 광고가 붙는다.
    expect(page.match(/<AdsenseScript\s*\/>/g)).toHaveLength(1);
  });

  it("로그인·계정·어드민 등 행동 목적 화면에는 로더를 두지 않는다", () => {
    for (const p of [
      "app/login/page.tsx",
      "app/my/page.tsx",
      "app/admin/page.tsx",
      "app/submit/page.tsx",
      "app/support/page.tsx",
      "app/search/page.tsx",
      "app/offline/page.tsx",
    ]) {
      expect(read(p), p).not.toContain("AdsenseScript");
    }
  });
});
