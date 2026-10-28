import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { evaluateAssetRights, parseVideoScript, publicAttributionUrl } from "../lib/video-production/core.mjs";
import { inspectMedia, prepareLicensedFontEnvironment, renderLicensedTextPng, renderVideoArtifact } from "./mpe-media-worker.mjs";

const exec = promisify(execFile);
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const MAX_NARRATION_DURATION_DELTA_MS = 2_000;
const COMMAND_TIMEOUT_MS = 20 * 60_000;
const PALETTES = [
  ["#111827", "#8b5cf6", "#f5f3ff"],
  ["#042f2e", "#14b8a6", "#ecfeff"],
  ["#431407", "#f97316", "#fff7ed"],
  ["#172554", "#3b82f6", "#eff6ff"],
  ["#3f0d32", "#ec4899", "#fdf2f8"],
];

function defaultCommandExecutor(command, args, options = {}) {
  return exec(command, args, {
    ...options,
    timeout: options.timeout ?? COMMAND_TIMEOUT_MS,
    killSignal: "SIGKILL",
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
  });
}

function assertRecord(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(code);
}

function xmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function displayTextWidth(value) {
  let width = 0;
  for (const character of [...value]) width += /[\x00-\xff]/u.test(character) ? 0.58 : 1;
  return width;
}

/** Wrap all Unicode code points, including a single word longer than the requested line. */
export function wrapUnicodeText(value, maxWidth) {
  if (typeof value !== "string" || !Number.isFinite(maxWidth) || maxWidth < 1) throw new TypeError("invalid_wrap_input");
  const lines = [];
  let current = "";
  const appendUnit = (unit, separator = "") => {
    const candidate = current ? `${current}${separator}${unit}` : unit;
    if (current && displayTextWidth(candidate) > maxWidth) {
      lines.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  };
  for (const paragraph of value.replaceAll("\r", "").split("\n")) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    for (const word of words) {
      if (displayTextWidth(word) <= maxWidth) {
        appendUnit(word, " ");
        continue;
      }
      for (const character of [...word]) appendUnit(character);
    }
    if (current) {
      lines.push(current);
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textElements(lines, { x, y, lineHeight, className, anchor = "start" }) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + (index * lineHeight)}" text-anchor="${anchor}" class="${className}">${xmlText(line)}</text>`
  )).join("");
}

async function validatedSharpFont(fontPath, fontFamily) {
  const resolvedPath = resolve(fontPath);
  const fontStat = await stat(resolvedPath);
  if (!fontStat.isFile() || fontStat.size <= 0 || fontStat.size > 80 * 1024 * 1024) throw new Error("invalid_font_file");
  if (![".otf", ".ttf", ".ttc"].includes(extname(resolvedPath).toLowerCase())) throw new Error("invalid_font_file");
  return Object.freeze({ path: resolvedPath, family: fontFamily });
}

function fitTextToPixelBox(value, { width, maxSize, minSize, maxLines }) {
  for (let size = maxSize; size >= minSize; size -= 1) {
    const lines = wrapUnicodeText(value, width / size);
    if (lines.length <= maxLines && lines.every((line) => displayTextWidth(line) * size <= width)) {
      return { lines, size };
    }
  }
  throw new Error("text_exceeds_pixel_box");
}

export function layoutSceneTextForRender(scene, { index, originalObservation, sourceOrdinals }) {
  const headingFit = fitTextToPixelBox(String(scene.heading ?? ""),
    { width: 936, maxSize: 92, minSize: 58, maxLines: 4 });
  const captionFit = fitTextToPixelBox(String(scene.caption ?? ""),
    { width: 896, maxSize: 62, minSize: 42, maxLines: 3 });
  const explanationFit = fitTextToPixelBox(String(scene.narration ?? ""),
    { width: 856, maxSize: 48, minSize: 31, maxLines: 5 });
  const observationFit = fitTextToPixelBox(String(originalObservation),
    { width: 856, maxSize: 28, minSize: 24, maxLines: 3 });
  const heading = headingFit.lines;
  const caption = captionFit.lines;
  const explanation = explanationFit.lines;
  const observation = observationFit.lines;
  const headingSize = headingFit.size;
  const captionSize = captionFit.size;
  const explanationSize = explanationFit.size;
  const ordinalLabel = Array.isArray(scene.source_ids) && sourceOrdinals instanceof Map
    ? scene.source_ids.map((id) => sourceOrdinals.get(id)).filter(Number.isInteger).join(", ")
    : "";
  const sourceBadge = Array.isArray(scene.source_ids) && scene.source_ids.length > 0
    ? `검수 자료${ordinalLabel ? ` [${ordinalLabel}]` : ` ${scene.source_ids.length}개`}`
    : "밈캐치 자체 해설";
  return { heading, caption, explanation, observation, headingSize, captionSize, explanationSize,
    example: scene.kind === "example", sourceBadge, number: String(index + 1),
    eyebrow: String(scene.kind ?? "SCENE").toUpperCase() };
}

