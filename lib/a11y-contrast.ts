/**
 * WCAG 대비비 계산 — 디자인 토큰이 AA를 유지하는지 CI에서 지키기 위한 최소 도구.
 *
 * 왜 라이브러리를 안 쓰나: 루프 011에서 실제로 터진 결함은 "AA를 만족하는 토큰
 * (`--accent-strong`)이 이미 있는데 쓰이지 않았다"였다. 브라우저를 띄우는 전면
 * 감사가 아니라, 토큰 값과 소스의 조합만 지키면 같은 결함이 다시 들어오지 않는다.
 * 그건 순수 계산이라 의존성 없이 vitest에서 돈다.
 *
 * 전면 접근성 감사는 Chrome DevTools MCP `lighthouse_audit`이 담당한다
 * (`artifacts/renewal/loop-010/a11y-baseline.md`).
 */

export type Rgb = { r: number; g: number; b: number };

/** `#rgb` · `#rrggbb` → 0~255 채널. 형식이 아니면 null(호출부가 실패로 처리). */
export function parseHexColor(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.x 상대 휘도. */
function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 두 색의 대비비(1~21). 순서는 무관하다. */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) throw new Error(`대비를 계산할 수 없는 색: ${a} / ${b}`);
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.2 AA 하한 — 본문·작은 굵은 글씨 4.5:1, 큰 텍스트(18.66px bold+) 3:1. */
export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
