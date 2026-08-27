export const IMAGE_PRESETS = {
  square: { label: "정사각형 1080", width: 1080, height: 1080 },
  vertical: { label: "세로 1080 × 1920", width: 1080, height: 1920 },
  landscape: { label: "가로 1200 × 630", width: 1200, height: 630 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export function sanitizeStudioText(value: string) {
  return value.replace(/[\u2013\u2014]/g, "-");
}

type CaptionOptions = {
  topText: string;
  bottomText: string;
  attribution?: string;
};

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  maxLines: number,
  fromBottom = false,
) {
  const sanitized = sanitizeStudioText(text);
  if (!sanitized.trim()) return;
  const words = sanitized.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1]}…`;
  const lineHeight = Number.parseInt(context.font, 10) * 1.16;
  visible.forEach((value, index) => {
    const y = fromBottom
      ? startY - (visible.length - 1 - index) * lineHeight
      : startY + index * lineHeight;
    context.strokeText(value, centerX, y);
    context.fillText(value, centerX, y);
  });
}

function fitCaptionFont(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
) {
  let size = Math.round(Math.min(width, height) * 0.09);
  const minimum = Math.round(Math.min(width, height) * 0.045);
  while (size > minimum) {
    context.font = `900 ${size}px Arial, sans-serif`;
    if (context.measureText(text).width <= width * 1.8) break;
    size -= 4;
  }
  context.font = `900 ${size}px Arial, sans-serif`;
  context.lineWidth = Math.max(6, Math.round(size * 0.12));
}

export function renderImageArtifact(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  preset: ImagePreset,
  options: CaptionOptions,
) {
  const { width, height } = IMAGE_PRESETS[preset];
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  canvas.width = width;
  canvas.height = height;

  const sourceWidth = "videoWidth" in image ? image.videoWidth : "naturalWidth" in image ? image.naturalWidth : width;
  const sourceHeight = "videoHeight" in image ? image.videoHeight : "naturalHeight" in image ? image.naturalHeight : height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,.68)");
  gradient.addColorStop(0.28, "rgba(0,0,0,0)");
  gradient.addColorStop(0.72, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,.72)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = "#fff";
  context.strokeStyle = "#050505";
  context.lineJoin = "round";
  fitCaptionFont(context, `${options.topText} ${options.bottomText}`, width, height);
  drawWrappedText(context, options.topText, width / 2, height * 0.055, width * 0.9, 3);
  context.textBaseline = "bottom";
  drawWrappedText(context, options.bottomText, width / 2, height * 0.91, width * 0.9, 3, true);

  context.textAlign = "left";
  context.textBaseline = "bottom";
  context.font = `700 ${Math.max(20, Math.round(width * 0.022))}px Arial, sans-serif`;
  context.lineWidth = 4;
  const footer = options.attribution?.trim() ? `출처: ${sanitizeStudioText(options.attribution.trim())}  ·  밈캐치` : "밈캐치";
  context.strokeText(footer, width * 0.035, height * 0.975);
  context.fillText(footer, width * 0.035, height * 0.975);
}

export function renderDictionaryCard(
  canvas: HTMLCanvasElement,
  preset: ImagePreset,
  input: { name: string; summary: string; safety: string; detailUrl: string; source: string },
) {
  const { width, height } = IMAGE_PRESETS[preset];
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  canvas.width = width;
  canvas.height = height;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#241612");
  gradient.addColorStop(0.55, "#6a2b1d");
  gradient.addColorStop(1, "#d63c1b");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,.1)";
  context.fillRect(width * 0.055, height * 0.07, width * 0.89, height * 0.86);
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#ffb19c";
  context.font = `800 ${Math.round(width * 0.035)}px Arial, sans-serif`;
  context.fillText("밈 사전", width * 0.09, height * 0.12);
  context.fillStyle = "#fff";
  context.strokeStyle = "rgba(0,0,0,.55)";
  context.lineJoin = "round";
  context.textAlign = "center";
  context.font = `900 ${Math.round(width * 0.075)}px Arial, sans-serif`;
  context.lineWidth = 6;
  drawWrappedText(context, input.name, width * 0.5, height * 0.23, width * 0.8, 2);
  context.textAlign = "center";
  context.font = `700 ${Math.round(width * 0.035)}px Arial, sans-serif`;
  context.lineWidth = 4;
  drawWrappedText(context, input.summary, width * 0.5, height * 0.43, width * 0.75, 4);
  context.fillStyle = "#ffb19c";
  context.font = `800 ${Math.round(width * 0.028)}px Arial, sans-serif`;
  context.fillText(`사용 안전: ${sanitizeStudioText(input.safety || "검수 필요")}`, width * 0.5, height * 0.72);
  context.fillStyle = "#fff";
  context.font = `600 ${Math.round(width * 0.021)}px Arial, sans-serif`;
  context.fillText(sanitizeStudioText(input.detailUrl), width * 0.5, height * 0.79);
  context.fillText(input.source ? `출처: ${sanitizeStudioText(input.source)}` : "출처: 밈캐치 편집 데이터", width * 0.5, height * 0.84);
  context.font = `900 ${Math.round(width * 0.028)}px Arial, sans-serif`;
  context.fillText("밈캐치", width * 0.5, height * 0.9);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
