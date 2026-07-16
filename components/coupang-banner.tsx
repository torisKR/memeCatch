"use client";

/**
 * 쿠팡 파트너스 다이나믹 배너(캐러셀).
 *
 * 공식 스니펫(g.js + new PartnersCoupang.G)은 인라인 <script>가 실행되지 않는
 * React/JSX에서 동작하지 않고, 스크립트 위치에 iframe을 document.write하는
 * 방식이라 SPA 네비게이션과도 충돌한다. g.js가 최종 생성하는 위젯 iframe을
 * 직접 렌더한다(파라미터 동일 — id·trackingCode·template·크기).
 *
 * - referrerPolicy="unsafe-url": 쿠팡이 수익 귀속 검증에 리퍼러를 사용 —
 *   전역 Referrer-Policy(strict-origin-when-cross-origin)를 이 iframe만 완화.
 * - 파트너스 활동 고지 문구는 법적 필수라 배너와 항상 한 몸으로 렌더.
 * - 광고 차단기 사용 시 iframe이 비어 보일 수 있음(무해).
 */
const WIDGET_ID = 1006385;
const TRACKING_CODE = "AF7390846";

export function CoupangBanner({ className = "" }: { className?: string }) {
  const src =
    `https://ads-partners.coupang.com/widgets.html?id=${WIDGET_ID}` +
    `&template=carousel&trackingCode=${TRACKING_CODE}&subId=&width=680&height=140`;

  return (
    <aside aria-label="쿠팡 파트너스 광고" className={`w-full ${className}`}>
      <div className="mx-auto w-full max-w-[680px]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <iframe
            src={src}
            title="쿠팡 파트너스 상품 캐러셀 광고"
            width="680"
            height="140"
            loading="lazy"
            scrolling="no"
            referrerPolicy="unsafe-url"
            className="block h-[140px] w-full border-0"
          />
        </div>
        <p className="mt-1.5 text-center text-xs leading-relaxed text-muted">
          광고 · 이 배너는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
          수수료를 제공받습니다.
        </p>
      </div>
    </aside>
  );
}
