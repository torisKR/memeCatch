import type { CSSProperties } from "react";
import type { MemeCardArtMotif, MemeCollectibleCard } from "@/lib/meme-collectible";
import styles from "./meme-collectible.module.css";
import { MemeCollectibleSymbol } from "./meme-collectible-symbols";

/** All geometry is drawn for these cards; no source meme photograph or character is copied. */
function Scene({ motif, title, seed }: { motif: MemeCardArtMotif; title: string; seed: number }) {
  const lean = (seed % 13) - 6;
  const text = title.toLowerCase();
  switch (motif) {
    case "pen-pineapple": return <><g transform="translate(22 20) rotate(-16 90 110)"><path d="M73 61 56 26 78 39 87 10 98 42 125 29 112 65" fill="var(--card-accent)"/><rect x="59" y="60" width="61" height="91" rx="28" fill="var(--card-ink)"/><path d="m63 83 46 48m-47-21 28 31m-9-73 36 40m-52 18 46-47m-47 21 26-32m-2 72 30-30" stroke="var(--card-paper)" strokeWidth="3"/></g><path d="m181 19 13 8-67 132-17 17 4-24Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="4"/><path d="M160 192c-25-37 3-64 20-50 20-13 43 16 20 49Z" fill="var(--card-accent)"/><path d="m180 139 9-16" stroke="var(--card-ink)" strokeWidth="5"/><path d="M124 114h28m-14-14v28" stroke="var(--card-paper)" strokeWidth="5"/></>;
    case "dance": return <><g transform={`rotate(${lean} 120 110)`}><circle cx="133" cy="37" r="19" fill="var(--card-ink)"/><path d="m130 61-22 57 44 6-11-58" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="6"/><path d={text.includes("강남") ? "m118 73-45 6 72 8m-22-13 47 6-77 10m18 25-33 27 29 37m32-60 30 21-31 34" : "m119 76-43-28-16 14m81 14 36-43 19 8m-80 78-39 58m59-57 38 28-27 38"} fill="none" stroke="var(--card-ink)" strokeWidth="13" strokeLinecap="round"/></g><path d="M26 179q-7-69 24-101m148 26q37 28 13 75" fill="none" stroke="var(--card-accent)" strokeWidth="4" strokeDasharray="7 9"/></>;
    case "gaming": return <><rect x="30" y="24" width="180" height="115" rx="10" fill="var(--card-ink)"/><rect x="43" y="37" width="154" height="86" fill="var(--card-paper)"/><path d="m61 90 18-16 22 14 38-43 39 53" fill="none" stroke="var(--card-accent)" strokeWidth="8"/><path d="M77 149h88q33 4 38 44l-19 7-28-24H86l-25 24-22-9q5-38 38-42" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="M71 162v26m-13-13h26" stroke="var(--card-ink)" strokeWidth="6"/><circle cx="164" cy="168" r="5" fill="var(--card-ink)"/><circle cx="181" cy="178" r="5" fill="var(--card-ink)"/></>;
    case "office": return <><path d="M27 153h188v13H27Z" fill="var(--card-ink)"/><path d="m48 152-9-86h104l-13 86Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><circle cx="90" cy="108" r="11" fill="var(--card-paper)"/><path d="M57 164v33m138-33v33" stroke="var(--card-ink)" strokeWidth="10"/><path d="M173 113h27v35h-27Z" fill="var(--card-paper)" stroke="var(--card-ink)" strokeWidth="4"/><path d="M201 121q25 0 4 17M179 95q-14-12 2-28m13 30q-13-13 3-31" fill="none" stroke="var(--card-accent)" strokeWidth="4"/><rect x="144" y="17" width="69" height="58" rx="6" fill="var(--card-ink)"/><path d="m156 36 13 10 30-18" stroke="var(--card-paper)" strokeWidth="5" fill="none"/></>;
    case "food": return text.includes("케이크") || text.includes("cake") ? <><path d="m52 91 116-61 33 64-96 24Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m52 92 53 26 97-25v78l-98 25-52-29Z" fill="var(--card-paper)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m53 122 52 26 96-25m-147 26 51 26 96-24" fill="none" stroke="var(--card-accent)" strokeWidth="10"/><circle cx="150" cy="59" r="14" fill="var(--card-ink)"/><path d="m148 45 12-15" stroke="var(--card-ink)" strokeWidth="4"/></> : <><path d="M50 86h126l-15 100H66Z" fill="var(--card-paper)" stroke="var(--card-ink)" strokeWidth="6"/><path d="M56 108h115l-7 58H64Z" fill="var(--card-accent)"/><path d="M177 107q61-7 19 58h-27" stroke="var(--card-ink)" strokeWidth="6" fill="none"/><path d="M51 86q9-29 32-18 14-30 39-7 34-7 52 25" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m114 69 25-49m-38 51 26-48m-11 12 22 9" stroke="var(--card-ink)" strokeWidth="4"/><path d="M39 200h151" stroke="var(--card-ink)" strokeWidth="6"/></>;
    case "animal": return text.includes("상어") || text.includes("shark") ? <><path d="M22 116q67-69 141-27l35-22-9 47 30 38-60-3q-69 54-137-33" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m95 87 24-48 29 44" fill="var(--card-ink)"/><circle cx="60" cy="109" r="6" fill="var(--card-ink)"/><path d="m36 125 37 14-11-22-13 14-7-18" fill="var(--card-paper)" stroke="var(--card-ink)" strokeWidth="3"/><path d="M20 183q20-15 40 0t40 0 40 0 40 0 40 0" fill="none" stroke="var(--card-ink)" strokeWidth="4"/></> : text.includes("펭") || text.includes("penguin") ? <><ellipse cx="121" cy="113" rx="56" ry="78" fill="var(--card-ink)"/><ellipse cx="122" cy="127" rx="36" ry="57" fill="var(--card-paper)"/><path d="m113 66 20 1-10 13Z" fill="var(--card-accent)"/><circle cx="101" cy="58" r="4" fill="var(--card-paper)"/><circle cx="143" cy="58" r="4" fill="var(--card-paper)"/><path d="m69 103-32 57m135-57 30 49" stroke="var(--card-ink)" strokeWidth="20" strokeLinecap="round"/><path d="m80 192 32-6m18 0 33 6" stroke="var(--card-accent)" strokeWidth="12"/></> : <><path d="m55 81 2-54 45 29q21-7 40 0l41-29 3 53q37 48-5 85-58 37-117 1-40-38-9-85" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m113 119 10 10 11-10m-11 10v13m-37-43 12 5m48 0 12-5M48 129l-32-5m34 20-34 7m177-22 32-5m-34 20 33 6" stroke="var(--card-ink)" strokeWidth="5" fill="none"/></>;
    case "sport": return <><path d="M22 195 73 154l31 14 47-65 67-72" fill="none" stroke="var(--card-ink)" strokeWidth="13"/><path d="m198 32 24-5-2 27" fill="none" stroke="var(--card-accent)" strokeWidth="8"/><path d="M88 106C31 75 45 31 74 34q23 0 33 22 11-22 34-22c32-1 46 40-12 75l-19 14Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m67 76 22 1 10-20 13 43 14-23h17" fill="none" stroke="var(--card-paper)" strokeWidth="5"/></>;
    case "music": return <><circle cx="105" cy="110" r="77" fill="var(--card-ink)"/><circle cx="105" cy="110" r="50" fill="none" stroke="var(--card-paper)" strokeWidth="2"/><circle cx="105" cy="110" r="19" fill="var(--card-accent)"/><path d="m170 26 42-10v88q-24 23-32 7-10-15 21-20V49l-30 8v68q-24 23-32 7-9-17 21-21V29Z" fill="var(--card-accent)" stroke="var(--card-paper)" strokeWidth="3"/><path d="M25 204v-26m15 26v-14m15 14v-31m15 31v-18m15 18v-37" stroke="var(--card-accent)" strokeWidth="7"/></>;
    case "chat": return <><path d="M20 42h142v92H72l-38 30v-30H20Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="M108 100h113v79h-15v30l-39-30h-59Z" fill="var(--card-paper)" stroke="var(--card-ink)" strokeWidth="5"/><path d="M43 65h84m-84 21h63m-63 21h40" stroke="var(--card-ink)" strokeWidth="5"/><circle cx="136" cy="142" r="5" fill="var(--card-accent)"/><circle cx="162" cy="142" r="5" fill="var(--card-accent)"/><circle cx="188" cy="142" r="5" fill="var(--card-accent)"/></>;
    case "choice": return <><path d="M120 194v-57m0 0L57 74m63 63 64-63" fill="none" stroke="var(--card-ink)" strokeWidth="12"/><path d="m48 101 2-43 41 3m61-1 41-3 1 43" stroke="var(--card-accent)" strokeWidth="9" fill="none"/><circle cx="53" cy="36" r="20" fill="var(--card-accent)"/><path d="m42 35 9 9 14-17" stroke="var(--card-ink)" strokeWidth="5" fill="none"/><rect x="165" y="15" width="40" height="40" rx="10" fill="var(--card-ink)"/><path d="m177 27 16 16m0-16-16 16" stroke="var(--card-paper)" strokeWidth="4"/><circle cx="120" cy="179" r="23" fill="var(--card-paper)" stroke="var(--card-ink)" strokeWidth="5"/></>;
    case "technology": return <><rect x="57" y="41" width="129" height="132" rx="17" fill="var(--card-ink)"/><rect x="77" y="62" width="90" height="89" rx="7" fill="var(--card-accent)"/><path d="m98 89-13 18 13 18m46-36 13 18-13 18m-19-42-12 49M37 73h20m-20 32h20m-20 33h20m130-65h20m-20 32h20m-20 33h20M90 21v20m32-20v20m33-20v20m-65 132v20m32-20v20m33-20v20" stroke="var(--card-paper)" strokeWidth="5" fill="none"/></>;
    case "celebration": return <><circle cx="121" cy="67" r="24" fill="var(--card-ink)"/><path d="M106 95h30l20 76H86Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m106 106-44-35-14-24m88 59 40-39 13-25m-83 129-11 30m39-30 15 30" stroke="var(--card-ink)" strokeWidth="10" strokeLinecap="round" fill="none"/><path d="m34 72-18-4m44-33-2-22m132 50 30-7m-52-29 11-22m-62 14 1-17" stroke="var(--card-accent)" strokeWidth="7"/><path d="m25 129 9 12 12-18m149 29 9 12 12-18" stroke="var(--card-ink)" strokeWidth="4" fill="none"/></>;
    case "fashion": return <><path d="m61 31 37-10q25 25 46 0l36 10 43 50-37 29-20-22v108H78V88l-20 22-36-29Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="m99 22 24 42 22-42m-23 42v49" stroke="var(--card-ink)" strokeWidth="5" fill="none"/><circle cx="123" cy="133" r="19" fill="var(--card-paper)"/><path d="m112 132 10 11 16-20" fill="none" stroke="var(--card-ink)" strokeWidth="5"/></>;
    case "travel": return <><path d="m15 71 49 17 106-61 35 8-68 71 64 30-14 14-81-11-38 44-19-6 15-55-53-34Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="M28 207q36-58 78-18t108-29" stroke="var(--card-ink)" strokeWidth="4" strokeDasharray="7 8" fill="none"/><circle cx="183" cy="184" r="17" fill="var(--card-ink)"/><circle cx="183" cy="184" r="6" fill="var(--card-paper)"/></>;
    case "study": return <><path d="M21 40q49-13 100 12 51-25 100-12v134q-54-13-100 10-47-23-100-10Z" fill="var(--card-paper)" stroke="var(--card-ink)" strokeWidth="5"/><path d="M120 52v131M40 65q34-5 60 7m-60 17q34-5 60 7m-60 17q34-5 60 7m41-55q31-5 61-1m-61 22q31-5 61-1" fill="none" stroke="var(--card-ink)" strokeWidth="4"/><path d="m152 166 44-86 14 7-43 86-20 17Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="4"/></>;
    case "reaction": return <><path d="m36 68 32-34 39 12 36-18 47 31-9 41 28 41-40 40-43-6-31 23-45-31 6-38-32-35Z" fill="var(--card-accent)" stroke="var(--card-ink)" strokeWidth="5"/><path d="M87 76v23m63-23v23" stroke="var(--card-ink)" strokeWidth="8" strokeLinecap="round"/><ellipse cx="120" cy="136" rx="17" ry="23" fill="var(--card-ink)"/><path d="M207 36q-2-25-23-17-12 5-6 17m12 1-1 13" stroke="var(--card-ink)" strokeWidth="5" fill="none"/><circle cx="188" cy="59" r="3" fill="var(--card-ink)"/></>;
  }
}