async function renderSceneTextLayers(scene, options, fontEnvironment, palette) {
  const layout = layoutSceneTextForRender(scene, options);
  const specifications = [
    ["MemeCatch · 밈캐치", 112, 92, { size: 34, width: 690, maxBottom: 164, color: palette[2] }],
    [layout.number, 868, 92, { size: 34, width: 100, maxBottom: 164, align: "right", color: palette[2] }],
    [layout.eyebrow, 72, 184, { size: 30, width: 500, maxBottom: 252, color: palette[1] }],
    [layout.sourceBadge, 508, 252, { size: 26, width: 500, maxBottom: 322, align: "right", color: palette[2] }],
    [layout.heading.join("\n"), 72, layout.example ? 355 : 305,
      { size: layout.headingSize, width: 936, maxBottom: 740, color: palette[2], weight: "Ultra-Bold" }],
    [layout.caption.join("\n"), 92, 795,
      { size: layout.captionSize, width: 896, maxBottom: 990, align: "center", color: palette[0], weight: "Ultra-Bold" }],
    [layout.explanation.join("\n"), 112, 1070,
      { size: layout.explanationSize, width: 856, maxBottom: 1360, color: palette[2] }],
    [layout.observation.join("\n"), 112, 1425, { size: 28, width: 856, maxBottom: 1555, color: palette[0] }],
  ];
  if (layout.example) specifications.push(["자체 작성 가상 예시", 90, 271,
    { size: 26, width: 294, maxBottom: 322, align: "center", color: "#422006", weight: "Ultra-Bold" }]);
  const { getSharp } = await import("next/dist/server/image-optimizer.js");
  const sharp = getSharp(1, false);
  return Promise.all(specifications.map(async ([text, left, top, configuration]) => {
    const input = await renderLicensedTextPng(text, { fontEnvironment, ...configuration });
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
    if (maxX < minX || left + minX < 64 || left + maxX > WIDTH - 65 || top + minY < 0
        || top + maxY >= HEIGHT || top + maxY > configuration.maxBottom) {
      throw new Error("licensed_scene_text_out_of_bounds");
    }
    return { input, left, top };
  }));
}

