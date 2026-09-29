import { useId } from "react";

import type { SafetyLevel } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SPEECH_LOOP_PATH = "M343 95H570c42 0 70 31 65 70l-15 92c-5 33-32 56-66 56h-18l8 52-64-51H341c-42 0-70-33-63-74l16-93c6-31 24-52 49-52Zm42 55c-14 0-23 10-25 24l-11 64c-3 17 8 30 25 30h139c16 0 28-10 31-25l11-65c3-16-8-28-24-28H385Z";

export function HomeSceneFallback({
  className,
  selectedSignal = "green",
}: {
  className?: string;
  selectedSignal?: SafetyLevel;
}) {
  const id = useId().replaceAll(":", "");
  const studioGlow = `${id}-studio-glow`;
  const enamel = `${id}-enamel`;
  const enamelDepth = `${id}-enamel-depth`;
  const enamelHighlight = `${id}-enamel-highlight`;
  const chrome = `${id}-chrome`;
  const ivory = `${id}-ivory`;
  const ivoryShade = `${id}-ivory-shade`;
  const tokenGlass = `${id}-token-glass`;
  const castShadow = `${id}-cast-shadow`;
  const objectShadow = `${id}-object-shadow`;

  const tokenStroke = (level: SafetyLevel) => (
    selectedSignal === level ? "#ff8356" : "#777d82"
  );
  const tokenWidth = (level: SafetyLevel) => (
    selectedSignal === level ? 6 : 2.5
  );
  const tokenOpacity = (level: SafetyLevel) => (
    selectedSignal === level ? 1 : 0.72
  );

  return (
    <svg
      aria-hidden="true"
      className={cn("block size-full", className)}
      data-home-scene-fallback="true"
      data-selected-signal={selectedSignal}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 900 450"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={studioGlow} cx="50%" cy="49%" r="56%">
          <stop offset="0" stopColor="#6d7376" stopOpacity="0.34" />
          <stop offset="0.52" stopColor="#33373a" stopOpacity="0.15" />
          <stop offset="1" stopColor="#111314" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          data-paint="orange-enamel"
          id={enamel}
          x1="0.06"
          x2="0.92"
          y1="0"
          y2="1"
        >
          <stop offset="0" stopColor="#ffb07b" />
          <stop offset="0.18" stopColor="#ff814d" />
          <stop offset="0.58" stopColor="#f15827" />
          <stop offset="1" stopColor="#b92d14" />
        </linearGradient>
        <linearGradient id={enamelDepth} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#d6421e" />
          <stop offset="0.55" stopColor="#9d2713" />
          <stop offset="1" stopColor="#5f170f" />
        </linearGradient>
        <linearGradient id={enamelHighlight} x1="0" x2="1" y1="0" y2="0.9">
          <stop offset="0" stopColor="#fff1df" stopOpacity="0.92" />
          <stop offset="0.34" stopColor="#ffd1af" stopOpacity="0.42" />
          <stop offset="1" stopColor="#ff9b6b" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          data-paint="chrome"
          id={chrome}
          x1="0"
          x2="1"
          y1="0.12"
          y2="0.88"
        >
          <stop offset="0" stopColor="#5e6469" />
          <stop offset="0.18" stopColor="#f8fbfc" />
          <stop offset="0.36" stopColor="#92999e" />
          <stop offset="0.59" stopColor="#ffffff" />
          <stop offset="0.82" stopColor="#7c8388" />
          <stop offset="1" stopColor="#34383b" />
        </linearGradient>
        <linearGradient
          data-paint="ivory"
          id={ivory}
          x1="0.08"
          x2="0.92"
          y1="0"
          y2="1"
        >
          <stop offset="0" stopColor="#fffef7" />
          <stop offset="0.58" stopColor="#eee9dc" />
          <stop offset="1" stopColor="#c8c1b3" />
        </linearGradient>
        <linearGradient id={ivoryShade} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#dad5ca" />
          <stop offset="1" stopColor="#98958e" />
        </linearGradient>
        <radialGradient id={tokenGlass} cx="34%" cy="24%" r="78%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.3" stopColor="#e5e9eb" stopOpacity="0.48" />
          <stop offset="1" stopColor="#3c4145" stopOpacity="0.12" />
        </radialGradient>
        <filter id={castShadow} x="-35%" y="-45%" width="180%" height="220%">
          <feDropShadow dx="0" dy="22" floodColor="#030405" floodOpacity="0.52" stdDeviation="19" />
        </filter>
        <filter id={objectShadow} x="-35%" y="-45%" width="180%" height="220%">
          <feDropShadow dx="5" dy="10" floodColor="#050607" floodOpacity="0.42" stdDeviation="8" />
        </filter>
      </defs>

      <ellipse cx="450" cy="225" fill={`url(#${studioGlow})`} rx="390" ry="215" />
      <ellipse
        cx="455"
        cy="372"
        fill="#050607"
        filter={`url(#${castShadow})`}
        opacity="0.32"
        rx="266"
        ry="26"
      />

      <g
        data-editorial-card="left"
        filter={`url(#${objectShadow})`}
        transform="translate(155 118) rotate(-11 154 96)"
      >
        <rect fill={`url(#${ivoryShade})`} height="188" rx="23" width="308" x="11" y="13" />
        <rect fill={`url(#${chrome})`} height="188" rx="23" width="308" />
        <rect fill={`url(#${ivory})`} height="174" rx="17" width="294" x="7" y="7" />
        <path d="M28 34H206" opacity="0.34" stroke="#303437" strokeLinecap="round" strokeWidth="8" />
        <path d="M28 60H252" opacity="0.14" stroke="#303437" strokeLinecap="round" strokeWidth="5" />
        <path d="M28 78H177" opacity="0.12" stroke="#303437" strokeLinecap="round" strokeWidth="5" />
        <circle cx="258" cy="135" fill="#d65028" r="24" />
        <circle cx="258" cy="135" fill="none" opacity="0.52" r="17" stroke="#fff7e9" strokeWidth="2" />
        <path d="M250 135h16M258 127v16" opacity="0.82" stroke="#fff7e9" strokeLinecap="round" strokeWidth="2" />
      </g>

      <g
        data-editorial-card="right"
        filter={`url(#${objectShadow})`}
        transform="translate(470 94) rotate(9 142 105)"
      >
        <rect fill={`url(#${ivoryShade})`} height="205" rx="24" width="284" x="12" y="14" />
        <rect fill={`url(#${chrome})`} height="205" rx="24" width="284" />
        <rect fill={`url(#${ivory})`} height="191" rx="18" width="270" x="7" y="7" />
        <circle cx="47" cy="49" fill="#24282a" r="15" />
        <path d="M76 43H242" opacity="0.28" stroke="#303437" strokeLinecap="round" strokeWidth="7" />
        <path d="M76 62H207" opacity="0.13" stroke="#303437" strokeLinecap="round" strokeWidth="5" />
        <path d="M32 112H244" opacity="0.15" stroke="#303437" strokeLinecap="round" strokeWidth="6" />
        <path d="M32 136H194" opacity="0.11" stroke="#303437" strokeLinecap="round" strokeWidth="6" />
        <path d="M32 160H220" opacity="0.09" stroke="#303437" strokeLinecap="round" strokeWidth="6" />
      </g>

      <g data-studio-emblem="speech-loop" transform="rotate(-7 450 225) skewX(-5)">
        <path
          d={SPEECH_LOOP_PATH}
          fill={`url(#${enamelDepth})`}
          fillRule="evenodd"
          opacity="0.98"
          transform="translate(18 18)"
        />
        <path
          d={SPEECH_LOOP_PATH}
          fill={`url(#${enamel})`}
          fillRule="evenodd"
          filter={`url(#${objectShadow})`}
          stroke="#ff9a66"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <path
          d="M342 112H568c29 0 48 20 45 47"
          fill="none"
          opacity="0.88"
          stroke={`url(#${enamelHighlight})`}
          strokeLinecap="round"
          strokeWidth="12"
        />
        <path
          d="M385 150h146c16 0 27 12 24 28l-11 65c-3 15-15 25-31 25H374c-17 0-28-13-25-30l11-64c2-14 11-24 25-24Z"
          fill="none"
          opacity="0.62"
          stroke={`url(#${chrome})`}
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <path
          d="m490 321 45 35-7-43"
          fill="none"
          opacity="0.46"
          stroke="#5f170f"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
        />
      </g>

      <g
        data-selected={selectedSignal === "green" ? "true" : "false"}
        data-signal-level="green"
        data-signal-token="safe"
        filter={`url(#${objectShadow})`}
        opacity={tokenOpacity("green")}
        transform="translate(680 96)"
      >
        <circle fill={`url(#${chrome})`} r="40" />
        <circle fill="#1b1e20" r="33" stroke={tokenStroke("green")} strokeWidth={tokenWidth("green")} />
        <circle fill="#68bd88" r="25" />
        <circle fill={`url(#${tokenGlass})`} opacity="0.56" r="25" />
        <path d="m-11 0 8 8 15-18" data-signal-glyph="check" fill="none" stroke="#f9fbf8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
      </g>

      <g
        data-selected={selectedSignal === "yellow" ? "true" : "false"}
        data-signal-level="yellow"
        data-signal-token="context"
        filter={`url(#${objectShadow})`}
        opacity={tokenOpacity("yellow")}
        transform="translate(680 300)"
      >
        <circle fill={`url(#${chrome})`} r="40" />
        <circle fill="#1b1e20" r="33" stroke={tokenStroke("yellow")} strokeWidth={tokenWidth("yellow")} />
        <circle fill="#dcae42" r="25" />
        <circle fill={`url(#${tokenGlass})`} opacity="0.52" r="25" />
        <path d="M-12-9H8c6 0 10 4 10 10v3c0 6-4 10-10 10H2l-9 7 2-7h-7c-6 0-10-4-10-10V1c0-6 4-10 10-10Zm7 6v7m0 5v1" data-signal-glyph="context" fill="none" stroke="#fffdf8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4" />
      </g>

      <g
        data-selected={selectedSignal === "gray" ? "true" : "false"}
        data-signal-level="gray"
        data-signal-token="late"
        filter={`url(#${objectShadow})`}
        opacity={tokenOpacity("gray")}
        transform="translate(220 320)"
      >
        <circle fill={`url(#${chrome})`} r="40" />
        <circle fill="#1b1e20" r="33" stroke={tokenStroke("gray")} strokeWidth={tokenWidth("gray")} />
        <circle fill="#858d93" r="25" />
        <circle fill={`url(#${tokenGlass})`} opacity="0.5" r="25" />
        <path d="M0-15A15 15 0 1 1 0 15 15 15 0 0 1 0-15Zm0 6v10l7 5" data-signal-glyph="clock" fill="none" stroke="#fcfdfd" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.8" />
      </g>

      <g
        data-selected={selectedSignal === "red" ? "true" : "false"}
        data-signal-level="red"
        data-signal-token="risk"
        filter={`url(#${objectShadow})`}
        opacity={tokenOpacity("red")}
        transform="translate(220 115)"
      >
        <circle fill={`url(#${chrome})`} r="40" />
        <circle fill="#1b1e20" r="33" stroke={tokenStroke("red")} strokeWidth={tokenWidth("red")} />
        <path d="m-10-20 20 0 15 15v10L10 20h-20L-25 5V-5l15-15Z" fill="#d85d45" />
        <path d="M-13 0h26" data-signal-glyph="stop" fill="none" stroke="#fff9f6" strokeLinecap="round" strokeWidth="4.5" />
        <path d="M-15-15c6-7 18-8 26-3" fill="none" opacity="0.42" stroke="#fff" strokeLinecap="round" strokeWidth="3" />
      </g>
    </svg>
  );
}
