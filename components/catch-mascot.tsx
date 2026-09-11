import { useId, type CSSProperties } from "react";

type CatchMascotProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  state?: "idle" | "discovering" | "help";
};

const SIZE_STYLES: Record<NonNullable<CatchMascotProps["size"]>, CSSProperties> = {
  sm: { "--catch-size": "9rem" } as CSSProperties,
  md: { "--catch-size": "13rem" } as CSSProperties,
  lg: { "--catch-size": "min(20rem, 70vw)" } as CSSProperties,
};

export function CatchMascot({ className = "", size = "md", state = "idle" }: CatchMascotProps) {
  const instanceId = useId().replace(/:/g, "");
  const bodyGradientId = `catch-body-${instanceId}`;
  const highlightGradientId = `catch-highlight-${instanceId}`;
  const shadowFilterId = `catch-shadow-${instanceId}`;

  return (
    <div
      aria-hidden="true"
      data-catch-size={size}
      data-catch-state={state}
      className={`catch-mascot catch-mascot-${size} catch-mascot-${state} ${className}`.trim()}
      style={SIZE_STYLES[size]}
    >
      <div className="catch-mascot-signal catch-mascot-signal-a" />
      <div className="catch-mascot-signal catch-mascot-signal-b" />
      <svg
        aria-hidden="true"
        className="catch-mascot-art"
        focusable="false"
        viewBox="0 0 320 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={bodyGradientId} x1="72" y1="48" x2="230" y2="230" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-strong)" />
          </linearGradient>
          <linearGradient id={highlightGradientId} x1="82" y1="66" x2="150" y2="150" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.42" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter id={shadowFilterId} x="20" y="20" width="280" height="250" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="var(--accent-strong)" floodOpacity="0.18" />
          </filter>
        </defs>

        <ellipse cx="160" cy="250" rx="78" ry="12" fill="var(--accent-strong)" opacity="0.13" />
        <g className="catch-mascot-scan" aria-hidden="true">
          <path d="M228 66 273 45M238 88l51-4M241 111l43 13" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="274" cy="45" r="4" fill="var(--accent-strong)" />
          <circle cx="289" cy="84" r="4" fill="var(--accent-strong)" />
          <circle cx="284" cy="124" r="4" fill="var(--accent-strong)" />
        </g>
        <g className="catch-mascot-context" aria-hidden="true">
          <rect x="227" y="35" width="68" height="47" rx="10" fill="var(--surface)" stroke="var(--accent-strong)" strokeWidth="3" />
          <path d="M239 50h34M239 61h23" stroke="var(--accent-strong)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="282" cy="61" r="7" fill="var(--safety-green)" />
          <path d="m279 61 2 2 4-5" stroke="var(--surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="catch-mascot-bob" filter={`url(#${shadowFilterId})`}>
          <path
            d="M217 70c-17-23-43-37-72-37-51 0-92 41-92 92 0 45 32 83 75 91l-13 29 30-21c39 0 73-24 87-58"
            fill={`url(#${bodyGradientId})`}
          />
          <path
            d="M217 70c-17-23-43-37-72-37-51 0-92 41-92 92 0 45 32 83 75 91"
            stroke="var(--accent-strong)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path d="M105 64c15-14 34-22 56-22 19 0 37 6 51 18-25 1-50 11-69 29-15 14-25 32-30 51-7-12-11-27-11-42 0-13 1-24 3-34Z" fill={`url(#${highlightGradientId})`} />
          <circle className="catch-mascot-dot" cx="204" cy="76" r="13" fill="var(--surface)" />
          <circle className="catch-mascot-dot-core" cx="204" cy="76" r="7" fill="var(--accent-strong)" />
          <path d="M151 132c12 10 27 10 39 0" stroke="var(--surface)" strokeWidth="6" strokeLinecap="round" />
          <path d="M112 200 99 229l31-16" fill="var(--accent-strong)" />
          <path d="M196 196 213 221l4-31" fill="var(--accent-strong)" />
          <path d="M234 108c22 10 34 28 34 50 0 18-8 34-22 45l-13-19c6-7 9-15 9-25 0-11-5-22-14-29l6-22Z" fill="var(--accent)" opacity="0.55" />
        </g>
      </svg>
    </div>
  );
}
