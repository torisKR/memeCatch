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
  { href: "/privacy", label: "privacy" },
  { href: "/terms", label: "terms" },
  { href: "/support", label: "support" },
] as const;

export function SiteFooter() {
  const { messages } = useLocale();
  return (
    <HideOnAdmin>
      <footer className="mt-16 border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-7">
          <nav aria-label={messages.footerNav}>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {FOOTER_LINKS.map((l) => (
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
          <div className="mt-2 text-[13px] leading-relaxed text-muted">
            {/* 권리 고지는 문서에 한 번만 렌더하고 필요할 때 펼친다. */}
            <details className="group max-w-3xl">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {messages.legalSummary}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="space-y-1.5 pb-2">
                <LegalCopy legal1={messages.legal1} legal2={messages.legal2} />
              </div>
            </details>
            <p className="mt-1 text-xs">© {new Date().getFullYear()} {messages.brand}</p>
          </div>
        </div>
      </footer>
    </HideOnAdmin>
  );
}

function LegalCopy({ legal1, legal2 }: { legal1: string; legal2: string }) {
  return (
    <>
      <p>
        {legal1}
      </p>
      <p>
        {legal2}{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground"
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
