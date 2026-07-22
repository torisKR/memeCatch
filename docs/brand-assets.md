# 밈캐치 브랜드 에셋 (2026-07-22 전면 리뉴얼)

## 브랜드 콘셉트

- 포지셔닝: "뜻·유래·사용 타이밍까지 알려주는 실시간 한국 밈 사전" — 검색 + 실시간 탐색 + 디지털 아카이브.
- 시각 언어: signal / pulse / archive / live data. 딥 잉크 다크 배경 + 절제된 글래스 + 미세 그리드·그레인.
- 컬러: README·DESIGN.md의 기존 브랜드 **불꽃 오렌지**(`--accent #ff5c38`) 유지(리뉴얼 지침의 "README 우선" 조항).
  violet 팔레트는 기존 "보라 금지" 규칙과 충돌해 채택하지 않고, 라이브 데이터 상태 전용
  보조 토큰 `--signal-cyan`(라이트 `#0e7490` / 다크 `#22d3ee`)만 절제 추가.
- 다크 스킨은 `.theme-ink` 토큰 스코프(globals.css)를 layout.tsx가 body에 얹어 **전 사이트에 통일 적용**(2026-07-22 확정).

## 로고

- 방향: 2026-07-12 확정 심볼(말풍선+신호 dot+펄스)의 의미 체계를 계승한 **진화형 리파인**.
  전면 교체 대신 "밈을 포착한다"의 catch/radar 개념을 더함.
- 최종 마크 "Catch Signal v2": **C 링(레이더/캐치) + 링 갭에 잡힌 신호 dot(판정) + 말풍선 꼬리(사전)**.
  네거티브 스페이스가 알파벳 C(=Catch)를 이룬다.
- Higgsfield로 참고 콘셉트 4종을 생성한 뒤, 우하단 안(깨끗한 C 링 + dot + 꼬리)을 기준으로
  **SVG를 수작업 작성**(생성 이미지를 그대로 로고로 쓰지 않음 — 지침 §7).
- 콘셉트 생성 프롬프트(nano_banana_flash, 1:1, count 4):
  > Minimal vector logo symbol concept for MemeCatch… speech bubble, a catching radar sweep arc
  > and a signal pulse dot into one bold geometric mark, hidden C in the negative space…
  > flat monochrome black symbol on white, no text, no smiley face, no coin…
- 미채택 사유: ①안 wifi 아크 디테일이 16px에서 소실 ②안 실루엣 불안정 ③안 스윕 웨지 복잡도 과다.
- 핵심 지오메트리(viewBox 0 0 64 64):
  - 링: `M 37.4 11.7 A 21 21 0 1 0 52.9 33.8` stroke 9, round cap (갭 80°, 우상단)
  - dot: `cx 49.2, cy 20, r 5.5` / 꼬리: `M14.5 44.5 10.5 58.5 25.5 53.5Z`

### 파일

| 파일 | 용도 |
|---|---|
| `public/brand/symbol.svg` | 심볼 단독(오렌지) |
| `public/brand/symbol-mono-black.svg` / `-white.svg` | 단색 버전 |
| `public/brand/logo-h-light.svg` / `-dark.svg` | 한글 워드마크(밝은/어두운 배경) |
| `public/brand/logo-en.svg` | 영문 워드마크 |
| `public/brand/favicon.svg` | 타일형(오렌지 라운드 사각 + 크림 심볼) |
| `components/brand-mark.tsx` | 실사용 인라인 `<BrandMark/>`·`<BrandTile/>` (currentColor) |

워드마크 텍스트는 접근성·유지보수를 위해 path 변환 없이 `<text>`(Pretendard) 유지.

## Favicon / 앱 아이콘

- `app/icon.svg` — SVG 파비콘(타일형)
- `app/favicon.ico` — 16/32/48px PNG 포함 멀티사이즈 ICO(node 스크립트로 직접 조립)
- `app/apple-icon.png` — 180×180 (풀블리드, iOS가 라운딩)
- `public/icons/icon-{192,512}.png` — PWA any (라운드 타일)
- `public/icons/icon-maskable-{192,512}.png` — maskable(풀블리드 + 55% 세이프존)
- 생성: sharp(node_modules 내장)로 SVG 래스터화. 재생성:
  `public/brand/favicon.svg`·`public/icons/icon-maskable.svg` 수정 후 동일 스크립트 실행
  (docs 하단 "재생성 방법" 참조).
- 16px에서는 꼬리·갭이 뭉개지지 않도록 타일형(2색)만 사용.

## 홈 Hero 아트

- 도구: Higgsfield MCP `generate_image`, 모델 `nano_banana_flash`(요청 nano_banana_2 → 서버 매핑), 16:9 2k.
- 프롬프트(선정안): "A premium futuristic editorial 3D illustration for a Korean meme dictionary
  and discovery platform. A holographic signal radar is catching playful abstract reaction symbols,
  speech bubbles, waveform fragments and cultural data particles inside a digital archive portal.
  Obsidian graphite environment, warm flame-orange (#ff5c38) light… artwork weighted to the right
  side, generous dark negative space on the left third… no people, no faces, no text, no letters,
  no logos, no coins, no cryptocurrency symbols, no NFT imagery, no purple, no copyrighted
  characters, no watermark." (job d8af21c1)
- 후보 3종 중 선정 기준: B·C안은 이미지 내 텍스트가 렌더링되어 탈락(no-text 규칙).
  A안: 좌측 네거티브 스페이스·밈 서비스 인상·비암호화폐 인상·모바일 크롭 모두 충족.
- 원본: 2752×1536 PNG(5.8MB) → 최적화:
  - `public/brand/hero-meme-signal.webp` 1600×893, 71KB (데스크톱)
  - `public/brand/hero-meme-signal.avif` 1600×893, 38KB (`<picture>` 우선)
  - `public/brand/hero-meme-signal-mobile.webp` 828×462, 21KB (모바일 배경 레이어)
- CLS 방지: `<img width/height>` 명시. LCP: 데스크톱에서 `fetchPriority="high"`.

## 재생성 방법

1. Higgsfield MCP(`https://mcp.higgsfield.ai/mcp`)에서 위 프롬프트로 `generate_image` 호출.
2. 결과 PNG 다운로드 후:
   ```bash
   node -e "const s=require('./node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');
   (async()=>{await s('in.png').resize(1600).webp({quality:82}).toFile('public/brand/hero-meme-signal.webp');
   await s('in.png').resize(1600).avif({quality:55}).toFile('public/brand/hero-meme-signal.avif');
   await s('in.png').resize(828).webp({quality:74}).toFile('public/brand/hero-meme-signal-mobile.webp');})()"
   ```
3. 아이콘: `public/brand/favicon.svg` 수정 → sharp로 192/512/maskable/180 래스터화,
   favicon.ico는 16/32/48 PNG를 ICONDIR 헤더로 연결(git 히스토리의 생성 스크립트 참조).

## 저작권 확인

- Hero 아트·로고 콘셉트 모두 밈캐치 전용 오리지널 생성물로, 저작권 있는 밈 캐릭터·방송인·
  연예인·영화 장면·기존 로고를 포함하지 않는다. 이미지 내 텍스트·워터마크 없음.
- MCP 인증정보·토큰은 이 문서와 저장소에 기록하지 않는다.
