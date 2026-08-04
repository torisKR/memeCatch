import { describe, expect, it } from "vitest";
import { metadata as defaultNotFoundMetadata } from "@/app/(default)/not-found";
import { metadata as localizedNotFoundMetadata } from "@/app/[locale]/not-found";

// HG-007 완화(SEO-001): 없는 밈 URL이 Next 16 ISR 경로에서 notFound()를 거쳐도
// 실제 404 상태코드가 아닌 200으로 응답하는 soft-404 결함이 있다. Next의 noindex
// 자동 주입은 "실제 404 상태코드" 조건부라 이 경로에서 못 미덥기 때문에, 상태코드와
// 무관하게 not-found 응답 자체가 명시적 robots noindex를 내는지 여기서 증명한다.
describe("not-found robots metadata (HG-007 완화)", () => {
  it("기본(ko) not-found 응답은 명시적으로 색인을 막는다", () => {
    expect(defaultNotFoundMetadata.robots).toEqual({ index: false, follow: true });
  });

  it("[locale] not-found 응답도 같은 noindex를 재노출한다", () => {
    expect(localizedNotFoundMetadata.robots).toEqual({ index: false, follow: true });
    // 두 라우트가 같은 결정을 공유한다는 사실 자체를 고정 — 값 복제가 아니라
    // 재노출(export { metadata })이라 드리프트가 구조적으로 불가능해야 한다.
    expect(localizedNotFoundMetadata).toBe(defaultNotFoundMetadata);
  });
});
