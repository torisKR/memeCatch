"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";
import { parseLocalePath } from "@/lib/i18n-routing";
import type { MemeChatItem, MemeChatLocale, MemeChatResult } from "@/lib/meme-chat";
import { MEME_CHAT_COPY } from "@/lib/meme-chat-copy";
import { publicSourceUrl } from "@/lib/source-links";

const CHAT_LOCALES = new Set<string>(["ko", "en", "ja", "zh", "zh-tw"]);
const HIDDEN_PATHS = ["/admin", "/auth", "/login", "/signup", "/forgot-password", "/reset-password"];
const MAX_TURNS = 6;

function subscribeToPwaBanner(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function pwaBannerSnapshot() {
  return document.querySelector("[data-pwa-install-banner]") !== null;
}

function serverPwaBannerSnapshot() {
  return false;
}

type Turn = { id: number; question: string; result: MemeChatResult };
type ChatError = "invalid" | "limited" | "timeout" | "unavailable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatItem(value: unknown): value is MemeChatItem {
  return isRecord(value) &&
    ["id", "short_id", "slug", "title", "summary", "href"].every(
      (key) => typeof value[key] === "string" && value[key].length <= 12000,
    ) &&
    Array.isArray(value.sources) && value.sources.length <= 8 &&
    value.sources.every((source: unknown) => isRecord(source) &&
      typeof source.url === "string" && source.url.length <= 2048 &&
      typeof source.label === "string" && source.label.length <= 300);
}

function isChatResult(value: unknown): value is MemeChatResult {
  return isRecord(value) &&
    typeof value.answer === "string" && value.answer.length <= 12000 &&
    (value.mode === "generated" || value.mode === "retrieved" || value.mode === "empty") &&
    (value.retrievalMode === "hybrid" || value.retrievalMode === "keyword") &&
    Array.isArray(value.items) && value.items.length <= 12 && value.items.every(isChatItem);
}

