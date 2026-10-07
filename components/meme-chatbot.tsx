"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";
import { parseLocalePath } from "@/lib/i18n-routing";
import type { MemeChatItem, MemeChatLocale, MemeChatProgress, MemeChatResult } from "@/lib/meme-chat";
import { MEME_CHAT_COPY } from "@/lib/meme-chat-copy";
import { MemeChatStreamError, readMemeChatResponse } from "@/lib/meme-chat-stream";
import { publicSourceUrl } from "@/lib/source-links";
import { MemeChatCharacter, type MemeChatCharacterState } from "./meme-chat-character";
import styles from "./meme-chatbot.module.css";

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

const subscribeToHydration = () => () => {};
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

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

function AnimatedChatPanel({ id, titleId, children }: { id: string; titleId: string; children: ReactNode }) {
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();
  return (
    <motion.section id={id} role="dialog" aria-modal="false" aria-labelledby={titleId}
      data-chat-panel="" aria-hidden={isPresent ? undefined : true} inert={!isPresent}
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.97,
        transition: { duration: reduceMotion ? 0 : 0.17, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: isPresent ? undefined : "none" }}
      className={`${styles.panel} flex max-h-[calc(100dvh-16rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border bg-surface text-foreground shadow-[0_16px_60px_rgba(0,0,0,0.18)] md:max-h-[min(36rem,calc(100dvh-14rem))]`}>
      {children}
    </motion.section>
  );
}

