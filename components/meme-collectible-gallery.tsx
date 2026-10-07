"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEME_CARD_TARGET_COUNT, type MemeCardDiscoveryPage, type MemeCardSeal, type MemeCollectibleCard } from "@/lib/meme-collectible";
import { memeCardCatalogHref, memeCardReturnHref, readRevealedMemeCard } from "@/lib/meme-collectible-ui";
import { useLocale } from "@/lib/i18n-client";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { MemeCollectibleSeal } from "./meme-collectible-seal";
import { MemeCollectibleScratch } from "./meme-collectible-scratch";
import styles from "./meme-collectible.module.css";

export function MemeCollectibleGallery({ catalog, initialSelected = null, initialCard = null, initialRevealed = false, selectedMissing = false }: {
  catalog: MemeCardDiscoveryPage; initialSelected?: MemeCardSeal | null; initialCard?: MemeCollectibleCard | null; initialRevealed?: boolean; selectedMissing?: boolean;
}) {
  const { locale } = useLocale();
  const copy = MEME_CARDS_COPY[locale];
  const [selected, setSelected] = useState(initialSelected);
  const [card, setCard] = useState(initialRevealed && initialSelected?.id === initialCard?.id ? initialCard : null);
  const [revealed, setRevealed] = useState(Boolean(initialSelected && initialCard && initialSelected.id === initialCard.id && initialRevealed));
  const [seals, setSeals] = useState(catalog.cards);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [contentError, setContentError] = useState<"failure" | "unavailable" | null>(null);
  const contentRequest = useRef<AbortController | null>(null);
  const contentEpoch = useRef(0);
  const revealWanted = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
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

  useEffect(() => () => { contentEpoch.current++; contentRequest.current?.abort(); }, []);

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

  function changeSelection(seal: MemeCardSeal | null) {
    operation.current++; claimRequest.current?.abort(); claiming.current = false;
    contentEpoch.current++; contentRequest.current?.abort(); contentRequest.current = null; revealWanted.current = false;
    setBusy(false); setNotice(null); setSelected(seal); setCard(null); setRevealed(false); setLoading(false); setContentError(null); setSelectionVersion(version => version + 1);
    window.history.replaceState(null, "", seal ? memeCardReturnHref(seal.id, catalog.page, false) : memeCardCatalogHref(catalog.page));
    if (seal) window.requestAnimationFrame(() => { document.getElementById("reveal")?.scrollIntoView?.({ block: "start", behavior: "instant" }); titleRef.current?.focus({ preventScroll: true }); });
  }
  function completeReveal(id: string) {
    setRevealed(true);
    window.history.replaceState(null, "", memeCardReturnHref(id, catalog.page, true));
    window.requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
  }
  async function loadCard() {
    if (!selected || card || contentRequest.current || contentError === "unavailable") return;
    const id = selected.id;
    const epoch = ++contentEpoch.current;
    const controller = new AbortController(); contentRequest.current = controller;
    setLoading(true); setContentError(null);
    try {
      const response = await fetch(`/api/meme-cards/${id}`, { cache: "no-store", signal: controller.signal });
      if (controller.signal.aborted || contentEpoch.current !== epoch) return;
      if (response.status === 404) { setContentError("unavailable"); return; }
      if (!response.ok) throw new Error("reveal_failed");
      const result = readRevealedMemeCard(await response.json(), id);
      if (controller.signal.aborted || contentEpoch.current !== epoch) return;
      if (!result) throw new Error("invalid_reveal_result");
      setCard(result);
      if (revealWanted.current) completeReveal(id);
    } catch { if (!controller.signal.aborted && contentEpoch.current === epoch) setContentError("failure"); }
    finally { if (contentEpoch.current === epoch) { setLoading(false); contentRequest.current = null; } }
  }
  function reveal() {
    if (!selected || revealed || contentError === "unavailable") return;
    revealWanted.current = true;
    if (card) completeReveal(selected.id); else if (!contentError) void loadCard();
  }
  function shuffle() {
    setSeals(previous => {
      const next = [...previous];
      for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
      return next;
    });
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
      <div className={styles.heroMark} aria-hidden>m<span>↗</span></div>
    </header>
    {selectedMissing && !selected && <p role="status" className={styles.notice}>{copy.selectedMissing}</p>}
    {selected && <section id="reveal" className={styles.reveal} aria-labelledby="meme-card-reveal-title" data-card-id={selected.id} data-revealed={revealed}>
      <MemeCollectibleScratch key={`${selected.id}:${selectionVersion}`} cardId={selected.id} card={card} revealed={revealed} loading={loading} unavailable={contentError === "unavailable"} onStart={() => void loadCard()} onReveal={reveal}/>
      <div className={styles.revealDetails}>
        <span className={styles.eyebrow}>{revealed && card ? `NO. ${String(card.cardNo).padStart(4, "0")} / ${MEME_CARD_TARGET_COUNT}` : copy.sealed}</span>
        <h2 id="meme-card-reveal-title" ref={titleRef} tabIndex={-1}>{revealed && card ? card.title : copy.revealTitle}</h2>
        <p>{revealed && card ? card.summary : copy.scratchHint}</p>
        {loading && <p className={styles.loading} role="status"><span/>{copy.revealLoading}</p>}
        {contentError && <div className={styles.notice} role="alert"><p>{contentError === "failure" ? copy.revealLoadFailure : copy.unavailable}</p>{contentError === "failure" && <button type="button" className={styles.secondaryButton} onClick={() => void loadCard()}>{copy.retry}</button>}</div>}
        <div className={styles.revealActions}>
          {revealed && (selectedOwned ? <><span className={styles.ownedBadge}>{copy.owned} ✓</span><Link href="/my#meme-cards" className={styles.primaryButton}>{copy.my}</Link></> : userId === null ? <Link className={styles.primaryButton} href={`/login?next=${encodeURIComponent(memeCardReturnHref(selected.id, catalog.page, true))}`}>{copy.loginClaim}</Link> : authFailed ? <><p role="alert" className={styles.notice}>{copy.authFailure}</p><button type="button" className={styles.secondaryButton} onClick={() => void refreshAuth.current?.()}>{copy.retry}</button></> : <button type="button" className={styles.primaryButton} onClick={claim} disabled={busy || userId === undefined || notice === "unavailable"}>{busy ? copy.claiming : userId === undefined ? copy.checking : notice === "failure" ? copy.retry : copy.claim}</button>)}
          {revealed && !selectedOwned && <p className={styles.small}>{copy.loginHint}</p>}
          {notice && <p className={styles.notice} role="alert">{copy[notice]}</p>}
          {revealed && card && <Link href={card.href} className={styles.secondaryButton}>{copy.details} ↗</Link>}
          <button type="button" className={styles.textButton} onClick={() => changeSelection(null)}>{copy.cancel}</button>
          <p className={styles.small}>{copy.originalArt}<br/>{copy.rights}</p>
        </div>
      </div>
    </section>}
    <section aria-labelledby="meme-card-catalog-title">
      <div className={styles.sectionHeading}><h2 id="meme-card-catalog-title">{copy.catalog}</h2><p>{copy.availableCount(catalog.total)}</p></div>
      <div className={styles.discoveryTools}><p>{copy.discoveryHint}</p><button type="button" className={styles.secondaryButton} onClick={shuffle} disabled={seals.length < 2}>{copy.shuffle} ↻</button></div>
      {seals.length ? <ul className={styles.grid}>{seals.map((seal, index) => <li key={seal.id}><button type="button" data-card-id={seal.id} className={styles.catalogButton} aria-label={copy.sealedChoice(index + 1)} aria-pressed={selected?.id === seal.id} onClick={() => changeSelection(seal)}><MemeCollectibleSeal compact label={copy.foilTitle} hint={copy.foilHint}/>{Boolean(userId) && owned.has(seal.id) && <span className={styles.ownedBadge}>{copy.owned}</span>}</button></li>)}</ul> : <div className={styles.empty}><h3>{copy.noResults}</h3><p>{copy.noResultsBody}</p></div>}
      {pages > 1 && <nav className={styles.pagination} aria-label={copy.catalog}>{catalog.page > 1 && <Link className={styles.secondaryButton} href={memeCardCatalogHref(catalog.page - 1)}>{copy.previous}</Link>}<span>{copy.page(catalog.page, pages)}</span>{catalog.hasMore && <Link className={styles.secondaryButton} href={memeCardCatalogHref(catalog.page + 1)}>{copy.next}</Link>}</nav>}
    </section>
  </main>;
}
