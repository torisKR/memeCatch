"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MemeCardCollectionPage } from "@/lib/meme-collectible";
import { memeCardReturnHref } from "@/lib/meme-collectible-ui";
import { useLocale } from "@/lib/i18n-client";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { MY_COPY } from "@/lib/i18n-my";
import { MemeCollectibleArt } from "./meme-collectible-art";
import styles from "./meme-collectible.module.css";

type OwnerStatus = "verifying" | "ready" | "signed-out" | "changed" | "failed";

export function MemeCollectibleCollection({ ownerUserId, initialPage, initialError = false, initialLoginRequired = false }: { ownerUserId: string; initialPage: MemeCardCollectionPage | null; initialError?: boolean; initialLoginRequired?: boolean }) {
  const router = useRouter();
  const { locale } = useLocale();
  const copy = MEME_CARDS_COPY[locale];
  const categories = MY_COPY[locale].categories;
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialPage?.total ?? null);
  const [error, setError] = useState(initialError);
  const [loginRequired, setLoginRequired] = useState(initialLoginRequired);
  const [busy, setBusy] = useState(false);
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus>(initialLoginRequired ? "signed-out" : "verifying");
  const [filters, setFilters] = useState({ query: "", category: "" });
  const request = useRef<AbortController | null>(null);
  const authEpoch = useRef(0);
  const ownerStatusRef = useRef<OwnerStatus>(initialLoginRequired ? "signed-out" : "verifying");
  const mounted = useRef(true);
  const retainedView = useRef({ page: initialPage, total: initialPage?.total ?? null, error: initialError });
  const invalidateOwner = useCallback((status: OwnerStatus) => {
    authEpoch.current++; request.current?.abort(); ownerStatusRef.current = status;
    if (status !== "verifying") retainedView.current = { page: null, total: null, error: true };
    setOwnerStatus(status); setPage(null); setTotal(null); setError(true); setBusy(false);
    setLoginRequired(status === "signed-out");
  }, []);
  const verifyOwner = useCallback(async (epoch: number, restoreView = false) => {
    try {
      const { data: { user }, error: authError } = await createClient().auth.getUser();
      if (!mounted.current || authEpoch.current !== epoch) return false;
      if (authError && ![400, 401, 403].includes(authError.status ?? 0) && authError.name !== "AuthSessionMissingError") throw authError;
      if (authError || !user || user.is_anonymous) { invalidateOwner("signed-out"); return false; }
      if (user.id !== ownerUserId) { invalidateOwner("changed"); return false; }
      ownerStatusRef.current = "ready"; setOwnerStatus("ready"); setLoginRequired(false);
      if (restoreView) { setPage(retainedView.current.page); setTotal(retainedView.current.total); setError(retainedView.current.error); }
      return true;
    } catch {
      if (mounted.current && authEpoch.current === epoch) invalidateOwner("failed");
      return false;
    }
  }, [ownerUserId, invalidateOwner]);
  useEffect(() => {
    mounted.current = true;
    void verifyOwner(++authEpoch.current);
    function revalidate() {
      invalidateOwner("verifying");
      void verifyOwner(authEpoch.current, true);
    }
    function onVisibility() { if (document.visibilityState === "visible") revalidate(); }
    const { data: { subscription } } = createClient().auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") { invalidateOwner("signed-out"); return; }
      if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) {
        revalidate();
      }
    });
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { mounted.current = false; subscription.unsubscribe(); request.current?.abort(); window.removeEventListener("focus", revalidate); document.removeEventListener("visibilitychange", onVisibility); };
  }, [verifyOwner, invalidateOwner]);

  async function load(targetPage: number, targetFilters = filters) {
    if (["signed-out", "changed", "verifying"].includes(ownerStatusRef.current)) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const epoch = authEpoch.current;
    setBusy(true); setError(false); setLoginRequired(false);
    const params = new URLSearchParams({ page: String(targetPage) });
    if (targetFilters.query) params.set("query", targetFilters.query);
    if (targetFilters.category) params.set("category", targetFilters.category);
    try {
      if (!await verifyOwner(epoch) || controller.signal.aborted) return;
      async function fetchPage(search: URLSearchParams): Promise<MemeCardCollectionPage> {
        const response = await fetch(`/api/meme-cards/collection?${search}`, { signal: controller.signal, cache: "no-store" });
        if (controller.signal.aborted || authEpoch.current !== epoch) throw new Error("stale_collection");
        if (response.status === 401) { invalidateOwner("signed-out"); throw new Error("signed_out"); }
        if (!response.ok) throw new Error("collection_failed");
        const result: MemeCardCollectionPage = await response.json();
        if (!Array.isArray(result.cards) || typeof result.total !== "number") throw new Error("invalid_collection");
        return result;
      }
      const needsFullTotal = total === null && Boolean(targetFilters.query || targetFilters.category);
      const [result, complete] = await Promise.all([
        fetchPage(params),
        needsFullTotal ? fetchPage(new URLSearchParams({ page: "1" })) : Promise.resolve(null),
      ]);
      if (controller.signal.aborted || authEpoch.current !== epoch || !await verifyOwner(epoch) || controller.signal.aborted) return;
      const fullTotal = complete?.total ?? (!targetFilters.query && !targetFilters.category ? result.total : total);
      retainedView.current = { page: result, total: fullTotal, error: false };
      setPage(result); setFilters(targetFilters);
      if (complete) setTotal(complete.total);
      else if (!targetFilters.query && !targetFilters.category) setTotal(result.total);
    } catch { if (!controller.signal.aborted && authEpoch.current === epoch) { retainedView.current.error = true; setError(true); } }
    finally { if (!controller.signal.aborted && authEpoch.current === epoch) setBusy(false); }
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void load(1, { query: String(data.get("query") ?? "").trim(), category: String(data.get("category") ?? "") });
  }
  const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  return <section id="meme-cards" className={styles.collection} aria-labelledby="my-meme-card-title" aria-busy={busy}>
    <div className={styles.sectionHeading}><div><h2 id="my-meme-card-title">{copy.my}</h2><p>{copy.private} · {copy.recent}</p></div><div>{ownerStatus === "ready" && total !== null && <><span className={styles.freeBadge}>{copy.target(total)}</span><p>{copy.count(total)}</p></>}</div></div>
    <form onSubmit={search} className={styles.filters}>
      <label>{copy.search}<input name="query" maxLength={80} placeholder={copy.searchPlaceholder}/></label>
      <label>{copy.category}<select name="category"><option value="">{copy.all}</option>{["phrase", "dance", "song", "image", "comment", "challenge"].map(value => <option key={value} value={value}>{categories[value as keyof typeof categories]}</option>)}</select></label>
      <button type="submit" className={styles.primaryButton} disabled={busy || ownerStatus !== "ready"}>{copy.apply}</button>
    </form>
    {ownerStatus === "verifying" && !error && <p role="status" className={styles.notice}>{copy.checking}</p>}
    {error && <div className={styles.empty}><p role={ownerStatus === "verifying" ? "status" : "alert"}>{ownerStatus === "changed" ? copy.accountChanged : ownerStatus === "failed" ? copy.authFailure : ownerStatus === "verifying" ? copy.checking : copy.loadFailure}</p>{loginRequired ? <Link href="/login?next=%2Fmy%23meme-cards" className={styles.primaryButton}>{copy.loginClaim}</Link> : <button type="button" className={styles.secondaryButton} onClick={() => ownerStatus === "changed" ? router.refresh() : void load(page?.page ?? 1)} disabled={busy || ownerStatus === "verifying"}>{copy.retry}</button>}</div>}
    {ownerStatus === "ready" && !error && page?.cards.length === 0 && <div className={styles.empty}><h3>{filters.query || filters.category ? copy.noResults : copy.empty}</h3><p>{filters.query || filters.category ? copy.noResultsBody : copy.emptyBody}</p><Link href="/meme-cards" className={styles.primaryButton}>{copy.start}</Link></div>}
    {ownerStatus === "ready" && page && page.cards.length > 0 && <ul className={styles.grid}>{page.cards.map(card => <li key={card.id}>{card.available ? <><Link className={styles.catalogButton} href={memeCardReturnHref(card.id, Math.ceil(card.cardNo / 24), true)} aria-label={`${card.title} · ${copy.owned}`}><MemeCollectibleArt card={card} compact/></Link><p className={styles.claimedDate}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(card.claimedAt))}</p></> : <div className={styles.hiddenCard}><span aria-hidden>▧</span><strong>{copy.hidden}</strong><p>{copy.hiddenBody}</p><span className={styles.small}>{card.id}</span></div>}</li>)}</ul>}
    {ownerStatus === "ready" && !error && page && pages > 1 && <nav className={styles.pagination} aria-label={copy.my}>{page.page > 1 && <button type="button" className={styles.secondaryButton} onClick={() => void load(page.page - 1)} disabled={busy}>{copy.previous}</button>}<span>{copy.page(page.page, pages)}</span>{page.hasMore && <button type="button" className={styles.secondaryButton} onClick={() => void load(page.page + 1)} disabled={busy}>{copy.next}</button>}</nav>}
    <Link href="/meme-cards" className={styles.textButton}>{copy.catalog} ↗</Link>
  </section>;
}
