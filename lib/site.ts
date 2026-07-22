/** 프로덕션 도메인 단일 소스. Vercel 환경변수로 미리보기/로컬 주소를 덮어쓸 수 있다. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://catchmeme.com"
).replace(/\/+$/, "");

/** 운영 문의·삭제 요청 이메일 단일 소스 — 푸터·정책 페이지·JSON-LD·llms.txt 공용. */
export const CONTACT_EMAIL = "toris@toris.kr";
