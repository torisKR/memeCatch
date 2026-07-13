/**
 * 루트 template.
 *
 * 첫 방문에서 전환 래퍼가 콘텐츠를 opacity: 0으로 SSR하면, 모바일에서는
 * 하이드레이션이 끝날 때까지 FCP/LCP 후보가 보이지 않는다. template는 서버
 * 경계로 유지하고, 첫 화면 콘텐츠는 즉시 표시한다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