function PendingAnswer({ locale, progress, foundCount }: {
  locale: MemeChatLocale;
  progress: MemeChatProgress | null;
  foundCount: number | null;
}) {
  const copy = MEME_CHAT_COPY[locale];
  const state: MemeChatCharacterState = progress?.stage === "found" && progress.count === 0 ? "idle" : progress?.stage ?? "idle";
  const referenceCount = progress?.stage === "found" ? progress.count : foundCount;
  const foundLabel = referenceCount === 0 ? copy.noReferences : copy.found.replace("{count}", String(referenceCount));
  const label = progress?.stage === "found" ? foundLabel : progress ? copy[progress.stage] : copy.pending;
  return (
    <div className="flex items-start gap-2" data-chat-progress={progress?.stage ?? "pending"}>
      <MemeChatCharacter state={state} size={50} />
      <div className={`${styles.waitCard} min-w-0 flex-1`}>
        <div className="flex items-center justify-between gap-2">
          <p role="status" aria-atomic="true" className="text-sm font-medium leading-relaxed">{label}</p>
          <span className={styles.dots} aria-hidden="true"><span /><span /><span /></span>
        </div>
        {foundCount !== null && progress?.stage === "answering" && (
          <span className={foundCount > 0 ? styles.foundBadge : styles.emptyBadge}>
            {foundCount > 0 && <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            {foundLabel}
          </span>
        )}
        {progress?.stage === "answering" && <span className={styles.skeleton} aria-hidden="true"><span /><span /></span>}
      </div>
    </div>
  );
}

function ReferenceCard({ item, locale }: { item: MemeChatItem; locale: MemeChatLocale }) {
  const href = safeMemeHref(item.href);
  const sources = item.sources.flatMap((source) => {
    const url = publicSourceUrl(source.url);
    return url ? [{ url, label: source.label }] : [];
  });
  return (
    <li className={`${styles.reference} rounded-2xl border border-border bg-background p-3`}>
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
  const [progress, setProgress] = useState<MemeChatProgress | null>(null);
  const [foundCount, setFoundCount] = useState<number | null>(null);
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
      setProgress(null);
      setFoundCount(null);
      setOpen(false);
      launcherRef.current?.focus();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns, pendingQuestion, progress]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  function cancelRequest() {
    requestRef.current?.abort();
    requestRef.current = null;
    setPendingQuestion(null);
    setProgress(null);
    setFoundCount(null);
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
    setProgress({ stage: "reading" });
    setFoundCount(null);
    setError(null);
    try {
      const response = await fetch("/api/memes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
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
      const result: unknown = await readMemeChatResponse(response, {
        signal: controller.signal,
        onProgress(nextProgress) {
          if (controller.signal.aborted || requestRef.current !== controller) return;
          setProgress(nextProgress);
          if (nextProgress.stage === "found") setFoundCount(nextProgress.count);
        },
      });
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (!isChatResult(result)) {
        setError("unavailable");
        return;
      }
      const turn = { id: ++turnIdRef.current, question: submitted, result };
      setTurns((previous) => [...previous.slice(-(MAX_TURNS - 1)), turn]);
      setQuestion("");
    } catch (caught) {
      if (!controller.signal.aborted && requestRef.current === controller) {
        setError(caught instanceof MemeChatStreamError && caught.error === "request_timed_out" ? "timeout" : "unavailable");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPendingQuestion(null);
        setProgress(null);
        setFoundCount(null);
      }
    }
  }

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-[45] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 md:bottom-6 md:right-6">
      <AnimatePresence initial={false}>
        {open && (
        <AnimatedChatPanel key="chat-panel" id={panelId} titleId={titleId}>
          <header className={`${styles.panelHeader} flex shrink-0 items-center gap-2 border-b border-border px-4 py-2`}>
            <MemeChatCharacter size={46} />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-bold">{copy.title}</h2>
              <p className="mt-0.5 text-xs text-muted">{copy.subtitle}</p>
            </div>
            <button type="button" onClick={closePanel} aria-label={copy.close}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-background focus-visible:outline-2 focus-visible:outline-accent">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div ref={logRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 text-sm">
            <div role="log" aria-live="polite" aria-relevant="additions" className="space-y-4">
            {turns.length === 0 && (
              <div className="rounded-2xl border border-border bg-background p-3">
                <p className="leading-relaxed">{copy.welcome}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{copy.privacy}</p>
              </div>
            )}
            {turns.map((turn) => (
              <article key={turn.id} className="space-y-2">
                <p className={`${styles.userBubble} ml-8 whitespace-pre-wrap bg-accent-soft px-3 py-2 text-foreground`}>{turn.question}</p>
                <div className={`${styles.answer} space-y-3`}>
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
            </div>
            {pendingQuestion !== null && (
              <div className="space-y-2">
                <p className={`${styles.userBubble} ml-8 whitespace-pre-wrap bg-accent-soft px-3 py-2`}>{pendingQuestion}</p>
                <PendingAnswer locale={locale} progress={progress} foundCount={foundCount} />
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
              <button type="button" onClick={clearConversation} className="min-h-11 min-w-11 text-xs text-muted underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent">{copy.clear}</button>
              <span className="ml-auto text-xs text-muted" aria-hidden="true">{question.length}/120</span>
              <button type="submit" disabled={pending || question.trim().length < 2 || question.trim().length > 120}
                className="min-h-11 min-w-11 rounded-full bg-accent-strong px-4 text-sm font-bold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50">
                {copy.send}
              </button>
            </div>
          </form>
        </AnimatedChatPanel>
        )}
      </AnimatePresence>
      <button ref={launcherRef} type="button" aria-label={open ? copy.close : copy.open} aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => { if (open) closePanel(); else setOpen(true); }}
        className={`${styles.launcher} flex h-16 w-16 shrink-0 items-center justify-center border border-accent/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`}>
        <span className={styles.launcherPrompt} aria-hidden="true">{open ? copy.close : copy.launcherHint}</span>
        <MemeChatCharacter size={58} />
        {open && <span className={styles.launcherClose} aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>}
      </button>
    </div>
  );
}

export function MemeChatbot() {
  const pathname = usePathname() ?? "/";
  const { locale: preferredLocale } = useLocale();
  const pwaBannerVisible = useSyncExternalStore(subscribeToPwaBanner, pwaBannerSnapshot, serverPwaBannerSnapshot);
  const hydrated = useSyncExternalStore(subscribeToHydration, clientHydrationSnapshot, serverHydrationSnapshot);
  const route = parseLocalePath(pathname);
  if (pwaBannerVisible) return null;
  if (HIDDEN_PATHS.some((path) => route.pathname === path || route.pathname.startsWith(path + "/"))) return null;
  // The provider can update before this Suspense boundary hydrates. Match the
  // canonical server locale first, then apply the browser preference.
  const selected = route.hadLocalePrefix || !hydrated ? route.locale : preferredLocale;
  const locale: MemeChatLocale = CHAT_LOCALES.has(selected) ? selected as MemeChatLocale : "en";
  return <MemeChatPanel key={locale + ":" + route.pathname} locale={locale} />;
}
