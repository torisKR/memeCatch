"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEME_CARD_TARGET_COUNT, type MemeCardCatalogPage, type MemeCollectibleCard } from "@/lib/meme-collectible";
import { memeCardCatalogHref, memeCardReturnHref } from "@/lib/meme-collectible-ui";
import { useLocale } from "@/lib/i18n-client";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { MY_COPY } from "@/lib/i18n-my";
import { MemeCollectibleArt } from "./meme-collectible-art";
import { MemeCollectibleScratch } from "./meme-collectible-scratch";
import styles from "./meme-collectible.module.css";

export function MemeCollectibleGallery({ catalog, initialSelected = null, initialRevealed = false, selectedMissing = false, query = "", category = "" }: {
  catalog: MemeCardCatalogPage; initialSelected?: MemeCollectibleCard | null; initialRevealed?: boolean; selectedMissing?: boolean; query?: string; category?: string;
}) {
  const { locale } = useLocale();
  const copy = MEME_CARDS_COPY[locale];
  const categories = MY_COPY[locale].categories;
  const [selected, setSelected] = useState(initialSelected);
  const [revealed, setRevealed] = useState(Boolean(initialSelected && initialRevealed));
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [authFailed, setAuthFailed] = useState(false);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"failure" | "expired" | "unavailable" | null>(null);
  const operation = useRef(0);
  const claiming = useRef(false);
  const claimRequest = useRef<AbortController | null>(null);
  const ownershipRequest = useRef<AbortController | null>(null);
  const ownershipEpoch = useRef(0);
  const verifiedUser = useRef<string | null | undefined>(undefined);
  const refreshAuth = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let alive = true;
    let authEpoch = 0;
    const supabase = createClient();
    async function checkUser() {
      const epoch = ++authEpoch;
      if (alive) setAuthFailed(false);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!alive || authEpoch !== epoch) return;
        if (error && ![400, 401, 403].includes(error.status ?? 0) && error.name !== "AuthSessionMissingError") throw error;
        const id = !error && user && !user.is_anonymous ? user.id : null;
        if (verifiedUser.current !== id) {
          operation.current++; claiming.current = false; claimRequest.current?.abort();
          ownershipEpoch.current++; ownershipRequest.current?.abort();
          setOwned(new Set()); setBusy(false); verifiedUser.current = id;
        }
        setUserId(id);
      } catch { if (alive && authEpoch === epoch) { setAuthFailed(true); setUserId(undefined); } }
    }
    refreshAuth.current = checkUser;
    void checkUser();
    function revalidate() {
      ownershipEpoch.current++; ownershipRequest.current?.abort();
      operation.current++; claiming.current = false; claimRequest.current?.abort();
      setBusy(false); setUserId(undefined); setOwned(new Set());
      void checkUser();
    }
    function onVisibility() { if (document.visibilityState === "visible") revalidate(); }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        authEpoch++; verifiedUser.current = null;
        ownershipEpoch.current++; ownershipRequest.current?.abort();
        operation.current++; claiming.current = false; claimRequest.current?.abort();
        setUserId(null); setOwned(new Set()); setBusy(false);
      } else if (["SIGNED_IN", "USER_UPDATED", "TOKEN_REFRESHED", "PASSWORD_RECOVERY"].includes(event)) {
        revalidate();
      }
    });
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { alive = false; refreshAuth.current = null; subscription.unsubscribe(); claimRequest.current?.abort(); ownershipRequest.current?.abort(); window.removeEventListener("focus", revalidate); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  const visibleIds = [selected?.id, ...catalog.cards.map(card => card.id)].filter((id, index, all): id is string => Boolean(id) && all.indexOf(id) === index).slice(0, 24).join(",");
  useEffect(() => {
    if (!userId || !visibleIds) return;
    const controller = new AbortController();
    ownershipRequest.current = controller;
    const epoch = ownershipEpoch.current;
    const owner = userId;
    void fetch(`/api/meme-cards/collection?cardIds=${encodeURIComponent(visibleIds)}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (controller.signal.aborted || ownershipEpoch.current !== epoch || verifiedUser.current !== owner) return;
      if (response.status === 401) {
        ownershipEpoch.current++; verifiedUser.current = null;
        operation.current++; claimRequest.current?.abort(); claiming.current = false;
        setUserId(null); setOwned(new Set()); setBusy(false); return;
      }
      if (!response.ok) return;
      const result: unknown = await response.json();
      if (controller.signal.aborted || ownershipEpoch.current !== epoch || verifiedUser.current !== owner || !result || typeof result !== "object" || !("ownedCardIds" in result) || !Array.isArray(result.ownedCardIds)) return;
      const ids = result.ownedCardIds.filter((id): id is string => typeof id === "string" && visibleIds.split(",").includes(id));
      setOwned(previous => new Set([...previous, ...ids]));
    }).catch(() => { /* Claims still require a confirmed server result. */ });
    return () => controller.abort();
  }, [userId, visibleIds]);

  function changeSelection(card: MemeCollectibleCard | null) {
    operation.current++; claimRequest.current?.abort(); claiming.current = false;
    setBusy(false); setNotice(null); setSelected(card); setRevealed(false);
    window.history.replaceState(null, "", card ? memeCardReturnHref(card.id, catalog.page, false, query, category) : memeCardCatalogHref(catalog.page, query, category));
  }
  function reveal() {
    if (!selected) return;
    setRevealed(true);
    window.history.replaceState(null, "", memeCardReturnHref(selected.id, catalog.page, true, query, category));
  }
  async function claim() {
    if (!selected || !revealed || !userId || claiming.current || owned.has(selected.id) || notice === "unavailable") return;
    claiming.current = true; setBusy(true); setNotice(null);
    const epoch = ++operation.current;
    const controller = new AbortController(); claimRequest.current = controller;
    const cardId = selected.id;
    try {
      const response = await fetch("/api/meme-cards/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId }), signal: controller.signal, cache: "no-store" });
      if (controller.signal.aborted || operation.current !== epoch) return;
      if (response.status === 401) { ownershipEpoch.current++; ownershipRequest.current?.abort(); verifiedUser.current = null; setUserId(null); setOwned(new Set()); setNotice("expired"); return; }
      if (response.status === 404 || response.status === 409) { setNotice("unavailable"); return; }
      if (!response.ok) throw new Error("claim_failed");
      const result: unknown = await response.json();
      if (controller.signal.aborted || operation.current !== epoch) return;
      if (!result || typeof result !== "object" || !("cardId" in result) || result.cardId !== cardId || !("owned" in result) || result.owned !== true) throw new Error("invalid_claim_result");
      setOwned(previous => new Set([...previous, cardId]));
    } catch { if (!controller.signal.aborted && operation.current === epoch) setNotice("failure"); }
    finally { if (operation.current === epoch) { claiming.current = false; setBusy(false); claimRequest.current = null; } }
  }
  const selectedOwned = Boolean(userId && selected && owned.has(selected.id));
  const pages = Math.max(1, Math.ceil(catalog.total / catalog.pageSize));

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p><div className={styles.heroLinks}><span className={styles.freeBadge}>{copy.free}</span><Link href="/my#meme-cards" className={styles.textButton}>{copy.my} ↗</Link></div></div>
      <div className={styles.heroMark} aria-hidden>m.</div>
    </header>
    {selectedMissing && !selected && <p role="status" className={styles.notice}>{copy.selectedMissing}</p>}
    {selected && <section id="reveal" className={styles.reveal} aria-labelledby="meme-card-reveal-title" data-card-id={selected.id} data-revealed={revealed}>
      <MemeCollectibleScratch key={selected.id} card={selected} revealed={revealed} onReveal={reveal}/>
      <div className={styles.revealDetails}>
        <span className={styles.eyebrow}>NO. {String(selected.cardNo).padStart(4, "0")} / {MEME_CARD_TARGET_COUNT}</span>
        <h2 id="meme-card-reveal-title">{revealed ? selected.title : copy.revealTitle}</h2>
        <p>{revealed ? selected.summary : copy.scratch}</p>
        <div className={styles.revealActions}>
          {revealed && (selectedOwned ? <><span className={styles.ownedBadge}>{copy.owned} ✓</span><Link href="/my#meme-cards" className={styles.primaryButton}>{copy.my}</Link></> : userId === null ? <Link className={styles.primaryButton} href={`/login?next=${encodeURIComponent(memeCardReturnHref(selected.id, catalog.page, true, query, category))}`}>{copy.loginClaim}</Link> : authFailed ? <><p role="alert" className={styles.notice}>{copy.authFailure}</p><button type="button" className={styles.secondaryButton} onClick={() => void refreshAuth.current?.()}>{copy.retry}</button></> : <button type="button" className={styles.primaryButton} onClick={claim} disabled={busy || userId === undefined || notice === "unavailable"}>{busy ? copy.claiming : userId === undefined ? copy.checking : notice === "failure" ? copy.retry : copy.claim}</button>)}
          {revealed && !selectedOwned && <p className={styles.small}>{copy.loginHint}</p>}
          {notice && <p className={styles.notice} role="alert">{copy[notice]}</p>}
          {revealed && <Link href={selected.href} className={styles.secondaryButton}>{copy.details} ↗</Link>}
          <button type="button" className={styles.textButton} onClick={() => changeSelection(null)}>{copy.cancel}</button>
          <p className={styles.small}>{copy.originalArt}<br/>{copy.rights}</p>
        </div>
      </div>
    </section>}
    <section aria-labelledby="meme-card-catalog-title">
      <div className={styles.sectionHeading}><h2 id="meme-card-catalog-title">{copy.catalog}</h2><p>{copy.availableCount(catalog.total)}</p></div>
      <form action="/meme-cards" method="get" className={styles.filters}>
        <label>{copy.search}<input name="query" defaultValue={query} maxLength={80} placeholder={copy.searchPlaceholder}/></label>
        <label>{copy.category}<select name="category" defaultValue={category}><option value="">{copy.all}</option>{["phrase", "dance", "song", "image", "comment", "challenge"].map(value => <option key={value} value={value}>{categories[value as keyof typeof categories]}</option>)}</select></label>
        <button className={styles.primaryButton} type="submit">{copy.apply}</button>
        {(query || category) && <Link className={styles.textButton} href="/meme-cards">{copy.clear}</Link>}
      </form>
      {catalog.cards.length ? <ul className={styles.grid}>{catalog.cards.map(card => <li key={card.id}><button type="button" data-card-id={card.id} className={styles.catalogButton} aria-label={`${card.title} · ${copy.choose}`} aria-pressed={selected?.id === card.id} onClick={() => { changeSelection(card); window.requestAnimationFrame(() => document.getElementById("reveal")?.scrollIntoView?.({ block: "start", behavior: "instant" })); }}><MemeCollectibleArt card={card} compact/>{Boolean(userId) && owned.has(card.id) && <span className={styles.ownedBadge}>{copy.owned}</span>}</button></li>)}</ul> : <div className={styles.empty}><h3>{copy.noResults}</h3><p>{copy.noResultsBody}</p><Link href="/meme-cards" className={styles.secondaryButton}>{copy.clear}</Link></div>}
      {pages > 1 && <nav className={styles.pagination} aria-label={copy.catalog}>{catalog.page > 1 && <Link className={styles.secondaryButton} href={memeCardCatalogHref(catalog.page - 1, query, category)}>{copy.previous}</Link>}<span>{copy.page(catalog.page, pages)}</span>{catalog.hasMore && <Link className={styles.secondaryButton} href={memeCardCatalogHref(catalog.page + 1, query, category)}>{copy.next}</Link>}</nav>}
    </section>
  </main>;
}
