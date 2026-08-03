import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_NORMAL_TEXT, contrastRatio, parseHexColor } from "./a11y-contrast";

const ROOT = resolve(__dirname, "..");

/**
 * globals.css의 `--토큰: #hex;` 선언을 **전부** 모은다.
 *
 * 같은 토큰이 라이트/다크 블록에 각각 선언되므로 값을 덮어쓰면 안 된다.
 * (마지막 값만 보관하던 초기 구현은 다크 값이 라이트의 결함을 가려서, 일부러
 * 라이트 값을 깨뜨려도 검사가 통과했다. 선언마다 검사해야 구멍이 없다.)
 */
function cssTokenValues(name: string): string[] {
  const css = readFileSync(resolve(ROOT, "app/globals.css"), "utf8");
  const re = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`, "g");
  return [...css.matchAll(re)].map((m) => m[1]);
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(rel, acc);
    else if (
      [".tsx", ".ts"].includes(extname(entry.name)) &&
      !entry.name.includes(".test.")
    )
      acc.push(rel);
  }
  return acc;
}

describe("contrastRatio", () => {
  it("WCAG 기준 알려진 값을 재현한다", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // 순서를 바꿔도 같은 값이어야 한다.
    expect(contrastRatio("#d63c1b", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#d63c1b"),
      10
    );
  });

  it("3자리 hex와 # 생략을 모두 받는다", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor("000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor("nope")).toBeNull();
  });
});

describe("디자인 토큰 대비 (A11Y-002 회귀 가드)", () => {
  it("--accent-strong의 모든 선언이 흰 글자 기준 AA를 만족한다", () => {
    // 흰 글자 CTA 배경 전용 토큰. 이 값이 밝아지면 루프 011에서 고친 결함이 되돌아온다.
    // 라이트·다크 선언을 각각 검사한다 — 한쪽만 깨져도 잡혀야 한다.
    const values = cssTokenValues("--accent-strong");
    expect(values.length, "--accent-strong가 globals.css에 없다").toBeGreaterThan(0);
    for (const value of values) {
      expect(
        contrastRatio(value, "#ffffff"),
        `--accent-strong: ${value} 는 흰 글자 대비 ${AA_NORMAL_TEXT}:1 미만`
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });
});

describe("소스 안티패턴 (A11Y-002 회귀 가드)", () => {
  it("작은 흰 글자를 --accent 배경 위에 올리지 않는다", () => {
    // 브랜드 --accent는 white 대비 4.5:1을 넘지 못한다(측정 2.82:1).
    // 흰 글자 CTA에는 --accent-strong을 써야 한다.
    const offenders = sourceFiles("app")
      .concat(sourceFiles("components"))
      .flatMap((file) => {
        const lines = readFileSync(resolve(ROOT, file), "utf8").split("\n");
        return lines.flatMap((line, i) =>
          /\bbg-accent\s/.test(line) && /\btext-white\b/.test(line)
            ? [`${file}:${i + 1}`]
            : []
        );
      });

    expect(offenders, "bg-accent-strong으로 바꾸세요").toEqual([]);
  });
});
