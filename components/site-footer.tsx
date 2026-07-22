"use client";

import Link from "next/link";
import { HideOnAdmin } from "@/components/auth-menu";
import { TrackedBlock } from "@/components/tracked-block";
import { useLocale } from "@/lib/i18n-client";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * 전역 푸터 — E-E-A-T 신뢰 신호(운영 주체·문의·정책 링크·저작권 안내).
 * /admin에서는 숨김. 모바일 하단탭과 겹치지 않게 여백 확보는 body pb가 담당.
 */
const FOOTER_LINKS = [
  { href: "/about", label: "about" },
  { href: "/privacy", label: "privacy" },
  { href: "/terms", label: "terms" },
  { href: "/rankings", label: "rankings" },
  { href: "/news", label: "news" },
  { href: "/products", label: "products" },
  { href: "/submit", label: "submit" },
  { href: "/support", label: "support" },
] as const;

/** 후원 — Fairy(GeekNews) 프로필. 광고와 함께 서비스 유지 재원 */
const DONATE_URL = "https://fairy.hada.io/@toris-dev";

export function SiteFooter() {
  const { messages } = useLocale();
  return (
    <HideOnAdmin>
      <footer className="mt-16 border-t border-border bg-surface-2">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <nav aria-label={messages.footerNav}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="-mx-1 inline-flex min-h-11 items-center px-1 font-medium text-muted transition-colors hover:text-foreground"
                  >
                    {messages[l.label]}
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
                    {messages.donate}
                  </a>
                </TrackedBlock>
              </li>
            </ul>
          </nav>
          <div className="mt-3 text-[13px] leading-relaxed text-muted">
            <details className="group sm:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {messages.legalSummary}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="space-y-1.5 pb-2">
                <LegalCopy legal1={messages.legal1} legal2={messages.legal2} />
              </div>
            </details>
            <div className="hidden space-y-1.5 sm:block">
              <LegalCopy legal1={messages.legal1} legal2={messages.legal2} />
            </div>
            <p className="mt-2">© {new Date().getFullYear()} {messages.brand}</p>
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
