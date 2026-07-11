/** 프로덕션 도메인 단일 소스. Vercel 환경변수로 미리보기/로컬 주소를 덮어쓸 수 있다. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://catchmeme.com"
).replace(/\/+$/, "");
