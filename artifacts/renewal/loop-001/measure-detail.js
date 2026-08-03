/**
 * 상세 페이지 정보 계층 계측 — 브라우저 콘솔 또는 CDP evaluate로 붙여넣어 실행한다.
 *
 * 사용법
 *   1) 390×844 뷰포트로 /memes/<short_id> 를 연다
 *   2) 변경 안내 모달을 닫는다(첫 방문 시)
 *   3) 이 파일 내용을 콘솔에 붙여넣는다
 *
 * DES-001의 완료 조건은 answerCard.top < viewport.height 다.
 * 루프 001 기준선: answerCard.top = 1344, h1.top = 1399, embed.top = 301 (높이 662)
 */
(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top + scrollY), height: Math.round(r.height) };
  };
  const byText = (tag, needle) => {
    const el = [...document.querySelectorAll(tag)].find((e) =>
      e.textContent?.includes(needle),
    );
    return el ? { top: Math.round(el.getBoundingClientRect().top + scrollY) } : null;
  };

  const result = {
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    documentHeight: document.documentElement.scrollHeight,
    representativeEmbed: box(
      'section[aria-label="대표 콘텐츠"], section[aria-label="관련 콘텐츠"]',
    ),
    answerCard: box('[aria-label="정답 카드"]'),
    h1: box("h1"),
    oneLineSummary: box("#meme-summary"),
    docStatusNote: box('[aria-labelledby="doc-status-title"]'),
    inlineSources: byText("p", "출처:"),
    lastVerifiedLine: byText("p", "검수팀 확인"),
  };

  // LOOP.md「상세 페이지 정보 계층」 — 첫 뷰포트에 뜻·신호가 들어와야 한다.
  result.firstViewportContainsMemeInfo =
    !!result.answerCard && result.answerCard.top < innerHeight;
  result.scrollViewportsToFirstMemeInfo = result.answerCard
    ? Number((result.answerCard.top / innerHeight).toFixed(2))
    : null;

  console.log(JSON.stringify(result, null, 2));
  return result;
})();