export function buildSceneSvg(scene, { index = 0, title = "", originalObservation = "", sourceOrdinals = null,
  includeText = true, font = { css: "", family: "Arial, sans-serif" } } = {}) {
  assertRecord(scene, "invalid_scene");
  const palette = PALETTES[index % PALETTES.length];
  const layout = layoutSceneTextForRender(scene, { index, originalObservation, sourceOrdinals });
  const exampleBadgeShape = layout.example ? '<rect x="72" y="260" width="330" height="62" rx="31" fill="#fde047"/>' : "";
  const exampleBadgeText = layout.example ? '<text x="237" y="303" text-anchor="middle" class="badge">자체 작성 가상 예시</text>' : "";
  const sourceBadge = `<text x="1008" y="292" text-anchor="end" class="source">${xmlText(layout.sourceBadge)}</text>`;
  const shapeOffset = 80 + ((index * 71) % 260);
  const visibleText = includeText ? `<text x="112" y="132" class="brand">MemeCatch · 밈캐치</text><text x="968" y="132" text-anchor="end" class="brand">${layout.number}</text><text x="72" y="224" class="eyebrow">${xmlText(layout.eyebrow)}</text>${exampleBadgeText}${sourceBadge}${textElements(layout.heading, { x: 72, y: layout.example ? 440 : 390, lineHeight: layout.headingSize * 1.13, className: "heading" })}${textElements(layout.caption, { x: 540, y: 838, lineHeight: layout.captionSize * 1.2, className: "caption", anchor: "middle" })}${textElements(layout.explanation, { x: 112, y: 1118, lineHeight: layout.explanationSize * 1.22, className: "explanation" })}${textElements(layout.observation, { x: 112, y: 1462, lineHeight: 36, className: "observation" })}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><style>${font.css}.brand,.eyebrow,.heading,.caption,.explanation,.observation,.source,.badge{font-family:${font.family}}.brand{font-size:34px;font-weight:800;fill:${palette[2]}}.eyebrow{font-size:30px;font-weight:800;letter-spacing:4px;fill:${palette[1]}}.heading{font-size:${layout.headingSize}px;font-weight:900;fill:${palette[2]}}.caption{font-size:${layout.captionSize}px;font-weight:900;fill:${palette[0]}}.explanation{font-size:${layout.explanationSize}px;font-weight:700;fill:${palette[2]}}.observation{font-size:28px;font-weight:650;fill:${palette[0]}}.source{font-size:26px;font-weight:750;fill:${palette[2]}}.badge{font-size:26px;font-weight:900;fill:#422006}</style><rect width="1080" height="1920" fill="${palette[0]}"/><circle cx="${860 - shapeOffset}" cy="550" r="380" fill="${palette[1]}" opacity=".34"/><path d="M-60 1460 Q ${340 + shapeOffset} 1120 1140 1370 L1140 2020 L-60 2020Z" fill="${palette[1]}" opacity=".72"/><rect x="72" y="70" width="936" height="94" rx="47" fill="#000" opacity=".22"/>${exampleBadgeShape}<rect x="72" y="760" width="936" height="240" rx="54" fill="${palette[2]}"/><rect x="72" y="1040" width="936" height="330" rx="54" fill="#000" opacity=".24"/><rect x="72" y="1410" width="936" height="150" rx="42" fill="${palette[2]}" opacity=".94"/>${visibleText}<!-- lower 360px intentionally reserved for MPE captions, source and watermark --><title>${xmlText(title)}</title></svg>`;
}

function validateSources(sources) {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 30) throw new TypeError("invalid_sources");
  const ids = new Set();
  return sources.map((source) => {
    assertRecord(source, "invalid_source");
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const title = typeof source.title === "string" ? source.title.trim() : "";
    const url = typeof source.url === "string" ? source.url.trim() : "";
    if (!id || !title || source.approved !== true || ids.has(id)) throw new TypeError("invalid_or_unapproved_source");
    const publicUrl = publicAttributionUrl(url);
    ids.add(id);
    return Object.freeze({ id, title, url: publicUrl, approved: true });
  });
}

function sourceAttribution(sources) {
  return sources.length === 1 ? "자료 [1] · 설명란" : `자료 [1–${sources.length}] · 설명란`;
}

function assertRequiredRightsAssets(assets, { fontPath }) {
  const kinds = new Set(assets.map((asset) => asset?.kind));
  for (const kind of ["voice", "graphic", "font"]) if (!kinds.has(kind)) throw new Error(`missing_${kind}_rights_asset`);
  if (!fontPath || !kinds.has("font")) throw new Error("font_rights_not_declared");
}

function validateAssetBindings(value, assets) {
  assertRecord(value, "asset_bindings_required");
  const keys = ["voiceAssetId", "fontAssetId", "graphicAssetId", "voiceSha256", "fontSha256"];
  if (Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => typeof value[key] !== "string" || !value[key].trim())) {
    throw new TypeError("invalid_asset_bindings");
  }
  if (!/^[a-f0-9]{64}$/u.test(value.voiceSha256) || !/^[a-f0-9]{64}$/u.test(value.fontSha256)) throw new TypeError("invalid_asset_binding_hash");
  const expected = [["voiceAssetId", "voice"], ["fontAssetId", "font"], ["graphicAssetId", "graphic"]];
  for (const [field, kind] of expected) {
    const matches = assets.filter((asset) => asset.id === value[field] && asset.kind === kind);
    if (matches.length !== 1) throw new Error(`asset_binding_mismatch:${field}`);
  }
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, value[key]])));
}

