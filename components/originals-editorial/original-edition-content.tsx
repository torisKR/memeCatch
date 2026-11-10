"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, Download } from "lucide-react";
import {
  editorialOriginalPath,
  type EditorialOriginal,
} from "@/lib/editorial-originals";
import styles from "./original-edition.module.css";

const CARD_BUTTON = "문구 포함 카드 저장";
const CARD_BUSY = "카드 만드는 중…";
const ARTWORK_LINK = "그림만 저장";

type SaveState = "idle" | "busy" | "success" | "error";
type CopyState = "idle" | "success" | "error";

function measure(text: string, fontSize: number, context: CanvasRenderingContext2D) {
  context.font = `800 ${fontSize}px Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  return context.measureText(text).width;
}

function wrapCaption(caption: string, maxWidth: number, context: CanvasRenderingContext2D) {
  const words = caption.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next, 42, context) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function renderCaptionCard(imagePath: string, caption: string): Promise<Blob> {
  if (!/^\/images\/originals\/[a-z0-9-]+\.png$/.test(imagePath)) {
    throw new Error("editorial_image_path_invalid");
  }
  await document.fonts?.ready;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = document.createElement("img");
    element.decoding = "async";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("editorial_image_load_failed"));
    element.src = imagePath;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("editorial_canvas_unavailable");
  context.fillStyle = "#f3f2ed";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, 1080, 1080);
  const lines = wrapCaption(caption, 952, context);
  context.fillStyle = "#18181a";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.font = '800 42px Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  lines.forEach((line, index) => {
    context.fillText(line, 64, 1110 + index * 54);
  });
  context.fillStyle = "#a52b13";
  context.font = '800 24px Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  context.fillText("MEMECATCH ORIGINAL", 64, 1290);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) throw new Error("editorial_card_encode_failed");
  return blob;
}

export function OriginalEditionContent({
  edition,
  next,
  shareUrl,
}: {
  edition: EditorialOriginal;
  next: EditorialOriginal;
  shareUrl: string;
}) {
  const statusId = useId();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    const title = `${edition.title} | 밈캐치`;
    if (document.title !== title) document.title = title;
  }, [edition.title]);

  async function saveCard() {
    if (saveState === "busy") return;
    setSaveState("busy");
    try {
      const blob = await renderCaptionCard(edition.image, edition.caption);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `memecatch-${edition.slug}-meme-card.png`;
      link.hidden = true;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
      setSaveState("success");
    } catch {
      setSaveState("error");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
  }

  const saveStatus =
    saveState === "busy"
      ? "밈 카드를 만드는 중입니다…"
      : saveState === "success"
        ? "밈 카드 PNG를 저장했어요."
        : saveState === "error"
          ? "밈 카드를 만들지 못했어요. 잠시 후 다시 시도해 주세요."
          : "한국어 원문 캡션과 출처가 포함된 PNG로 저장됩니다.";

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <Link className={styles.back} href="/originals">
          <ArrowLeft aria-hidden /> 오리지널 목록
        </Link>
        <div className={styles.layout}>
          <div className={styles.artwork} lang="ko">
            <Image
              src={edition.image}
              alt={edition.imageAlt}
              width={1024}
              height={1024}
              sizes="(max-width: 800px) 100vw, 55vw"
            />
          </div>
          <article className={styles.article}>
            <p className={styles.kicker}>MEMECATCH ORIGINAL</p>
            <p className={styles.languageNote}>
              제목과 문구, 작품 이야기는 창작 당시의 한국어 원문입니다.
            </p>
            <h1 lang="ko">{edition.title}</h1>
            <p className={styles.caption} lang="ko">{edition.caption}</p>
            <p className={styles.summary} lang="ko">{edition.summary}</p>
            <div className={styles.note}>
              <strong>이럴 때 생각나요</strong>
              <p lang="ko">{edition.situation}</p>
            </div>
            <div className={styles.note}>
              <strong>다른 한 줄</strong>
              <p lang="ko">{edition.alternateCaption}</p>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={copyLink}>
                {copyState === "success" ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copyState === "success" ? "링크 복사됨" : "작품 링크 복사"}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={saveCard}
                disabled={saveState === "busy"}
                aria-describedby={statusId}
              >
                <Download aria-hidden />
                {saveState === "busy" ? CARD_BUSY : CARD_BUTTON}
              </button>
              <a className={styles.download} href={edition.image} download>
                <Download aria-hidden /> {ARTWORK_LINK}
              </a>
              <p
                id={statusId}
                className={`${styles.status} ${saveState === "error" || copyState === "error" ? styles.error : ""}`}
                role="status"
              >
                {copyState === "error" ? "링크를 복사하지 못했어요. 다시 시도해 주세요." : saveStatus}
              </p>
            </div>
            <p className={styles.credit}>밈캐치에서 직접 만든 오리지널 일러스트와 문구입니다.</p>
          </article>
        </div>
        <Link className={styles.next} href={editorialOriginalPath(next.slug)}>
          <span>다음 오리지널</span>
          <strong lang="ko">{next.title}</strong>
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </main>
  );
}
