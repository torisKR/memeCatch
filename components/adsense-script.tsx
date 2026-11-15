import Script from "next/script";
import { AdsenseHostGate } from "@/components/adsense-host-gate";
import { isConfiguredAdsenseClient } from "@/lib/adsense-policy";

/** env(ca-pub-…)가 없으면 광고를 아예 로드하지 않는다(미리보기·로컬). */
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/**
 * AdSense Auto Ads 로더 — **광고를 게재할 페이지에서만** 렌더한다.
 *
 * 전역(루트 레이아웃)에 두지 않는 이유:
 * 게시자 정책의 "인벤토리 가치"는 색인이 아니라 **화면 단위**로 적용된다.
 * publisher-content가 없거나 저품질인 화면에는 광고를 게재할 수 없고,
 * 로그인·설정처럼 탐색·행동 목적의 화면도 마찬가지다.
 *
 * 이 사이트는 수동 광고 슬롯(<ins class="adsbygoogle">)이 하나도 없는 순수
 * Auto Ads 구성이다. 즉 이 로더가 뜨는 순간 구글이 그 화면 어디에든 광고를
 * 주입하므로, **게재 여부를 통제할 수 있는 지점은 이 컴포넌트 하나뿐이다.**
 *
 * noindex로는 막을 수 없다 — 색인에서 빠져도 사람이 도달하면 광고는 그대로
 * 게재된다. CSS로 숨기는 것도 해결이 아니다(이미 요청·게재된 뒤다).
 *
 * 렌더하는 곳: 콘텐츠 페이지 + 충실도 판정을 통과한 밈 상세.
 * 렌더하지 않는 곳: 얇은 밈 상세, 로그인·계정·어드민, 제보·고객센터 같은 폼,
 *                  검색 결과, 정책·소개 문서.
 */
export function AdsenseScript() {
  // Auto Ads executes globally and can survive client-side navigation into excluded
  // screens. Default to verification-only mode until the operator explicitly enables
  // it after checking approval, consent and account-side page exclusions.
  // Ownership verification remains in server-rendered google-adsense-account metadata.
  if (process.env.ADSENSE_AUTO_ADS_ENABLED !== "true") return null;
  if (!isConfiguredAdsenseClient(ADSENSE_CLIENT) || process.env.NODE_ENV !== "production" ||
      (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")) return null;

  return (
    <AdsenseHostGate>
      <Script
        id="adsense"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </AdsenseHostGate>
  );
}
