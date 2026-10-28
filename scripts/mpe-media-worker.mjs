import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const PROCESSOR_NAME = "mpe-media-worker";
const PROCESSOR_VERSION = "1.1.0";
const BUCKET = "mpe-temporary";
const FFMPEG_TIMEOUT_MS = configuredTimeout("MPE_FFMPEG_TIMEOUT_MS", 20 * 60_000);
const FFPROBE_TIMEOUT_MS = configuredTimeout("MPE_FFPROBE_TIMEOUT_MS", 30_000);
const JOB_LEASE_HEARTBEAT_MS = 4 * 60 * 1_000;
const MAX_SCENE_OCR_FRAMES = 3;
const RENDER_PRESETS = {
  vertical: { width: 1080, height: 1920, fontSize: 68 },
  square: { width: 1080, height: 1080, fontSize: 58 },
  link: { width: 1200, height: 630, fontSize: 42 },
};
export async function prepareLicensedFontEnvironment(fontPath, fontFamily, { commandExecutor = exec } = {}) {
  if (!fontPath || !fontFamily) throw new Error("sharp_font_identity_required");
  if (typeof commandExecutor !== "function") throw new Error("invalid_font_command_executor");
  const fontMetadata = await stat(fontPath);
  const requestedExtension = extname(fontPath).toLowerCase();
  if (!fontMetadata.isFile() || fontMetadata.size <= 0 || fontMetadata.size > 80 * 1024 * 1024
      || ![".otf", ".ttf", ".ttc"].includes(requestedExtension)) throw new Error("invalid_render_font_file");
  const root = await mkdtemp(join(tmpdir(), "memecatch-fontconfig-"));
  try {
    const cacheDirectory = join(root, "cache");
    const fontsDirectory = join(root, "fonts");
    const configPath = join(root, "fonts.conf");
    await Promise.all([mkdir(cacheDirectory, { recursive: true }), mkdir(fontsDirectory, { recursive: true })]);
    const pinnedFontPath = join(fontsDirectory, `licensed-font${requestedExtension}`);
    await copyFile(fontPath, pinnedFontPath);
    const sourceHash = createHash("sha256").update(await readFile(pinnedFontPath)).digest("hex");
    const pathText = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    await writeFile(configPath,
      `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${pathText(fontsDirectory)}</dir><cachedir>${pathText(cacheDirectory)}</cachedir></fontconfig>`,
      "utf8");
    const environment = { ...process.env, FONTCONFIG_FILE: configPath, FONTCONFIG_PATH: root };
    const { stdout } = await commandExecutor(process.env.FC_MATCH_PATH || "fc-match",
      ["--format", "%{file}\n%{family}\n", fontFamily], { env: environment, encoding: "utf8",
        timeout: 30_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
    const [selectedPath, selectedFamily = ""] = stdout.trim().split(/\r?\n/u);
    if (resolve(selectedPath || "") !== resolve(pinnedFontPath)
        || !selectedFamily.split(",").map((value) => value.trim()).includes(fontFamily)) {
      throw new Error("licensed_font_selection_unverified");
    }
    return Object.freeze({ root, configPath, fontPath: pinnedFontPath, fontFamily, sourceHash });
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

export async function renderLicensedTextPng(text, options) {
  const { fontEnvironment, size, width, align = "left", color = "#ffffff", weight = "Bold" } = options;
  if (!fontEnvironment?.configPath || typeof text !== "string" || !text || text.length > 2_000
      || text.split("\n").length > 12 || !Number.isInteger(size) || size < 1 || size > 200
      || !Number.isInteger(width) || width < 1 || width > 4_096 || !["left", "center", "right"].includes(align)
      || !/^#[0-9a-f]{6}$/iu.test(color) || !/^[A-Za-z -]{1,30}$/u.test(weight)) {
    throw new Error("invalid_licensed_text_render");
  }
  const directory = await mkdtemp(join(fontEnvironment.root, "text-"));
  const outputPath = join(directory, "text.pgm");
  try {
    await exec(process.env.PANGO_VIEW_PATH || "pango-view", [
      "--backend=ft2", "--no-display", "--no-auto-dir", "--pixels", "--background=black", "--foreground=white",
      `--font=${fontEnvironment.fontFamily} ${weight} ${size}`,
      `--width=${width}`, `--align=${align}`, "--margin=0", `--output=${outputPath}`, `--text=${text}`,
    ], { env: { ...process.env, FONTCONFIG_FILE: fontEnvironment.configPath, FONTCONFIG_PATH: fontEnvironment.root },
      timeout: 30_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
    const pgm = await readFile(outputPath);
    let offset = 0;
    const token = () => {
      while (offset < pgm.length) {
        if (pgm[offset] === 35) {
          while (offset < pgm.length && pgm[offset] !== 10) offset += 1;
        } else if (pgm[offset] === 9 || pgm[offset] === 10 || pgm[offset] === 13 || pgm[offset] === 32) offset += 1;
        else break;
      }
      const start = offset;
      while (offset < pgm.length && ![9, 10, 13, 32].includes(pgm[offset])) offset += 1;
      return pgm.subarray(start, offset).toString("ascii");
    };
    if (token() !== "P5") throw new Error("licensed_text_render_invalid_mask");
    const maskWidth = Number(token());
    const maskHeight = Number(token());
    const maximum = Number(token());
    if (!Number.isInteger(maskWidth) || maskWidth <= 0 || maskWidth > 4_096
        || !Number.isInteger(maskHeight) || maskHeight <= 0 || maskHeight > 4_096 || maximum !== 255) {
      throw new Error("licensed_text_render_invalid_mask");
    }
    if (pgm[offset] === 13 && pgm[offset + 1] === 10) offset += 2;
    else if ([9, 10, 13, 32].includes(pgm[offset])) offset += 1;
    const mask = pgm.subarray(offset);
    if (mask.byteLength !== maskWidth * maskHeight) {
      throw new Error("licensed_text_render_invalid_mask");
    }
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const rgba = Buffer.alloc(mask.byteLength * 4);
    for (let index = 0; index < mask.byteLength; index += 1) {
      const pixel = index * 4;
      rgba[pixel] = red;
      rgba[pixel + 1] = green;
      rgba[pixel + 2] = blue;
      // The FT2 backend writes a white background and dark glyph coverage in PGM output.
      rgba[pixel + 3] = 255 - mask[index];
    }
    const { getSharp } = await import("next/dist/server/image-optimizer.js");
    const sharp = getSharp(1, false);
    return sharp(rgba, { raw: { width: maskWidth, height: maskHeight, channels: 4 } }).png().toBuffer();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function configuredTimeout(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function mediaExec(command, args, options = {}) {
  const timeout = command === "ffprobe" ? FFPROBE_TIMEOUT_MS : FFMPEG_TIMEOUT_MS;
  return exec(command, args, { ...options, timeout, killSignal: "SIGKILL" });
}

function assTime(milliseconds) {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6_000);
  const seconds = Math.floor((centiseconds % 6_000) / 100);
  const fraction = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

function assText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\r", "").replaceAll("\n", "\\N");
}

function validateRenderInput(value) {
  if (!value || typeof value !== "object" || !RENDER_PRESETS[value.preset]) throw new Error("invalid_render_preset");
  if (!Array.isArray(value.segments) || value.segments.length < 1 || value.segments.length > 100) throw new Error("invalid_render_segments");
  const segments = value.segments.map((segment) => {
    if (!segment || typeof segment !== "object") throw new Error("invalid_render_segment");
    const startMs = Number(segment.startMs);
    const endMs = Number(segment.endMs);
    const text = typeof segment.text === "string" ? segment.text.trim() : "";
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs || endMs > 21_600_000 || !text || text.length > 500) {
      throw new Error("invalid_render_segment");
    }
    return { startMs, endMs, text };
  });
  const attribution = typeof value.attribution === "string" ? value.attribution.trim() : "";
  if (!attribution || attribution.length > 500) throw new Error("invalid_render_attribution");
  const fontPath = typeof value.fontPath === "string" ? value.fontPath.trim() : "";
  const fontFamily = typeof value.fontFamily === "string" ? value.fontFamily.trim() : "";
  if (Boolean(fontPath) !== Boolean(fontFamily)) throw new Error("invalid_render_font");
  if (fontPath && (!isAbsolute(fontPath) || /[\r\n\0]/u.test(fontPath)
      || !/^[\p{L}\p{N} ._-]{1,100}$/u.test(fontFamily))) throw new Error("invalid_render_font");
  return { preset: value.preset, segments, attribution, fontPath: fontPath || null, fontFamily: fontFamily || null };
}

export function buildAssDocument(value) {
  const input = validateRenderInput(value);
  const preset = RENDER_PRESETS[input.preset];
  const fontFamily = input.fontFamily ?? "Arial";
  const captionMargin = Math.round(preset.height * 0.1);
  const footerSize = Math.max(22, Math.round(preset.fontSize * 0.48));
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${preset.width}`,
    `PlayResY: ${preset.height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,${fontFamily},${preset.fontSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H90000000,-1,0,0,0,100,100,0,0,1,4,2,2,70,70,${captionMargin},1`,
    `Style: Source,${fontFamily},${footerSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H70000000,-1,0,0,0,100,100,0,0,1,3,1,1,28,28,24,1`,
    `Style: Watermark,${fontFamily},${footerSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H70000000,-1,0,0,0,100,100,0,0,1,3,1,3,28,28,24,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...input.segments.map((segment) => `Dialogue: 0,${assTime(segment.startMs)},${assTime(segment.endMs)},Caption,,0,0,0,,${assText(segment.text)}`),
    `Dialogue: 1,0:00:00.00,6:00:00.00,Source,,0,0,0,,${assText(`출처: ${input.attribution}`)}`,
    "Dialogue: 1,0:00:00.00,6:00:00.00,Watermark,,0,0,0,,MemeCatch · 밈캐치",
    "",
  ];
  return lines.join("\n");
}

function filterPath(path) {
  return path.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

function xmlText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function captionLines(text, maxCharacters) {
  const lines = [];
  let current = "";
  for (const token of text.split(/\s+/)) {
    const next = current ? `${current} ${token}` : token;
    if (next.length <= maxCharacters || !current) current = next;
    else {
      lines.push(current);
      current = token;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function textDisplayWidth(value) {
  return [...value].reduce((width, character) => width + (/[\x00-\xff]/u.test(character) ? 0.58 : 1), 0);
}

export function layoutLicensedCaptionLines(text, { width, fontSize, maxLines = 3 }) {
  if (typeof text !== "string" || !text.trim() || !Number.isFinite(width) || width <= 0
      || !Number.isFinite(fontSize) || fontSize <= 0 || !Number.isInteger(maxLines) || maxLines < 1) {
    throw new Error("invalid_licensed_caption_layout");
  }
  const maxWidth = width / fontSize;
  const lines = [];
  for (const paragraph of text.replaceAll("\r", "").split("\n")) {
    let current = "";
    for (const token of paragraph.trim().split(/\s+/u).filter(Boolean)) {
      const candidate = current ? `${current} ${token}` : token;
      if (!current || textDisplayWidth(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      lines.push(current);
      current = token;
    }
    if (current) lines.push(current);
  }
  if (lines.length < 1 || lines.length > maxLines || lines.some((line) => textDisplayWidth(line) > maxWidth)) {
    throw new Error("licensed_caption_exceeds_safe_layout");
  }
  return lines;
}

async function alphaBounds(input, sharp) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("licensed_text_render_empty");
  return { minX, minY, maxX, maxY, width: info.width, height: info.height };
}

export async function renderOverlayPng(path, preset, options) {
  const ownsFontEnvironment = Boolean(options.fontPath && !options.fontEnvironment);
  const fontEnvironment = options.fontEnvironment
    ?? (options.fontPath ? await prepareLicensedFontEnvironment(options.fontPath, options.fontFamily) : null);
  const { getSharp } = await import("next/dist/server/image-optimizer.js");
  const sharp = getSharp(1, false);
  const footerSize = Math.max(22, Math.round(preset.fontSize * 0.48));
  const captionMargin = Math.max(72, Math.ceil(preset.fontSize * 1.1));
  const captionWidth = preset.width - (captionMargin * 2);
  const caption = options.caption && !options.fontPath
    ? captionLines(options.caption, Math.max(12, Math.floor(preset.width / (preset.fontSize * 0.58))))
    : [];
  const captionStart = preset.height - Math.round(preset.height * 0.13) - (caption.length - 1) * preset.fontSize * 1.15;
  if (options.fontPath) {
    try {
      const layers = [];
      const outlined = async (text, { left, top, bottom, region, width, size, align, outline = 4, safeMargin = 0 }) => {
        const [outlineInput, foregroundInput] = await Promise.all([
          renderLicensedTextPng(text, { fontEnvironment, size, width, align, color: "#101010" }),
          renderLicensedTextPng(text, { fontEnvironment, size, width, align, color: "#ffffff" }),
        ]);
        const bounds = await alphaBounds(foregroundInput, sharp);
        const resolvedTop = region
          ? Math.round(region.top + ((region.bottom - region.top - bounds.height) / 2))
          : (Number.isFinite(bottom) ? Math.round(bottom - bounds.height) : top);
        const actualMinX = left + bounds.minX - outline;
        const actualMaxX = left + bounds.maxX + outline;
        const actualMinY = resolvedTop + bounds.minY - outline;
        const actualMaxY = resolvedTop + bounds.maxY + outline;
        if (!Number.isInteger(resolvedTop) || actualMinX < safeMargin || actualMaxX >= preset.width - safeMargin
            || actualMinY < 0 || actualMaxY >= preset.height
            || (region && (actualMinY < region.top || actualMaxY > region.bottom))) {
          throw new Error("licensed_text_out_of_safe_bounds");
        }
        for (const [dx, dy] of [[-outline, 0], [outline, 0], [0, -outline], [0, outline]]) {
          layers.push({ input: outlineInput, left: left + dx, top: resolvedTop + dy });
        }
        layers.push({ input: foregroundInput, left, top: resolvedTop });
      };
      if (options.caption) {
        const verticalRegion = preset.width === 1080 && preset.height === 1920
          ? { top: 1590, bottom: 1800 }
          : null;
        let rendered = false;
        const minimumSize = verticalRegion ? 42 : preset.fontSize;
        for (let size = preset.fontSize; size >= minimumSize; size -= 2) {
          let licensedLines;
          try {
            licensedLines = layoutLicensedCaptionLines(options.caption, { width: captionWidth, fontSize: size });
          } catch (error) {
            if (verticalRegion && error?.message === "licensed_caption_exceeds_safe_layout") continue;
            throw error;
          }
          try {
            await outlined(licensedLines.join("\n"), {
              left: captionMargin,
              ...(verticalRegion
                ? { region: verticalRegion }
                : { bottom: preset.height - Math.round(preset.height * 0.13) }),
              width: captionWidth,
              size,
              align: "center",
              safeMargin: 64,
            });
            rendered = true;
            break;
          } catch (error) {
            if (verticalRegion && error?.message === "licensed_text_out_of_safe_bounds") continue;
            throw error;
          }
        }
        if (!rendered) throw new Error("licensed_caption_exceeds_reserved_region");
      }
      if (options.footer) {
        await outlined(`출처: ${options.footer}`, { left: 28, top: preset.height - footerSize - 28,
          width: Math.floor(preset.width * 0.6), size: footerSize, align: "left", outline: 2, safeMargin: 24 });
        await outlined("MemeCatch · 밈캐치", { left: Math.floor(preset.width * 0.55), top: preset.height - footerSize - 28,
          width: Math.floor(preset.width * 0.45) - 28, size: footerSize, align: "right", outline: 2, safeMargin: 24 });
      }
      await sharp({ create: { width: preset.width, height: preset.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(layers).png().toFile(path);
    } finally {
      if (ownsFontEnvironment) await rm(fontEnvironment.root, { recursive: true, force: true });
    }
    return;
  }
  const captionSvg = caption.map((line, index) => `<text x="${preset.width / 2}" y="${captionStart + index * preset.fontSize * 1.15}" text-anchor="middle" class="caption">${xmlText(line)}</text>`).join("");
  const footer = options.footer ? [
    `<text x="28" y="${preset.height - 24}" text-anchor="start" class="footer">${xmlText(`출처: ${options.footer}`)}</text>`,
    `<text x="${preset.width - 28}" y="${preset.height - 24}" text-anchor="end" class="footer">MemeCatch · 밈캐치</text>`,
  ].join("") : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${preset.width}" height="${preset.height}"><style>.caption{font-family:Arial,sans-serif;font-size:${preset.fontSize}px;font-weight:900;fill:white;stroke:#101010;stroke-width:8px;paint-order:stroke}.footer{font-family:Arial,sans-serif;font-size:${footerSize}px;font-weight:800;fill:white;stroke:#101010;stroke-width:5px;paint-order:stroke}</style>${captionSvg}${footer}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path);
}

async function hasAssFilter() {
  const { stdout } = await mediaExec("ffmpeg", ["-hide_banner", "-filters"]);
  return /\b(?:ass|subtitles)\s+V->V\b/.test(stdout);
}

async function renderWithPngOverlays(inputPath, outputPath, input, preset, directory) {
  const footerPath = join(directory, "footer.png");
  await renderOverlayPng(footerPath, preset, { footer: input.attribution,
    fontPath: input.fontPath, fontFamily: input.fontFamily, fontEnvironment: input.fontEnvironment });
  const captionPaths = [];
  for (const [index, segment] of input.segments.entries()) {
    const path = join(directory, `caption-${String(index).padStart(3, "0")}.png`);
    await renderOverlayPng(path, preset, { caption: segment.text,
      fontPath: input.fontPath, fontFamily: input.fontFamily, fontEnvironment: input.fontEnvironment });
    captionPaths.push(path);
  }
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath, "-loop", "1", "-i", footerPath];
  for (const path of captionPaths) args.push("-loop", "1", "-i", path);
  const filters = [
    `[0:v]scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=rgba[base]`,
    "[1:v]setsar=1,format=rgba[footerImage]",
    "[base][footerImage]overlay=0:0:format=rgb[footer]",
  ];
  let previous = "footer";
  input.segments.forEach((segment, index) => {
    const output = `caption${index}`;
    const image = `captionImage${index}`;
    filters.push(`[${index + 2}:v]setsar=1,format=rgba[${image}]`);
    filters.push(`[${previous}][${image}]overlay=0:0:format=rgb:enable='between(t,${(segment.startMs / 1_000).toFixed(3)},${(segment.endMs / 1_000).toFixed(3)})'[${output}]`);
    previous = output;
  });
  filters.push(`[${previous}]format=yuv420p[rendered]`);
  args.push(
    "-filter_complex", filters.join(";"), "-map", "[rendered]", "-map", "0:a?",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", outputPath,
  );
  await mediaExec("ffmpeg", args, { maxBuffer: 16 * 1024 * 1024 });
}

export async function renderVideoArtifact(inputPath, outputPath, value) {
  const input = validateRenderInput(value);
  const preset = RENDER_PRESETS[input.preset];
  const assPath = join(dirname(outputPath), "captions.ass");
  let fontDirectory = null;
  let fontEnvironment = null;
  let renderInput = input;
  try {
    if (input.fontPath) {
      fontEnvironment = await prepareLicensedFontEnvironment(input.fontPath, input.fontFamily);
      fontDirectory = dirname(fontEnvironment.fontPath);
      renderInput = { ...input, fontPath: fontEnvironment.fontPath, fontEnvironment };
    }
    await writeFile(assPath, buildAssDocument(renderInput), "utf8");
    const assAvailable = await hasAssFilter();
    if (assAvailable && !fontDirectory) {
    const videoFilter = [
      `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease`,
      `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black`,
      `subtitles=filename='${filterPath(assPath)}'${fontDirectory ? `:fontsdir='${filterPath(fontDirectory)}'` : ""}`,
    ].join(",");
    const { stderr = "" } = await mediaExec("ffmpeg", [
      "-hide_banner", "-loglevel", fontDirectory ? "verbose" : "error", "-y", "-i", inputPath,
      "-map", "0:v:0", "-map", "0:a?", "-vf", videoFilter,
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outputPath,
    ], { maxBuffer: 16 * 1024 * 1024 });
    if (fontDirectory) {
      const loadedFont = stderr.includes(renderInput.fontPath);
      const selectedFamily = stderr.split(/\r?\n/u).some((line) => line.includes("fontselect:") && line.includes(input.fontFamily));
      if (!loadedFont || !selectedFamily) throw new Error("licensed_font_selection_unverified");
    }
    } else {
      await renderWithPngOverlays(inputPath, outputPath, renderInput, preset, dirname(outputPath));
    }
    return { width: preset.width, height: preset.height,
      ...(fontDirectory ? {
        captionLayoutVerified: true,
        fontSelection: { verified: true, family: input.fontFamily,
          renderer: "pango-fontconfig", sha256: fontEnvironment.sourceHash },
      } : {}) };
  } finally {
    if (fontEnvironment) await rm(fontEnvironment.root, { recursive: true, force: true });
  }
}

export async function inspectMedia(path) {
  const { stdout } = await mediaExec("ffprobe", [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", path,
  ], { maxBuffer: 4 * 1024 * 1024 });
  const payload = JSON.parse(stdout);
  const streams = Array.isArray(payload.streams) ? payload.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const seconds = Number(payload.format?.duration ?? video?.duration ?? 0);
  return {
    formatName: typeof payload.format?.format_name === "string" ? payload.format.format_name : "",
    width: Number.isInteger(video?.width) ? video.width : null,
    height: Number.isInteger(video?.height) ? video.height : null,
    durationMs: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1_000)) : 0,
    hasAudio: Boolean(audio),
    videoCodec: typeof video?.codec_name === "string" ? video.codec_name : null,
    audioCodec: typeof audio?.codec_name === "string" ? audio.codec_name : null,
  };
}

export async function detectSceneTimes(path, durationMs, threshold = 0.3) {
  if (durationMs <= 0) return [0];
  const { stderr } = await mediaExec("ffmpeg", [
    "-hide_banner", "-i", path, "-vf", `select=gt(scene\\,${threshold}),showinfo`,
    "-fps_mode", "vfr", "-f", "null", "-",
  ], { maxBuffer: 16 * 1024 * 1024 });
  const values = [...stderr.matchAll(/pts_time:([0-9.]+)/g)]
    .map((match) => Math.round(Number(match[1]) * 1_000))
    .filter((ms) => Number.isFinite(ms) && ms > 0 && ms < durationMs);
  const spaced = [0];
  for (const ms of values.sort((a, b) => a - b)) {
    if (ms - spaced.at(-1) >= 500) spaced.push(ms);
    if (spaced.length === 12) break;
  }
  return spaced;
}

export function limitSceneOcrTimes(times) {
  return times.slice(0, MAX_SCENE_OCR_FRAMES);
}

async function reserveOpenRouterRequest(supabase) {
  const { error } = await supabase.rpc("reserve_openrouter_daily_request", {
    p_provider: "openrouter",
    p_model: "stealth/ox-alpha",
  });
  if (error) {
    const { classifyOpenRouterReservationError } = await import("../lib/mpe/openrouter.server.ts");
    throw new Error(classifyOpenRouterReservationError(error));
  }
}

export function perceptualHash(rawPixels) {
  if (rawPixels.length !== 64) throw new Error("phash_requires_8x8_gray");
  const average = rawPixels.reduce((sum, value) => sum + value, 0) / rawPixels.length;
  let bits = 0n;
  for (const value of rawPixels) bits = (bits << 1n) | (value >= average ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

async function frameBytes(path, frameMs, format = "mjpeg") {
  const args = ["-hide_banner", "-loglevel", "error"];
  if (frameMs > 0) args.push("-ss", (frameMs / 1_000).toFixed(3));
  args.push("-i", path, "-frames:v", "1");
  if (format === "gray") args.push("-vf", "scale=8:8,format=gray", "-f", "rawvideo", "pipe:1");
  else args.push("-q:v", "3", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1");
  const { stdout } = await mediaExec("ffmpeg", args, { encoding: "buffer", maxBuffer: 12 * 1024 * 1024 });
  return new Uint8Array(stdout);
}

export async function framePerceptualHash(path, frameMs = 0) {
  return perceptualHash(await frameBytes(path, frameMs, "gray"));
}

export async function extractAudioChunks(path, directory, chunkSeconds = 30) {
  const metadata = await inspectMedia(path);
  if (!metadata.hasAudio) return [];
  await mediaExec("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000",
    "-f", "segment", "-segment_time", String(chunkSeconds), "-c:a", "pcm_s16le", join(directory, "audio-%03d.wav"),
  ], { maxBuffer: 8 * 1024 * 1024 });
  const files = (await readdir(directory)).filter((name) => /^audio-\d+\.wav$/.test(name)).sort();
  return files.map((name, index) => ({
    path: join(directory, name),
    startMs: index * chunkSeconds * 1_000,
    endMs: Math.min(metadata.durationMs, (index + 1) * chunkSeconds * 1_000),
  }));
}

export async function normalizedAudioFingerprint(path) {
  const { stdout } = await mediaExec("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", "8000",
    "-f", "s16le", "pipe:1",
  ], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  if (stdout.length === 0) throw new Error("audio_extraction_failed");
  return createHash("sha256").update(stdout).digest("hex");
}

async function downloadOriginal(supabase, key, path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error || !data) throw new Error("source_download_failed");
  await writeFile(path, new Uint8Array(await data.arrayBuffer()));
}

async function insertSegments(supabase, ingestionId, segments) {
  if (segments.length === 0) return;
  const { error } = await supabase.from("text_segments").insert(segments.map((segment) => ({
    ingestion_id: ingestionId,
    origin: segment.origin === "ocr" ? "OCR" : "STT",
    start_ms: segment.startMs,
    end_ms: segment.endMs,
    raw_text: segment.rawText,
    normalized_text: segment.normalizedText,
    language: segment.language,
    confidence: segment.confidence,
    bounding_box_json: segment.boundingBox,
  })));
  if (error) throw new Error("segment_insert_failed");
}

async function insertFingerprint(supabase, row) {
  const { error } = await supabase.from("media_fingerprints").upsert(row, {
    onConflict: "ingestion_id,fingerprint_type,hash_value,processor_version,frame_ms",
    ignoreDuplicates: true,
  });
  if (error) throw new Error("fingerprint_insert_failed");
}

async function runJob(supabase, job, ingestion, path, directory) {
  if (job.job_type === "cleanup") {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([ingestion.temporary_storage_key]);
    if (storageError) throw new Error("storage_delete_failed");
    const { error: updateError } = await supabase.from("media_ingestions")
      .update({ deleted_at: new Date().toISOString() }).eq("id", ingestion.id);
    if (updateError) throw new Error("cleanup_record_failed");
    return { status: "completed", output: { deleted: true } };
  }
  if (job.job_type === "inspect") {
    const metadata = await inspectMedia(path);
    const { validateProbedMedia } = await import("../lib/mpe/media.ts");
    validateProbedMedia(ingestion.mime_type, metadata);
    const { error } = await supabase.from("media_ingestions").update({
      width: metadata.width, height: metadata.height, duration_ms: metadata.durationMs,
    }).eq("id", ingestion.id);
    if (error) throw new Error("ingestion_update_failed");
    return { status: "completed", output: metadata };
  }
  if (job.job_type === "fingerprint") {
    const metadata = await inspectMedia(path);
    const phash = await framePerceptualHash(path);
    await insertFingerprint(supabase, {
      ingestion_id: ingestion.id, fingerprint_type: "SHA256", hash_value: ingestion.sha256,
      frame_ms: null, processor_version: PROCESSOR_VERSION,
    });
    await insertFingerprint(supabase, {
      ingestion_id: ingestion.id, fingerprint_type: "PHASH", hash_value: phash,
      frame_ms: 0, processor_version: PROCESSOR_VERSION,
    });
    let audioFingerprint = null;
    if (metadata.hasAudio) {
      audioFingerprint = await normalizedAudioFingerprint(path);
      await insertFingerprint(supabase, {
        ingestion_id: ingestion.id, fingerprint_type: "AUDIO", hash_value: audioFingerprint,
        frame_ms: null, processor_version: PROCESSOR_VERSION,
      });
    }
    return { status: "completed", output: { sha256: ingestion.sha256, phash, audioFingerprint } };
  }
  if (job.job_type === "scene_frames") {
    if (!process.env.OPENROUTER_API_KEY?.trim()) throw new Error("provider_not_configured");
    const { recognizeImageText, getMpeVisionModel } = await import("../lib/mpe/openrouter.server.ts");
    const metadata = await inspectMedia(path);
    const times = limitSceneOcrTimes(await detectSceneTimes(path, metadata.durationMs));
    const frames = [];
    let segmentsWritten = 0;
    for (const [index, frameMs] of times.entries()) {
      const bytes = await frameBytes(path, frameMs);
      const key = `${ingestion.user_id}/${ingestion.id}/frames/${String(index).padStart(3, "0")}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(key, bytes, {
        contentType: "image/jpeg", upsert: true,
      });
      if (error) throw new Error("artifact_upload_failed");
      const phash = await framePerceptualHash(path, frameMs);
      await insertFingerprint(supabase, {
        ingestion_id: ingestion.id, fingerprint_type: "FRAME_PHASH", hash_value: phash,
        frame_ms: frameMs, processor_version: PROCESSOR_VERSION,
      });
      const segments = await recognizeImageText({
        bytes,
        mimeType: "image/jpeg",
        frameMs,
        reserveRequest: () => reserveOpenRouterRequest(supabase),
      });
      await insertSegments(supabase, ingestion.id, segments);
      segmentsWritten += segments.length;
      frames.push({ kind: index === 0 ? "representative_frame" : "scene_frame", frameMs, storageKey: key, mimeType: "image/jpeg", phash });
    }
    return { status: "completed", output: {
      provider: "openrouter", model: getMpeVisionModel(), providerBacked: true, segmentsWritten,
      artifacts: frames, representativeFrame: frames[0] ?? null,
    } };
  }
  if (job.job_type === "ocr") {
    if (!process.env.OPENROUTER_API_KEY?.trim()) throw new Error("provider_not_configured");
    const { recognizeImageText, getMpeVisionModel } = await import("../lib/mpe/openrouter.server.ts");
    const image = ingestion.mime_type === "image/gif" ? await frameBytes(path, 0) : new Uint8Array(await readFile(path));
    const segments = await recognizeImageText({
      bytes: image, mimeType: ingestion.mime_type === "image/gif" ? "image/jpeg" : ingestion.mime_type, frameMs: 0,
      reserveRequest: () => reserveOpenRouterRequest(supabase),
    });
    await insertSegments(supabase, ingestion.id, segments);
    return { status: "completed", output: {
      provider: "openrouter", model: getMpeVisionModel(), providerBacked: true, segmentsWritten: segments.length,
    } };
  }
  if (job.job_type === "stt") {
    const metadata = await inspectMedia(path);
    if (!metadata.hasAudio) return { status: "skipped", output: {
      reason: "no_audio", segmentsWritten: 0, audioDetected: false,
    } };
    const { getMpeVisionModel } = await import("../lib/mpe/openrouter.server.ts");
    return { status: "skipped", output: {
      reason: "audio_stt_disabled", provider: "openrouter", model: getMpeVisionModel(),
      providerBacked: false, segmentsWritten: 0, audioDetected: true,
    } };
  }
  if (job.job_type === "render") {
    if (ingestion.media_kind !== "video") throw new Error("render_requires_video");
    const request = validateRenderInput(job.output_json);
    const artifactKey = typeof job.output_json?.artifactKey === "string" ? job.output_json.artifactKey : "";
    const expectedPrefix = `${ingestion.user_id}/${ingestion.id}/renders/`;
    if (!artifactKey.startsWith(expectedPrefix) || !/\/[0-9a-f]{64}\.mp4$/.test(artifactKey)) throw new Error("invalid_render_artifact_key");
    const outputPath = join(directory, "render.mp4");
    const dimensions = await renderVideoArtifact(path, outputPath, request);
    const bytes = await readFile(outputPath);
    const { error } = await supabase.storage.from(BUCKET).upload(artifactKey, bytes, {
      contentType: "video/mp4", upsert: true,
    });
    if (error) throw new Error("artifact_upload_failed");
    const metadata = await inspectMedia(outputPath);
    return {
      status: "completed",
      output: {
        artifactKey,
        preset: request.preset,
        mimeType: "video/mp4",
        width: dimensions.width,
        height: dimensions.height,
        durationMs: metadata.durationMs,
        artifacts: [{ kind: "rendered_media", storageKey: artifactKey, mimeType: "video/mp4" }],
      },
    };
  }
  return { status: "skipped", output: { reason: "unsupported_job_type" } };
}

function errorCode(error) {
  const message = error instanceof Error ? error.message : "unknown_error";
  return /^[a-z0-9_:-]{1,80}$/i.test(message) ? message.slice(0, 80) : "worker_failed";
}

function completionErrorCode(error) {
  return typeof error?.message === "string" ? error.message : "unknown_completion_error";
}

function isStaleCompletionError(error) {
  const code = completionErrorCode(error);
  return code === "lease_token_mismatch" || code === "job_not_running";
}

async function auditCompletionError(supabase, jobId, error) {
  await supabase.from("admin_audit_log").insert({
    actor_id: null,
    action: "mpe_worker_completion_failed",
    entity_type: "processing_job",
    entity_id: jobId,
    detail: { error: completionErrorCode(error).slice(0, 120) },
  });
}

export function startProcessingJobHeartbeat(supabase, job, intervalMs = JOB_LEASE_HEARTBEAT_MS) {
  let stopped = false;
  let leaseLost = false;
  let inFlight = null;
  const renew = async () => {
    const { error } = await supabase.rpc("renew_processing_job_lease", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
    });
    if (error && isStaleCompletionError(error)) leaseLost = true;
  };
  const timer = setInterval(() => {
    if (stopped || leaseLost || inFlight) return;
    inFlight = renew()
      .catch(() => {})
      .finally(() => { inFlight = null; });
  }, Math.max(1, intervalMs));
  timer.unref?.();
  return {
    async stop() {
      if (!stopped) {
        stopped = true;
        clearInterval(timer);
      }
      if (inFlight) await inFlight;
      return { leaseLost };
    },
  };
}

export async function processOneJob(supabase, options = {}) {
  const { data: jobs, error: claimError } = await supabase.rpc("claim_processing_job", {
    p_processor_name: PROCESSOR_NAME,
    p_processor_version: PROCESSOR_VERSION,
    p_job_types: ["inspect", "fingerprint", "scene_frames", "ocr", "stt", "render", "cleanup"],
  });
  if (claimError) throw new Error("job_claim_failed");
  const job = jobs?.[0];
  if (!job) return false;
  if (!job.lease_token) throw new Error("job_claim_missing_lease");
  const directory = await mkdtemp(join(tmpdir(), "mpe-worker-"));
  const heartbeat = startProcessingJobHeartbeat(supabase, job, options.heartbeatIntervalMs);
  try {
    const { data: ingestion, error } = await supabase.from("media_ingestions").select("*").eq("id", job.ingestion_id).single();
    if (error || !ingestion) throw new Error("ingestion_not_found");
    const path = join(directory, "original");
    if (job.job_type !== "cleanup") await downloadOriginal(supabase, ingestion.temporary_storage_key, path);
    const result = await runJob(supabase, job, ingestion, path, directory);
    const lease = await heartbeat.stop();
    if (lease.leaseLost) return true;
    const { error: completionError } = await supabase.rpc("complete_processing_job", {
      p_job_id: job.id, p_lease_token: job.lease_token,
      p_status: result.status, p_output_json: result.output,
      p_error_code: null, p_cost_units: 0,
    });
    if (completionError) {
      if (isStaleCompletionError(completionError)) return true;
      await auditCompletionError(supabase, job.id, completionError);
      const { error: failureError } = await supabase.rpc("complete_processing_job", {
        p_job_id: job.id, p_lease_token: job.lease_token,
        p_status: "failed", p_output_json: {}, p_error_code: "job_completion_failed", p_cost_units: 0,
      });
      if (failureError && !isStaleCompletionError(failureError)) {
        await auditCompletionError(supabase, job.id, failureError);
      }
    }
  } catch (error) {
    const lease = await heartbeat.stop();
    if (lease.leaseLost) return true;
    const { error: failureError } = await supabase.rpc("complete_processing_job", {
      p_job_id: job.id, p_lease_token: job.lease_token,
      p_status: "failed", p_output_json: {}, p_error_code: errorCode(error), p_cost_units: 0,
    });
    if (failureError && !isStaleCompletionError(failureError)) {
      await auditCompletionError(supabase, job.id, failureError);
    }
  } finally {
    await heartbeat.stop();
    await rm(directory, { recursive: true, force: true });
  }
  return true;
}

export async function queueExpiredCleanupJobs(supabase) {
  const { data, error } = await supabase.from("media_ingestions")
    .select("id,sha256").is("deleted_at", null).lt("expires_at", new Date().toISOString()).limit(100);
  if (error) throw new Error("expiry_query_failed");
  let queued = 0;
  for (const ingestion of data ?? []) {
    const { data: activeJobs, error: activeError } = await supabase.from("processing_jobs")
      .select("id").eq("ingestion_id", ingestion.id).neq("job_type", "cleanup")
      .in("status", ["queued", "running"]).limit(1);
    if (activeError || activeJobs?.length) continue;
    const { data: existing, error: lookupError } = await supabase.from("processing_jobs")
      .select("id,status").eq("ingestion_id", ingestion.id).eq("job_type", "cleanup").maybeSingle();
    if (lookupError) continue;
    if (existing?.status === "queued" || existing?.status === "running" || existing?.status === "completed") continue;
    if (existing) {
      const { error: retryError } = await supabase.from("processing_jobs").update({
        status: "queued", started_at: null, completed_at: null, error_code: null, output_json: {},
      }).eq("id", existing.id);
      if (!retryError) queued += 1;
      continue;
    }
    const { error: insertError } = await supabase.from("processing_jobs").insert({
      ingestion_id: ingestion.id,
      job_type: "cleanup",
      status: "queued",
      processor_name: "pending",
      processor_version: "pending",
      input_hash: ingestion.sha256,
    });
    if (!insertError) queued += 1;
  }
  return queued;
}

async function listAllStorageEntries(bucket, prefix) {
  const entries = [];
  const pageSize = 1_000;
  for (let page = 0; page < 100; page += 1) {
    const { data, error } = await bucket.list(prefix, {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("orphan_query_failed");
    entries.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) return entries;
  }
  throw new Error("orphan_scan_limit_exceeded");
}

export async function cleanupOrphanOriginals(supabase, olderThanMs = 60 * 60 * 1_000) {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const uuidPattern = new RegExp(`^${uuid}$`, "i");
  const bucket = supabase.storage.from(BUCKET);
  const roots = await listAllStorageEntries(bucket, "");
  const candidates = [];
  for (const root of roots) {
    if (!uuidPattern.test(root.name)) continue;
    const objects = await listAllStorageEntries(bucket, root.name);
    for (const object of objects) {
      if (object.id && uuidPattern.test(object.name) && object.created_at < cutoff) {
        candidates.push(`${root.name}/${object.name}`);
      }
    }
  }
  if (candidates.length === 0) return { deleted: 0, failed: 0 };
  const referenced = new Set();
  for (let offset = 0; offset < candidates.length; offset += 250) {
    const keys = candidates.slice(offset, offset + 250);
    const { data: ingestions, error: ingestionError } = await supabase.from("media_ingestions")
      .select("temporary_storage_key").in("temporary_storage_key", keys);
    if (ingestionError) throw new Error("orphan_ingestion_query_failed");
    for (const ingestion of ingestions ?? []) referenced.add(ingestion.temporary_storage_key);
  }
  let deleted = 0;
  let failed = 0;
  for (const key of candidates) {
    if (referenced.has(key)) continue;
    const { error: removeError } = await bucket.remove([key]);
    if (removeError) failed += 1;
    else deleted += 1;
  }
  return { deleted, failed };
}

export async function runMaintenance(supabase) {
  const queued = await queueExpiredCleanupJobs(supabase);
  const orphans = await cleanupOrphanOriginals(supabase);
  return { queued, orphans };
}

export async function watchForJobs(supabase, options = {}) {
  const pollMs = Number.isFinite(options.pollMs)
    ? Math.min(60_000, Math.max(1_000, options.pollMs)) : 2_000;
  const maxIdlePollMs = Math.max(pollMs, Number.isFinite(options.maxIdlePollMs)
    ? Math.min(300_000, options.maxIdlePollMs) : 30_000);
  const maintenanceMs = options.maintenanceMs ?? 60_000;
  const shouldStop = options.shouldStop ?? (() => false);
  const processJob = options.processJob ?? processOneJob;
  const maintain = options.maintain ?? runMaintenance;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  await maintain(supabase);
  let lastMaintenance = now();
  let idlePollMs = pollMs;
  while (!shouldStop()) {
    const processed = await processJob(supabase);
    if (now() - lastMaintenance >= maintenanceMs) {
      await maintain(supabase);
      lastMaintenance = now();
    }
    if (processed) {
      idlePollMs = pollMs;
    } else {
      await wait(idlePollMs);
      idlePollMs = Math.min(maxIdlePollMs, idlePollMs * 2);
    }
  }
}

function loadEnvironment() {
  for (const path of [".env.local", ".env"]) {
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

async function main() {
  loadEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 설정 필요");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  if (process.argv.includes("--watch")) {
    let stopping = false;
    process.once("SIGTERM", () => { stopping = true; });
    process.once("SIGINT", () => { stopping = true; });
    const pollMs = Math.max(1_000, Number(process.env.MPE_WORKER_POLL_MS) || 2_000);
    const maxIdlePollMs = Math.max(pollMs, Number(process.env.MPE_WORKER_MAX_IDLE_POLL_MS) || 30_000);
    await watchForJobs(supabase, { pollMs, maxIdlePollMs, shouldStop: () => stopping });
  } else if (process.argv.includes("--drain")) {
    await runMaintenance(supabase);
    while (await processOneJob(supabase)) continue;
  } else {
    await runMaintenance(supabase);
    await processOneJob(supabase);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