export function MemeCollectibleArt({ card, compact = false }: { card: MemeCollectibleCard; compact?: boolean }) {
  const seed = card.artSeed >>> 0;
  const ink = ["#252c32", "#352323", "#223b37", "#29314c"][seed % 4];
  const accent = ["#f27240", "#e1a42d", "#a5b964", "#ec8264"][Math.floor(seed / 7) % 4];
  const style = { "--card-ink": ink, "--card-accent": accent, "--card-paper": "#fff6e4" } as CSSProperties;
  return (
    <div className={`${styles.card} ${compact ? styles.compact : ""}`} style={style}>
      <div className={styles.cardInner}>
        <div className={styles.cardTop}><span>MEMECATCH</span><span>NO. {String(card.cardNo).padStart(4, "0")}</span></div>
        <svg viewBox="0 0 240 220" className={styles.art} aria-hidden="true" focusable="false" data-motif={card.artMotif}>
          <defs><pattern id={`pattern-${card.id}-${compact ? "s" : "l"}`} width={17 + seed % 12} height={17 + seed % 12} patternUnits="userSpaceOnUse" patternTransform={`rotate(${seed % 60})`}><path d="M0 0h8" stroke="var(--card-ink)" opacity=".12"/></pattern></defs>
          <rect width="240" height="220" fill={`url(#pattern-${card.id}-${compact ? "s" : "l"})`}/>
          <SemanticComposition card={card}/>
          {[0, 1, 2].map((n) => <g key={n} transform={`translate(${15 + ((seed >>> (n * 5)) % 210)} ${15 + ((seed >>> (n * 3 + 2)) % 190)}) rotate(${seed % 90})`}><path d={seed % 2 ? "M-5 0h10M0-5v10" : "m-5 0 5-5 5 5-5 5Z"} stroke="var(--card-ink)" strokeWidth="2" fill="none"/></g>)}
        </svg>
        <div className={styles.cardType}>{card.category} <span>MEME ARCHIVE</span></div>
        <h3 className={styles.cardTitle}>{card.title}</h3>
        <p className={styles.cardSummary}>{card.summary}</p>
        <div className={styles.cardBottom}><span>ORIGINAL CARD ART</span><span>EDITION {String(card.edition).padStart(2, "0")}</span></div>
      </div>
    </div>
  );
}

