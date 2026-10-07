import styles from "./meme-collectible.module.css";

/** The same opaque back for every card: no card-specific text, art, or seed. */
export function MemeCollectibleSeal({ label, hint, compact = false }: { label: string; hint: string; compact?: boolean }) {
  return <div className={`${styles.sealedCard} ${compact ? styles.sealCompact : ""}`} aria-hidden="true">
    <div className={styles.sealInner}>
      <span className={styles.sealTop}>MEMECATCH <span>COLLECTION</span></span>
      <div className={styles.sealOrbit}><span>m<span>↗</span></span></div>
      <div className={styles.sealFooter}><strong>{label}</strong><span>{hint}</span><i>✦</i></div>
    </div>
  </div>;
}