function safeMemeHref(value: string): string | null {
  if (value.length > 2048 || /[\u0000-\u001f\u007f\\]/u.test(value)) return null;
  return /^\/(?:ko\/|en\/|ja\/|zh\/|zh-tw\/)?memes\/[^/?#]+$/u.test(value) ? value : null;
}

function MemeCharacter() {
  return (
    <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true" focusable="false">
      <path d="M14 34c-5 1-7 5-6 9M50 34c5 1 7 5 6 9" fill="none" stroke="#9c2d15" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 5c5 13 16 17 18 29 3 14-5 24-18 24S11 48 14 35c2-8 9-14 10-23 3 3 5 6 5 9 4-5 5-10 3-16Z" fill="#ff5c38" />
      <path d="M21 39c0-7 5-9 7-15 2 5 2 8 6 10 2-2 4-4 5-7 5 6 7 10 6 16-1 8-6 12-13 12-7 0-11-6-11-16Z" fill="#ffd3a1" />
      <ellipse cx="25" cy="39" rx="2.2" ry="3" fill="#4e271c" />
      <ellipse cx="39" cy="39" rx="2.2" ry="3" fill="#4e271c" />
      <path d="M28 46c2 2 6 2 8 0" fill="none" stroke="#4e271c" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="44" r="3" fill="#ff956f" />
      <circle cx="44" cy="44" r="3" fill="#ff956f" />
    </svg>
  );
}

function ReferenceCard({ item, locale }: { item: MemeChatItem; locale: MemeChatLocale }) {
  const href = safeMemeHref(item.href);
  const sources = item.sources.flatMap((source) => {
    const url = publicSourceUrl(source.url);
    return url ? [{ url, label: source.label }] : [];
  });
  return (
    <li className="rounded-2xl border border-border bg-background p-3">
      {href ? (
        <a href={href} className="font-bold text-foreground underline decoration-accent/40 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          {item.title}
        </a>
      ) : <span className="font-bold text-foreground">{item.title}</span>}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{item.summary}</p>
      {sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-xs">
          <span className="text-muted">{MEME_CHAT_COPY[locale].sources}</span>
          {sources.map((source, index) => (
            <a key={source.url + index} href={source.url} target="_blank" rel="noopener noreferrer"
              className="text-accent-text underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              {source.label || new URL(source.url).hostname}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}

function MemeChatPanel({ locale }: { locale: MemeChatLocale }) {
  const copy = MEME_CHAT_COPY[locale];
  const panelId = useId();
  const titleId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const turnIdRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const pending = pendingQuestion !== null;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')) return;
      event.preventDefault();
      requestRef.current?.abort();
      requestRef.current = null;
      setPendingQuestion(null);
      setOpen(false);
      launcherRef.current?.focus();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns, pendingQuestion]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  function cancelRequest() {
    requestRef.current?.abort();
    requestRef.current = null;
    setPendingQuestion(null);
  }

  function closePanel() {
    cancelRequest();
    setOpen(false);
    launcherRef.current?.focus();
  }

  function clearConversation() {
    cancelRequest();
    setTurns([]);
    setQuestion("");
    setError(null);
    inputRef.current?.focus();
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    const submitted = question.trim();
    if (submitted.length < 2 || submitted.length > 120) {
      setError("invalid");
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setPendingQuestion(submitted);
    setError(null);
    try {
      const response = await fetch("/api/memes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: submitted, locale }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (!response.ok) {
        setError(response.status === 429 ? "limited" : response.status === 504 ? "timeout" :
          response.status === 400 || response.status === 413 ? "invalid" : "unavailable");
        return;
      }
      const result: unknown = await response.json();
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (!isChatResult(result)) {
        setError("unavailable");
        return;
      }
      const turn = { id: ++turnIdRef.current, question: submitted, result };
      setTurns((previous) => [...previous.slice(-(MAX_TURNS - 1)), turn]);
      setQuestion("");
    } catch {
      if (!controller.signal.aborted && requestRef.current === controller) setError("unavailable");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingQuestion(null);
      }
    }
  }

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-[45] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open && (
        <section id={panelId} role="dialog" aria-modal="false" aria-labelledby={titleId}
          className="flex max-h-[calc(100dvh-16rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border bg-surface text-foreground shadow-[0_16px_60px_rgba(0,0,0,0.18)] md:max-h-[min(36rem,calc(100dvh-14rem))]">
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
            <span className="shrink-0"><MemeCharacter /></span>
            <h2 id={titleId} className="flex-1 text-base font-bold">{copy.title}</h2>
            <button type="button" onClick={closePanel} aria-label={copy.close}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions text"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 text-sm">
            {turns.length === 0 && (
              <div className="rounded-2xl bg-background p-3">
                <p className="leading-relaxed">{copy.welcome}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{copy.privacy}</p>
              </div>
            )}
            {turns.map((turn) => (
              <article key={turn.id} className="space-y-2">
                <p className="ml-8 whitespace-pre-wrap rounded-2xl bg-accent-soft px-3 py-2 text-foreground">{turn.question}</p>
                <div className="space-y-3">
                  <p className="text-xs font-medium text-accent-text">{copy[turn.result.mode]}</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{turn.result.answer}</p>
                  {turn.result.items.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold text-muted">{copy.references}</h3>
                      <ul className="space-y-2">{turn.result.items.map((item, index) => <ReferenceCard key={item.id + index} item={item} locale={locale} />)}</ul>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {pendingQuestion !== null && (
              <div className="space-y-2">
                <p className="ml-8 whitespace-pre-wrap rounded-2xl bg-accent-soft px-3 py-2">{pendingQuestion}</p>
                <p role="status" className="text-muted">{copy.pending}</p>
              </div>
            )}
          </div>
          <form onSubmit={submitQuestion} aria-label={copy.question} className="shrink-0 border-t border-border px-4 pb-3 pt-3">
            <p className="mb-2 text-xs leading-relaxed text-muted">{copy.disclosure}</p>
            {error && <p role="alert" className="mb-2 text-sm leading-relaxed text-accent-text">{copy[error]}</p>}
            <label htmlFor={inputId} className="sr-only">{copy.question}</label>
            <textarea ref={inputRef} id={inputId} rows={2} value={question} maxLength={120} disabled={pending}
              onChange={(event) => { setQuestion(event.target.value); setError(null); }}
              placeholder={copy.placeholder}
              className="block w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60" />
            <div className="mt-2 flex items-center gap-3">
              <button type="button" onClick={clearConversation} className="min-h-11 text-xs text-muted underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent">{copy.clear}</button>
              <span className="ml-auto text-xs text-muted" aria-hidden="true">{question.length}/120</span>
              <button type="submit" disabled={pending || question.trim().length < 2 || question.trim().length > 120}
                className="min-h-11 rounded-full bg-accent-strong px-4 text-sm font-bold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
                {copy.send}
              </button>
            </div>
          </form>
        </section>
      )}
      <button ref={launcherRef} type="button" aria-label={open ? copy.close : copy.open} aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => { if (open) closePanel(); else setOpen(true); }}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent-soft shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none">
        <MemeCharacter />
      </button>
    </div>
  );
}

export function MemeChatbot() {
  const pathname = usePathname() ?? "/";
  const { locale: preferredLocale } = useLocale();
  const pwaBannerVisible = useSyncExternalStore(subscribeToPwaBanner, pwaBannerSnapshot, serverPwaBannerSnapshot);
  const route = parseLocalePath(pathname);
  if (pwaBannerVisible) return null;
  if (HIDDEN_PATHS.some((path) => route.pathname === path || route.pathname.startsWith(path + "/"))) return null;
  const selected = route.hadLocalePrefix ? route.locale : preferredLocale;
  const locale: MemeChatLocale = CHAT_LOCALES.has(selected) ? selected as MemeChatLocale : "en";
  return <MemeChatPanel key={locale + ":" + route.pathname} locale={locale} />;
}
