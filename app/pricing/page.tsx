import type { Metadata } from "next";
import { PricingContent } from "@/components/premium/pricing-content";

export const metadata: Metadata = {
  title: "MemeCatch Plus",
  description: "관심사 맞춤 밈 트렌드 레이더와 무제한 저장을 제공하는 밈캐치 월간 멤버십입니다.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    title: "MemeCatch Plus",
    description: "나만의 밈 트렌드 데스크를 시작하세요.",
    url: "/pricing",
  },
};

export default function PricingPage() {
  return <PricingContent />;
}