function assertSafeTextLayout(script) {
  for (const scene of script.scenes) {
    try {
      layoutSceneTextForRender(scene, { index: 0, originalObservation: script.original_observation, sourceOrdinals: null });
    } catch (error) {
      if (error?.message === "text_exceeds_pixel_box") throw new Error(`scene_text_exceeds_safe_layout:${scene.id}`);
      throw error;
    }
  }
}

async function inspectWith({ path, ffprobe, commandExecutor, inspectArtifact }) {
  if (inspectArtifact) return inspectArtifact(path);
  if (!ffprobe || ffprobe === "ffprobe") return inspectMedia(path);
  const { stdout } = await commandExecutor(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], { encoding: "utf8" });
  const payload = JSON.parse(stdout);
  const streams = Array.isArray(payload.streams) ? payload.streams : [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const seconds = Number(payload.format?.duration ?? video?.duration ?? audio?.duration ?? 0);
  return {
    width: Number.isInteger(video?.width) ? video.width : null,
    height: Number.isInteger(video?.height) ? video.height : null,
    durationMs: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1_000)) : 0,
    hasAudio: Boolean(audio),
  };
}

async function validateNarration({ narrationPath, durationMs, ffmpeg, ffprobe, commandExecutor, inspectArtifact }) {
  const metadata = await inspectWith({ path: narrationPath, ffprobe, commandExecutor, inspectArtifact });
  if (!metadata.hasAudio || metadata.durationMs <= 0) throw new Error("narration_audio_required");
  if (Math.abs(metadata.durationMs - durationMs) > MAX_NARRATION_DURATION_DELTA_MS) {
    throw new Error("narration_duration_mismatch");
  }
  const { stderr = "" } = await commandExecutor(ffmpeg, [
    "-hide_banner", "-nostdin", "-i", narrationPath, "-vn", "-af", "volumedetect", "-f", "null", "-",
  ], { encoding: "utf8" });
  const maxVolume = /max_volume:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dB/iu.exec(stderr)?.[1];
  if (!maxVolume || maxVolume === "-inf" || Number(maxVolume) < -48) throw new Error("narration_audio_is_silent");
  return metadata;
}

async function renderBaseVideo({ scenes, scenePaths, narrationPath, outputPath, durationMs, ffmpeg, commandExecutor }) {
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];
  for (const scenePath of scenePaths) args.push("-loop", "1", "-framerate", String(FPS), "-i", scenePath);
  args.push("-i", narrationPath);
  const filters = scenes.map((scene, index) => (
    `[${index}:v]scale=${WIDTH}:${HEIGHT},setsar=1,fps=${FPS},format=yuv420p,trim=duration=${((scene.end_ms - scene.start_ms) / 1_000).toFixed(3)},setpts=PTS-STARTPTS[v${index}]`
  ));
  filters.push(`${scenes.map((_, index) => `[v${index}]`).join("")}concat=n=${scenes.length}:v=1:a=0[video]`);
  const audioIndex = scenes.length;
  filters.push(`[${audioIndex}:a]apad=whole_dur=${(durationMs / 1_000).toFixed(3)},atrim=duration=${(durationMs / 1_000).toFixed(3)},asetpts=PTS-STARTPTS[audio]`);
  args.push(
    "-filter_complex", filters.join(";"), "-map", "[video]", "-map", "[audio]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-frames:v", String(Math.round((durationMs / 1_000) * FPS)),
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", outputPath,
  );
  await commandExecutor(ffmpeg, args);
}

async function verifyDecode({ path, ffmpeg, commandExecutor }) {
  await commandExecutor(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-i", path,
    "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-",
  ]);
  return true;
}

async function finalizeDuration({ inputPath, outputPath, durationMs, ffmpeg, commandExecutor }) {
  const seconds = (durationMs / 1_000).toFixed(3);
  await commandExecutor(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", inputPath,
    "-filter_complex",
    `[0:v]trim=duration=${seconds},setpts=PTS-STARTPTS[v];[0:a]atrim=duration=${seconds},apad=whole_dur=${seconds},atrim=duration=${seconds},asetpts=PTS-STARTPTS[a]`,
    "-map", "[v]", "-map", "[a]", "-frames:v", String(Math.round((durationMs / 1_000) * FPS)),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", outputPath,
  ]);
}

