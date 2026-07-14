"use client";

import { TrackedBlock } from "@/components/tracked-block";
import { useLocale } from "@/lib/i18n-client";

/** 후원 — Fairy(GeekNews) 프로필. 1인 운영, 광고와 함께 서비스 유지 재원. */
const DONATE_URL = "https://fairy.hada.io/@toris-dev";

/**
 * 후원 카드 — 고관여 지점(밈 상세 본문을 다 읽은 시점)에 자연스럽게 노출.
 * 개인(비사업자) 창작자의 수익 모델을 존중해 "커피 한 잔" 톤으로 강요 없이 안내.
 * 광고 심사·UX를 해치지 않도록 절제된 1개 CTA. 이모지 대신 SVG 하트.
 * i18n(useLocale)·GA(donate_click) 연동.
 */
export function DonateCard() {
  const { messages } = useLocale();
  return (
    <aside
      aria-label={messages.donate}
      className="rounded-2xl border border-accent/25 bg-accent-soft/60 p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"
        >
          <HeartGlyph />
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold">{messages.donateCardTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {messages.donateCardBody}
          </p>
          <TrackedBlock event="donate_click" className="mt-3 inline-flex">
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-strong px-5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <HeartGlyph />
              {messages.donate}
            </a>
          </TrackedBlock>
        </div>
      </div>
    </aside>
  );
}

function HeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 21s-7.5-4.7-10-9.3C.5 8.6 2.6 5 6.2 5c2 0 3.7 1.1 4.6 2.7l1.2 2 1.2-2C14.1 6.1 15.8 5 17.8 5c3.6 0 5.7 3.6 4.2 6.7C19.5 16.3 12 21 12 21Z" />
    </svg>
  );
}