function SemanticComposition({ card }: { card: MemeCollectibleCard }) {
  const seed = card.artSeed >>> 0;
  const composition = card.artComposition;
  const symbols = card.artSymbols;
  const positions = {
    orbit: [[11, 8], [174, 18], [175, 163]], rise: [[17, 158], [99, 75], [185, 10]],
    split: [[15, 25], [181, 93], [177, 164]], burst: [[9, 14], [182, 14], [94, 178]],
    rhythm: [[17, 164], [95, 163], [175, 164]], stack: [[23, 5], [100, 5], [177, 5]],
    frame: [[5, 5], [189, 5], [189, 171]], exchange: [[5, 25], [183, 32], [183, 135]],
  }[composition];
  const transform = {
    orbit: "translate(27 31) scale(.75)", rise: "translate(-8 24) scale(.73) rotate(-9 120 110)",
    split: "translate(-20 37) scale(.77)", burst: "translate(21 15) scale(.83)",
    rhythm: "translate(17 -5) scale(.82)", stack: "translate(24 59) scale(.78)",
    frame: "translate(28 31) scale(.76)", exchange: "translate(-8 20) scale(.77)",
  }[composition];
  const sceneSubjects: Record<MemeCardArtMotif, string[]> = {
    "pen-pineapple": ["pen", "apple", "pineapple"], dance: ["footsteps"], gaming: ["controller"],
    reaction: ["face", "smile"], office: ["briefcase", "desk"], food: ["cup", "cake"],
    animal: ["cat", "penguin", "shark"], sport: ["heart"], music: ["music-note"],
    chat: ["speech"], choice: ["fork-path", "path"], technology: ["chip", "screen"],
    celebration: ["hands", "confetti"], fashion: ["hanger"], travel: ["plane"], study: ["book"],
  };
  // A contextual object becomes the main subject, not just a badge on a generic scene.
  const focusedSymbol = !sceneSubjects[card.artMotif].includes(symbols[0]);
  const phrase = card.title.replace(/\([^)]*\)/g, "").trim();
  return <g data-composition={composition}>
    {composition === "split" && <path d="M166 7v207" stroke="var(--card-ink)" strokeWidth="2" strokeDasharray="4 6"/>}
    {composition === "orbit" && <ellipse cx="121" cy="110" rx="108" ry="83" transform="rotate(-20 120 110)" fill="none" stroke="var(--card-accent)" strokeWidth="3"/>}
    {composition === "rise" && <path d="m25 188 89-52 25-34 78-54m-19 0h19v21" fill="none" stroke="var(--card-accent)" strokeWidth="5"/>}
    {composition === "burst" && Array.from({ length: 10 }, (_, n) => <path key={n} d="M120 4v18" transform={`rotate(${n * 36} 120 110)`} stroke="var(--card-accent)" strokeWidth={2 + seed % 3}/>)}
    {composition === "rhythm" && <path d={`M5 ${154 + seed % 10}q35-32 70 0t70 0 90 0`} fill="none" stroke="var(--card-accent)" strokeWidth="5"/>}
    {composition === "stack" && <path d="M16 55h208M16 198h208" stroke="var(--card-ink)" strokeWidth="3"/>}
    {composition === "frame" && <rect x="14" y="14" width="211" height="190" rx={seed % 3 ? 28 : 5} fill="none" stroke="var(--card-accent)" strokeWidth="5"/>}
    {composition === "exchange" && <path d="m132 28 38 20-38 17m38 87-38 20 38 17" fill="none" stroke="var(--card-accent)" strokeWidth="6"/>}
    <g transform={transform}>
      {focusedSymbol ? <g transform="translate(32 15) scale(5.2)"><MemeCollectibleSymbol symbol={symbols[0]}/></g> : card.artMotif === "reaction" && symbols.includes("smile") ? <><g transform="translate(32 13) scale(5.2)"><MemeCollectibleSymbol symbol="smile"/></g><g transform="translate(67 99) scale(1.4)"><MemeCollectibleSymbol symbol="teardrop"/></g></> : <Scene motif={card.artMotif} title={card.title} seed={seed}/>}
      {card.artMotif === "chat" && <text x="31" y="80" fill="var(--card-ink)" fontSize={phrase.length > 10 ? 13 : 17} fontWeight="850" textLength={phrase.length > 10 ? 112 : undefined} lengthAdjust="spacingAndGlyphs">{phrase.slice(0, 15)}</text>}
    </g>
    {symbols.slice(0, 3).map((symbol, n) => <g key={`${symbol}-${n}`} transform={`translate(${positions[n][0]} ${positions[n][1]}) rotate(${n === 1 ? seed % 19 - 9 : 0} 16 16) scale(${composition === "split" && n === 1 ? 1.7 : 1.3})`}><rect x="-3" y="-3" width="38" height="38" rx="6" fill="var(--card-paper)" opacity=".94"/><MemeCollectibleSymbol symbol={symbol}/></g>)}
  </g>;
}
