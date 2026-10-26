"use client";

import { track } from "@/lib/analytics";
import { SITE_URL } from "@/lib/site";
import type { QuizMode, QuizQuestion } from "@/lib/quiz";

export interface QuizCardData {
  score: number;
  total: number;
  grade: { label: string; comment: string };
  era: string | null;
  mode: QuizMode;
  questions: QuizQuestion[];
  answers: number[];
}

/**
 * 둥근 사각형 그리기 헬퍼 (표준 arcTo 사용으로 런타임 호환성 및 타입 안전성 보장)
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 1080 x 1920 (9:16 인스타 스토리 및 모바일 최적화 규격)
 * 고해상도 밈력고사 성적표 캔버스 렌더링
 */
export async function renderQuizCardCanvas(data: QuizCardData): Promise<HTMLCanvasElement> {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // 폰트 로드 실패 시 시스템 기본 폰트로 안전 폴백
    }
  }

  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  // 1. 다크 잉크 배경 (#0f0f13)
  ctx.fillStyle = "#0f0f13";
  ctx.fillRect(0, 0, width, height);

  // 2. 상단 우측 불꽃 오렌지 글로우 (Accent Glow)
  const orangeGlow = ctx.createRadialGradient(900, 320, 10, 900, 320, 650);
  orangeGlow.addColorStop(0, "rgba(255, 92, 56, 0.28)");
  orangeGlow.addColorStop(0.5, "rgba(255, 92, 56, 0.08)");
  orangeGlow.addColorStop(1, "rgba(255, 92, 56, 0)");
  ctx.fillStyle = orangeGlow;
  ctx.fillRect(0, 0, width, height);

  // 3. 하단 좌측 시그널 시안 글로우 (Signal Glow)
  const cyanGlow = ctx.createRadialGradient(180, 1600, 10, 180, 1600, 580);
  cyanGlow.addColorStop(0, "rgba(34, 211, 238, 0.22)");
  cyanGlow.addColorStop(0.5, "rgba(34, 211, 238, 0.06)");
  cyanGlow.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = cyanGlow;
  ctx.fillRect(0, 0, width, height);

  // 4. 브랜드 배지 (x: 80, y: 100)
  drawRoundedRect(ctx, 80, 100, 280, 60, 30);
  ctx.fillStyle = "#1c1c24";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ff5c38";
  ctx.stroke();

  // 펄스 도트
  ctx.beginPath();
  ctx.arc(112, 130, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#ff5c38";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 24px Pretendard, -apple-system, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("MEMECATCH 밈캐치", 132, 130);

  // 메인 타이틀
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 50px Pretendard, -apple-system, sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillText("2026 밈력 모의고사 성적표", 80, 225);

  const modeText =
    data.mode === "now"
      ? "모드: 요즘 밈 (2020년 이후 최신)"
      : data.mode === "retro"
      ? "모드: 추억 밈 (2009년 이전 그 시절)"
      : "모드: 전체 (1990년대 ~ 2026년)";

  ctx.fillStyle = "#ff6b47";
  ctx.font = '600 26px Pretendard, -apple-system, sans-serif';
  ctx.fillText(`공식 인증서 · ${modeText}`, 80, 275);

  // 5. 메인 성적표 카드 (x: 80, y: 320, w: 920, h: 1200)
  const cardX = 80;
  const cardY = 320;
  const cardW = 920;
  const cardH = 1200;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fillStyle = "#181820";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2d2d38";
  ctx.stroke();

  // 우상단 VERIFIED 패스 스탬프
  const stampX = cardX + cardW - 120;
  const stampY = cardY + 110;
  ctx.save();
  ctx.translate(stampX, stampY);
  ctx.rotate(-0.08);
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ff5c38";
  ctx.stroke();

  ctx.fillStyle = "#ff5c38";
  ctx.font = 'bold 18px Pretendard, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VERIFIED", 0, -10);
  ctx.fillText("PASS", 0, 14);
  ctx.restore();

  // 등급 라벨 필 (Badge)
  drawRoundedRect(ctx, cardX + 50, cardY + 60, 320, 68, 34);
  ctx.fillStyle = "#331c17";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ff5c38";
  ctx.stroke();

  ctx.fillStyle = "#ff6b47";
  ctx.font = 'bold 30px Pretendard, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`🔥 ${data.grade.label}`, cardX + 75, cardY + 95);

  // 거대 점수 표시 (Score)
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#22d3ee";
  ctx.font = '800 130px Pretendard, sans-serif';
  ctx.fillText(String(data.score), cardX + 50, cardY + 280);

  const scoreNumWidth = ctx.measureText(String(data.score)).width;

  ctx.fillStyle = "#71717a";
  ctx.font = 'bold 50px Pretendard, sans-serif';
  ctx.fillText(` / ${data.total}`, cardX + 50 + scoreNumWidth + 15, cardY + 280);

  // 10개 프로그레스 바 (채점 인디케이터)
  const barY = cardY + 330;
  const barWidth = 72;
  const barGap = 12;
  const barHeight = 14;

  for (let i = 0; i < data.total; i++) {
    const isCorrect = i < data.answers.length && data.answers[i] === data.questions[i]?.answerIndex;
    const bx = cardX + 50 + i * (barWidth + barGap);
    drawRoundedRect(ctx, bx, barY, barWidth, barHeight, 7);
    ctx.fillStyle = isCorrect ? "#22d3ee" : "#343442";
    ctx.fill();
  }

  // 등급 코멘트 박스
  const commentY = cardY + 380;
  const commentH = 130;
  drawRoundedRect(ctx, cardX + 50, commentY, cardW - 100, commentH, 24);
  ctx.fillStyle = "#22222c";
  ctx.fill();

  ctx.fillStyle = "#f4f4f5";
  ctx.font = 'bold 28px Pretendard, sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const comment = `"${data.grade.comment}"`;
  ctx.fillText(comment, cardX + 80, commentY + commentH / 2);

  // 밈 감성 연대
  const eraY = cardY + 560;
  ctx.fillStyle = "#a1a1aa";
  ctx.font = '600 28px Pretendard, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("당신의 밈 감성 연대:", cardX + 50, eraY);

  const eraText = data.era ? `${data.era} 🕶️` : "전 연대 통달 ⚡";
  drawRoundedRect(ctx, cardX + 320, eraY - 26, 260, 52, 16);
  ctx.fillStyle = "#2c2214";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#ff9d2e";
  ctx.stroke();

  ctx.fillStyle = "#ff9d2e";
  ctx.font = 'bold 26px Pretendard, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(eraText, cardX + 450, eraY);

  // 구분선
  ctx.beginPath();
  ctx.moveTo(cardX + 50, cardY + 640);
  ctx.lineTo(cardX + cardW - 50, cardY + 640);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#2d2d38";
  ctx.stroke();

  // 맞힌 대표 밈 리스트
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 28px Pretendard, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("맞힌 대표 밈 리스트", cardX + 50, cardY + 685);

  const correctMemes = data.questions
    .filter((q, i) => data.answers[i] === q.answerIndex)
    .slice(0, 6);

  const listStartY = cardY + 725;
  const colWidth = (cardW - 100 - 20) / 2;

  for (let idx = 0; idx < Math.min(correctMemes.length, 6); idx++) {
    const q = correctMemes[idx];
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const mx = cardX + 50 + col * (colWidth + 20);
    const my = listStartY + row * 74;

    drawRoundedRect(ctx, mx, my, colWidth, 58, 16);
    ctx.fillStyle = "#1f1f28";
    ctx.fill();

    const titleText = q.meme.title.length > 10 ? q.meme.title.slice(0, 9) + "…" : q.meme.title;
    const yearText = q.meme.originYear ? ` (${q.meme.originYear})` : "";

    ctx.fillStyle = "#e4e4e7";
    ctx.font = '600 24px Pretendard, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText(`✔ ${titleText}${yearText}`, mx + 20, my + 29);
  }

  // 총평 평가문
  const pct = data.total > 0 ? (data.score / data.total) * 100 : 0;
  let summaryTag = "💡 평가: 숏폼과 온라인 커뮤니티의 트렌드를 꿰뚫고 있는 얼리어답터!";
  if (pct >= 90) {
    summaryTag = "💡 평가: 디시 초창기부터 최신 숏폼까지 통달한 대한민국 1세대 인터넷 망령!";
  } else if (pct < 40) {
    summaryTag = "💡 평가: 인터넷 청정 구역 거주자! 밈캐치에서 1일 1밈 캐치해 보세요.";
  }

  ctx.fillStyle = "#ff9d2e";
  ctx.font = '600 24px Pretendard, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText(summaryTag, cardX + 50, cardY + 1040);

  // 6. 하단 바이럴 배너 (CTA)
  const ctaY = 1560;
  drawRoundedRect(ctx, 80, ctaY, 920, 180, 36);
  ctx.fillStyle = "#ff5c38";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 36px Pretendard, sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillText("나도 밈력 테스트하기 👉 catchmeme.com/quiz", 130, ctaY + 70);

  ctx.fillStyle = "#ffe8e1";
  ctx.font = '500 26px Pretendard, sans-serif';
  ctx.fillText("인스타 스토리에 공유하고 친구들의 밈력을 확인해보세요!", 130, ctaY + 125);

  // 7. 워터마크
  ctx.fillStyle = "#71717a";
  ctx.font = '500 24px Pretendard, sans-serif';
  ctx.fillText("대한민국 1위 실시간 밈 트렌드 사전 · MemeCatch", 80, 1810);

  return canvas;
}

/**
 * 성적표 이미지 다운로드 또는 모바일 네이티브 공유
 */
export async function downloadOrShareQuizCard(
  data: QuizCardData
): Promise<{ shared: boolean; downloaded: boolean }> {
  track("quiz_share", { score: data.score, mode: data.mode });

  const canvas = await renderQuizCardCanvas(data);

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Failed to create image blob"));
        return;
      }

      const filename = `밈력고사_성적표_${data.grade.label}_${data.score}점.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // 모바일 웹 셰어 API 지원 시 (인스타 스토리, 카톡, 사진 저장 등 시트 열림)
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        try {
          if (!navigator.canShare || navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `나의 밈력 성적표 (${data.score}점 / ${data.grade.label})`,
              text: `나의 밈력 ${data.score}점! 밈력고사에서 측정해보세요 👉 ${SITE_URL}/quiz`,
            });
            resolve({ shared: true, downloaded: false });
            return;
          }
        } catch {
          // 사용자가 취소한 경우 등
          resolve({ shared: false, downloaded: false });
          return;
        }
      }

      // PC 브라우저 또는 파일 공유 미지원 환경: 직접 다운로드 트리거
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      resolve({ shared: false, downloaded: true });
    }, "image/png");
  });
}
