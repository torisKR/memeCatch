import { PageTransition } from "@/components/page-transition";

/**
 * 루트 template — 세그먼트 전환마다 리마운트되어 진입 전환을 트리거한다.
 * (layout과 달리 상태를 유지하지 않음: Next 16 template 규약)
 * 서버 컴포넌트로 두고, 모션은 클라이언트 PageTransition에 위임한다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