async function sha256File(path) {
  const bytes = await readFile(path);
  return { sha256: createHash("sha256").update(bytes).digest("hex"), byteSize: bytes.byteLength };
}

async function sha256Path(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** Render an original MemeCatch explainer. It never downloads or embeds third-party media. */
export async function renderOriginalProduction(input) {
  assertRecord(input, "invalid_render_request");
  const {
    script: rawScript,
    assets,
    assetBindings: rawAssetBindings,
    sources: rawSources,
    narrationPath,
    outputDirectory,
    fontPath,
    fontFamily = "Noto Sans CJK KR",
    ffmpeg = "ffmpeg",
    ffprobe = "ffprobe",
    commandExecutor = defaultCommandExecutor,
    renderArtifact = renderVideoArtifact,
    inspectArtifact = null,
    fileHasher = sha256Path,
    now = new Date(),
  } = input;
  if (typeof narrationPath !== "string" || !narrationPath.trim()) throw new TypeError("narration_path_required");
  if (typeof outputDirectory !== "string" || !outputDirectory.trim()) throw new TypeError("output_directory_required");
  if (typeof fontPath !== "string" || !fontPath.trim()) throw new TypeError("font_path_required");
  if (typeof fontFamily !== "string" || !/^[\p{L}\p{N} ._-]{1,100}$/u.test(fontFamily.trim())) throw new TypeError("invalid_font_family");
  if (typeof commandExecutor !== "function" || typeof renderArtifact !== "function" || typeof fileHasher !== "function") throw new TypeError("invalid_renderer_dependency");

  const sources = validateSources(rawSources);
  const script = parseVideoScript(rawScript, { allowedSourceIds: sources.map((source) => source.id) });
  const usedSources = sources.filter((source) => script.source_ids.includes(source.id));
  if (usedSources.length !== script.source_ids.length) throw new Error("source_mapping_incomplete");
  const rights = evaluateAssetRights(assets, now);
  if (!rights.allowed) {
    const error = new Error("asset_rights_not_approved");
    error.reasons = rights.reasons;
    throw error;
  }
  assertRequiredRightsAssets(assets, { fontPath });
  const assetBindings = validateAssetBindings(rawAssetBindings, assets);
  const unsupportedRequirement = script.asset_requirements.find((requirement) => !["graphic", "voice", "font"].includes(requirement.kind));
  if (unsupportedRequirement) throw new Error(`unsupported_asset_requirement:${unsupportedRequirement.kind}`);
  assertSafeTextLayout(script);
  const attribution = sourceAttribution(usedSources);

  // Rights validation deliberately happens before reading local assets or invoking media tools.
  const [voiceSha256, fontSha256] = await Promise.all([fileHasher(narrationPath), fileHasher(fontPath)]);
  if (voiceSha256 !== assetBindings.voiceSha256) throw new Error("voice_asset_hash_mismatch");
  if (fontSha256 !== assetBindings.fontSha256) throw new Error("font_asset_hash_mismatch");
  const durationMs = script.scenes.at(-1).end_ms;
  const targetDirectory = resolve(outputDirectory);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "memecatch-original-render-"));
  const mp4Path = join(targetDirectory, "production.mp4");
  const posterPath = join(targetDirectory, "poster.png");
  let fontEnvironment = null;
  try {
    const pinnedNarrationPath = join(temporaryDirectory, "narration-input");
    await copyFile(narrationPath, pinnedNarrationPath);
    if (await sha256Path(pinnedNarrationPath) !== assetBindings.voiceSha256) {
      throw new Error("voice_asset_copy_hash_mismatch");
    }
    await validateNarration({ narrationPath: pinnedNarrationPath, durationMs, ffmpeg, ffprobe,
      commandExecutor, inspectArtifact });
    await mkdir(targetDirectory, { recursive: true });
    const font = await validatedSharpFont(fontPath, fontFamily.trim());
    fontEnvironment = await prepareLicensedFontEnvironment(font.path, font.family);
    if (fontEnvironment.sourceHash !== assetBindings.fontSha256) {
      throw new Error("font_asset_copy_hash_mismatch");
    }
    const { getSharp } = await import("next/dist/server/image-optimizer.js");
    const sharp = getSharp(1, false);
    const scenePaths = [];
    const sourceOrdinals = new Map(usedSources.map((source, sourceIndex) => [source.id, sourceIndex + 1]));
    for (const [index, scene] of script.scenes.entries()) {
      const path = join(temporaryDirectory, `scene-${String(index).padStart(2, "0")}.png`);
      const svg = buildSceneSvg(scene, { index, title: script.title, originalObservation: script.original_observation,
        sourceOrdinals, includeText: false });
      const textLayers = await renderSceneTextLayers(scene,
        { index, originalObservation: script.original_observation, sourceOrdinals }, fontEnvironment,
        PALETTES[index % PALETTES.length]);
      await sharp(Buffer.from(svg)).composite(textLayers).png().toFile(path);
      scenePaths.push(path);
    }
    const basePath = join(temporaryDirectory, "original-base.mp4");
    await renderBaseVideo({ scenes: script.scenes, scenePaths, narrationPath: pinnedNarrationPath,
      outputPath: basePath, durationMs, ffmpeg, commandExecutor });
    const decoratedPath = join(temporaryDirectory, "captioned.mp4");
    const decoration = await renderArtifact(basePath, decoratedPath, {
      preset: "vertical",
      attribution,
      fontPath: fontEnvironment.fontPath,
      fontFamily: fontFamily.trim(),
      segments: script.scenes.map((scene) => ({ startMs: scene.start_ms, endMs: scene.end_ms, text: scene.caption })),
    });
    if (decoration?.fontSelection?.verified !== true || decoration.fontSelection.family !== fontFamily.trim()) {
      throw new Error("licensed_font_selection_unverified");
    }
    if (decoration.fontSelection.sha256 !== assetBindings.fontSha256) {
      throw new Error("caption_font_hash_mismatch");
    }
    if (decoration.captionLayoutVerified !== true) {
      throw new Error("licensed_caption_layout_unverified");
    }
    await finalizeDuration({ inputPath: decoratedPath, outputPath: mp4Path, durationMs, ffmpeg, commandExecutor });
    await commandExecutor(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ss", "1.000", "-i", mp4Path,
      "-frames:v", "1", "-vf", `scale=${WIDTH}:${HEIGHT}`, posterPath,
    ]);
    const metadata = await inspectWith({ path: mp4Path, ffprobe, commandExecutor, inspectArtifact });
    const decodeOk = await verifyDecode({ path: mp4Path, ffmpeg, commandExecutor });
    const durationValid = metadata.durationMs >= 30_000 && metadata.durationMs <= 45_000
      && Math.abs(metadata.durationMs - durationMs) <= 500;
    const technicalCheck = Object.freeze({
      duration_ms: metadata.durationMs,
      width: metadata.width,
      height: metadata.height,
      has_audio: metadata.hasAudio === true,
      decode_ok: decodeOk,
      decodable: decodeOk,
      captions_safe: decoration.captionLayoutVerified === true,
      font_selected: true,
      font_family: fontFamily.trim(),
      passed: durationValid && metadata.width === WIDTH && metadata.height === HEIGHT && metadata.hasAudio === true
        && decodeOk && decoration.captionLayoutVerified === true,
    });
    if (!technicalCheck.passed) throw new Error("rendered_media_failed_technical_check");
    const { sha256, byteSize } = await sha256File(mp4Path);
    const poster = await stat(posterPath);
    if (poster.size <= 0) throw new Error("poster_generation_failed");
    return Object.freeze({
      mp4Path,
      posterPath,
      sha256,
      byteSize,
      technicalCheck,
      sources: Object.freeze(usedSources),
      rightsAssetIds: Object.freeze(assets.map((asset) => asset.id)),
      assetBindings,
      containsSyntheticMedia: script.contains_synthetic_media,
      retention: Object.freeze({
        localArtifactIsDurable: false,
        requiresPrivateDurableUpload: true,
        cleanupAfter: "durable_upload_verified",
      }),
    });
  } finally {
    if (fontEnvironment) await rm(fontEnvironment.root, { recursive: true, force: true });
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

