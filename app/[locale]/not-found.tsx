// metadata도 함께 재노출 — robots noindex(HG-007 완화, SEO-001)가 로캘 라우트의
// not-found 응답에도 그대로 적용돼야 한다.
export { default, metadata } from "@/app/(default)/not-found";
