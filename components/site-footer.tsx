import Link from "next/link";
import { HideOnAdmin } from "@/components/auth-menu";
import { TrackedBlock } from "@/components/tracked-block";

/**
 * 전역 푸터 — E-E-A-T 신뢰 신호(운영 주체·문의·정책 링크·저작권 안내).
 * /admin에서는 숨김. 모바일 하단탭과 겹치지 않게 여백 확보는 body pb가 담당.
 */
const FOOTER_LINKS = [
  { href: "/about", label: "밈캐치 소개" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
  { href: "/submit", label: "밈 제보" },
] as const;

/** 후원 — Fairy(GeekNews) 프로필. 광고와 함께 서비스 유지 재원 */
const DONATE_URL = "https://fairy.hada.io/@toris-dev";

export function SiteFooter() {
  return (
    <HideOnAdmin>
      <footer className="mt-16 border-t border-border bg-surface-2">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <nav aria-label="사이트 정보">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-11 items-center font-medium text-muted transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <TrackedBlock event="donate_click" className="inline-flex">
                  <a
                    href={DONATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent transition-colors hover:brightness-90"
                  >
                    <HeartGlyph />
                    후원하기
                  </a>
                </TrackedBlock>
              </li>
            </ul>
          </nav>
          <div className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-muted">
            <p>
              밈캐치는 한국 밈·유행어의 뜻과 유래를 기록하는 사전 서비스입니다.
              모든 제보는 운영자 검수(사실 확인 → 저작권 확인)를 거쳐 공개됩니다.
            </p>
            <p>
              원본 영상·이미지는 저장하지 않고 출처 링크·임베드로만 제공하며, 각
              콘텐츠의 저작권은 원저작자에게 있습니다. 문의·삭제 요청:{" "}
              <a
                href="mailto:ironjustlikethat@gmail.com"
                className="inline-block py-2 underline underline-offset-2 hover:text-foreground"
              >
                ironjustlikethat@gmail.com
              </a>
            </p>
            <p>© {new Date().getFullYear()} 밈캐치 (MemeCatch)</p>
          </div>
        </div>
      </footer>
    </HideOnAdmin>
  );
}

function HeartGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21s-7.5-4.7-10-9.3C.5 8.6 2.6 5 6.2 5c2 0 3.7 1.1 4.6 2.7l1.2 2 1.2-2C14.1 6.1 15.8 5 17.8 5c3.6 0 5.7 3.6 4.2 6.7C19.5 16.3 12 21 12 21Z" />
    </svg>
  );
}
