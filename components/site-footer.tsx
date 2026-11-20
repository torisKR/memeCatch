"use client";

import Link from "next/link";
import { HideOnAdmin } from "@/components/auth-menu";
import { useLocale } from "@/lib/i18n-client";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * 전역 푸터 — E-E-A-T 신뢰 신호(운영 주체·문의·정책 링크·저작권 안내).
 * /admin에서는 숨김. 모바일 하단탭과 겹치지 않게 여백 확보는 body pb가 담당.
 */
const FOOTER_LINKS = [
  { href: "/about", label: "about" },
  { href: "/editorial", label: "editorial" },
  { href: "/guides", label: "guides" },
  { href: "/privacy", label: "privacy" },
  { href: "/terms", label: "terms" },
  { href: "/rankings", label: "rankings" },
  { href: "/news", label: "news" },
  { href: "/submit", label: "submit" },
  { href: "/support", label: "support" },
] as const;

export function SiteFooter() {
  const { messages, locale } = useLocale();
  const links = FOOTER_LINKS;
  return (
    <HideOnAdmin>
      <footer className="instrument-grid mt-16 border-t border-border bg-surface-2">
        <div className="mx-auto max-w-site px-4 py-8">
          <nav aria-label={messages.footerNav}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {locale === "ko" && (
                <li>
                  <Link
                    href="/contact"
                    className="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500"
                  >
                    문의
                  </Link>
                </li>
              )}
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted underline decoration-transparent decoration-2 underline-offset-4 transition-[color,text-decoration-color] hover:text-foreground hover:decoration-flame-500 focus-visible:decoration-flame-500"
                  >
                    {messages[l.label]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 text-[13px] leading-relaxed text-muted">
            {/*
              고지 문구는 문서에 정확히 한 번만 출력한다. 예전에는 모바일용
              <details>와 데스크톱용 <div>에 같은 문단을 각각 렌더하고 CSS로
              한쪽만 보여줬는데, HTML에는 두 벌이 그대로 담겨 크롤러·심사
              도구에는 같은 문단이 연속 2회 반복되는 중복 텍스트로 읽혔다.
              지금은 하나만 렌더하고, summary만 모바일에서 노출해 접을 수
              있게 한다(기본 펼침 — 본문이 상호작용 뒤에 숨지 않게).
            */}
            <details className="group" open>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground sm:hidden [&::-webkit-details-marker]:hidden">
                {messages.legalSummary}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="space-y-1.5 pb-2 leading-normal sm:pb-0">
                <LegalCopy legal1={messages.legal1} legal2={messages.legal2} />
              </div>
            </details>
            <p className="stat-mono mt-2">© {new Date().getFullYear()} {messages.brand}</p>
          </div>
        </div>
      </footer>
    </HideOnAdmin>
  );
}

function LegalCopy({ legal1, legal2 }: { legal1: string; legal2: string }) {
  return (
    <>
      <p className="break-keep leading-normal">{legal1}</p>
      <p className="break-keep leading-normal">
        {legal2}{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}
