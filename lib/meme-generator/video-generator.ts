/**
 * 밈캐치 독립형 자체 밈 숏폼 영상 및 스토리보드 생성 파이프라인.
 * 외부 유튜브/틱톡 영상 다운로드나 크롤링 없이,
 * 자체 생성된 밈 데이터와 카드 그래픽, 내레이션 대본 및 ASS/VTT 자막 트랙을 결합하여
 * 9:16 세로형 숏폼 비디오 렌더링 플랜을 구성합니다.
 */

import type { GeneratedHouseMeme, HouseMemeVideoScene } from "./data-generator";

export type VideoRenderFormat = "vertical_shorts" | "square_feed";

export const VIDEO_PRESETS = {
  vertical_shorts: { width: 1080, height: 1920, fps: 30, maxDurationSec: 30 },
  square_feed: { width: 1080, height: 1080, fps: 30, maxDurationSec: 30 },
} as const;

export type VideoRenderPlan = {
  id: string;
  memeId: string;
  title: string;
  format: VideoRenderFormat;
  totalDurationSec: number;
  scenes: HouseMemeVideoScene[];
  subtitlesAss: string;
  subtitlesVtt: string;
  ffmpegCommand: string;
};

function formatAssTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

function formatVttTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/**
 * mpe-media-worker 및 ffmpeg에서 고품질 자막을 입힐 수 있는 ASS 자막 스크립트를 생성합니다.
 */
export function generateAssSubtitles(
  title: string,
  scenes: HouseMemeVideoScene[],
  format: VideoRenderFormat = "vertical_shorts",
): string {
  const { width, height } = VIDEO_PRESETS[format];
  const fontSize = format === "vertical_shorts" ? 64 : 52;

  let header = `[Script Info]
Title: CatchMeme House Original - ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,2,40,40,${Math.round(height * 0.18)},1
Style: Highlight,Arial,${fontSize + 8},&H004AFFFA,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,4,2,40,40,${Math.round(height * 0.18)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let currentSec = 0;
  for (const scene of scenes) {
    const start = formatAssTimestamp(currentSec);
    const end = formatAssTimestamp(currentSec + scene.durationSec);
    const text = scene.captionText.replace(/\n/g, "\\N");
    header += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
    currentSec += scene.durationSec;
  }

  return header;
}

/**
 * 웹 비디오 플레이어용 표준 WebVTT 자막 트랙을 생성합니다.
 */
export function generateVttSubtitles(scenes: HouseMemeVideoScene[]): string {
  let vtt = `WEBVTT - CatchMeme House Original\n\n`;
  let currentSec = 0;

  scenes.forEach((scene, index) => {
    const start = formatVttTimestamp(currentSec);
    const end = formatVttTimestamp(currentSec + scene.durationSec);
    vtt += `${index + 1}\n${start} --> ${end}\n${scene.captionText}\n\n`;
    currentSec += scene.durationSec;
  });

  return vtt;
}

/**
 * 밈캐치 자체 숏폼 영상 렌더링 플랜 및 실행 명령어를 빌드합니다.
 */
export function buildHouseMemeVideoPlan(
  meme: GeneratedHouseMeme,
  format: VideoRenderFormat = "vertical_shorts",
): VideoRenderPlan {
  const { width, height, fps } = VIDEO_PRESETS[format];
  const totalDuration = meme.video_scenes.reduce((acc, s) => acc + s.durationSec, 0);
  const subtitlesAss = generateAssSubtitles(meme.title, meme.video_scenes, format);
  const subtitlesVtt = generateVttSubtitles(meme.video_scenes);

  // 로컬 또는 mpe-media-worker에서 단독 실행 가능한 ffmpeg 원라이너 커맨드
  const ffmpegCommand = [
    `ffmpeg -y`,
    `-f lavfi -i "color=c=#181210:s=${width}x${height}:d=${totalDuration}:r=${fps}"`,
    `-vf "subtitles=subtitles.ass:force_style='Fontname=Pretendard,FontSize=32'"`,
    `-c:v libx264 -pix_fmt yuv420p -r ${fps}`,
    `-movflags +faststart`,
    `output_${meme.short_id}.mp4`,
  ].join(" ");

  return {
    id: `render_${meme.short_id}_${Date.now()}`,
    memeId: meme.id,
    title: meme.title,
    format,
    totalDurationSec: totalDuration,
    scenes: meme.video_scenes,
    subtitlesAss,
    subtitlesVtt,
    ffmpegCommand,
  };
}
