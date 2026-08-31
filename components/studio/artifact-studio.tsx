"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { UPLOAD_ACCEPT } from "@/lib/upload-shared";
import { validateUploadFile } from "@/lib/upload";
import {
  downloadBlob,
  IMAGE_PRESETS,
  renderDictionaryCard,
  renderImageArtifact,
  type ImagePreset,
} from "@/components/studio/meme-artifacts";

type ArtifactMode = "image" | "dictionary";
type DictionaryArtifactData = { name: string; summary: string; safety: string; detailUrl: string; source: string };

type ArtifactStudioProps = {
  dictionaryOnly?: boolean;
  dictionaryDefaults?: Partial<DictionaryArtifactData>;
};

const fieldClass = "mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none sm:text-sm";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-[filter,opacity,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:active:scale-100 motion-reduce:transition-none";

function isValidDetailUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function useObjectUrl(file: File | null) {
  const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

function PresetSelect({ value, onChange }: { value: ImagePreset; onChange: (preset: ImagePreset) => void }) {
  return (
    <label className="block text-sm font-bold">
      출력 크기
      <select aria-label="출력 크기" name="artifact-preset" value={value} onChange={(event) => onChange(event.target.value as ImagePreset)} className={fieldClass}>
        {Object.entries(IMAGE_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
      </select>
    </label>
  );
}

function DownloadCanvas({ canvasRef, enabled, filename }: { canvasRef: RefObject<HTMLCanvasElement | null>; enabled: boolean; filename: string }) {
  return (
    <button
      type="button"
      className={buttonClass}
      disabled={!enabled}
      onClick={() => canvasRef.current?.toBlob((blob) => blob && downloadBlob(blob, filename), "image/png")}
    >
      PNG 내려받기
    </button>
  );
}

function ImageArtifact({ rightsConfirmed }: { rightsConfirmed: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [attribution, setAttribution] = useState("");
  const [preset, setPreset] = useState<ImagePreset>("square");
  const [rendered, setRendered] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const imageUrl = useObjectUrl(file);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setImageReady(true);
    };
    image.src = imageUrl;
  }, [imageUrl]);

  function chooseFile(next: File | null) {
    const error = next ? validateUploadFile(next) : null;
    setFileError(error);
    setFile(error ? null : next);
    setImageReady(false);
    setRendered(false);
  }

  function render() {
    if (!rightsConfirmed || !attribution.trim() || !imageRef.current || !canvasRef.current) return;
    renderImageArtifact(canvasRef.current, imageRef.current, preset, { topText, bottomText, attribution });
    setRendered(true);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <label className="block text-sm font-bold">내 이미지 업로드
          <input aria-label="내 이미지 업로드" name="image-file" type="file" accept={UPLOAD_ACCEPT} className={fieldClass} onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
        </label>
        {fileError && <p role="alert" className="text-sm text-(--accent-text)">{fileError}</p>}
        <label className="block text-sm font-bold">상단 문구<input name="image-top-text" value={topText} maxLength={140} onChange={(event) => { setTopText(event.target.value); setRendered(false); }} className={fieldClass} /></label>
        <label className="block text-sm font-bold">하단 문구<input name="image-bottom-text" value={bottomText} maxLength={140} onChange={(event) => { setBottomText(event.target.value); setRendered(false); }} className={fieldClass} /></label>
        <label className="block text-sm font-bold">출처 표기 <span className="font-normal text-muted">(필수)</span><input aria-label="이미지 출처 표기" name="image-attribution" value={attribution} maxLength={100} placeholder="예: 직접 제작" onChange={(event) => { setAttribution(event.target.value); setRendered(false); }} className={fieldClass} /></label>
        <PresetSelect value={preset} onChange={(next) => { setPreset(next); setRendered(false); }} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!rightsConfirmed || !imageReady || !attribution.trim()} onClick={render}>미리보기 렌더</button>
          <DownloadCanvas canvasRef={canvasRef} enabled={rightsConfirmed && Boolean(attribution.trim()) && rendered} filename="memecatch-meme.png" />
        </div>
      </div>
      <div className="min-w-0 rounded-2xl border border-border bg-surface-2 p-3">
        <canvas ref={canvasRef} aria-label="밈 이미지 결과" className={`mx-auto max-h-[650px] w-full object-contain ${rendered ? "block" : "hidden"}`} />
        {!rendered && <p className="grid min-h-56 place-items-center text-center text-sm text-muted">권리를 확인하고 이미지를 선택한 뒤 미리보기를 렌더하세요.</p>}
      </div>
    </div>
  );
}

function DictionaryArtifact({ rightsConfirmed, defaults }: { rightsConfirmed: boolean; defaults?: Partial<DictionaryArtifactData> }) {
  const [preset, setPreset] = useState<ImagePreset>("square");
  const [rendered, setRendered] = useState(false);
  const [data, setData] = useState<DictionaryArtifactData>({ name: "", summary: "", safety: "", detailUrl: "", source: "", ...defaults });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailUrlValid = isValidDetailUrl(data.detailUrl);
  const ready = data.name.trim().length > 0 && data.summary.trim().length > 0 && detailUrlValid && data.source.trim().length > 0;
  function update(key: keyof typeof data, value: string) {
    setData((current) => ({ ...current, [key]: value }));
    setRendered(false);
  }
  function render() {
    if (!rightsConfirmed || !ready || !canvasRef.current) return;
    renderDictionaryCard(canvasRef.current, preset, data);
    setRendered(true);
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">외부 SNS 이미지는 복사하지 않고 밈캐치 자체 그래픽과 입력한 텍스트만 사용합니다.</p>
        <label className="block text-sm font-bold">밈 이름<input name="dictionary-name" value={data.name} onChange={(event) => update("name", event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm font-bold">한 줄 정의<textarea name="dictionary-summary" value={data.summary} onChange={(event) => update("summary", event.target.value)} rows={3} className={fieldClass} /></label>
        <label className="block text-sm font-bold">사용 안전 신호<input name="dictionary-safety" value={data.safety} onChange={(event) => update("safety", event.target.value)} placeholder="예: 친한 사이에서만 권장" className={fieldClass} /></label>
        <label className="block text-sm font-bold">상세 URL<input name="dictionary-detail-url" type="url" value={data.detailUrl} aria-invalid={data.detailUrl ? !detailUrlValid : undefined} placeholder="https://catchmeme.com/memes/밈-이름" onChange={(event) => update("detailUrl", event.target.value)} className={fieldClass} /></label>
        {data.detailUrl && !detailUrlValid && <p role="alert" className="text-sm text-accent-text">https로 시작하는 올바른 주소를 입력해 주세요.</p>}
        <label className="block text-sm font-bold">텍스트 출처 <span className="font-normal text-muted">(필수)</span><input aria-label="사전 카드 출처 표기" name="dictionary-source" value={data.source} placeholder="예: 직접 제작" onChange={(event) => update("source", event.target.value)} className={fieldClass} /></label>
        <PresetSelect value={preset} onChange={(next) => { setPreset(next); setRendered(false); }} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!rightsConfirmed || !ready} onClick={render}>사전 카드 렌더</button>
          <DownloadCanvas canvasRef={canvasRef} enabled={rightsConfirmed && rendered} filename="memecatch-dictionary-card.png" />
        </div>
      </div>
      <div className="min-w-0 rounded-2xl border border-border bg-surface-2 p-3">
        <canvas ref={canvasRef} aria-label="밈 사전 카드 결과" className={`mx-auto max-h-[650px] w-full object-contain ${rendered ? "block" : "hidden"}`} />
        {!rendered && <p className="grid min-h-56 place-items-center text-center text-sm text-muted">이름·정의·출처를 입력하면 사전 카드를 만들 수 있어요.</p>}
      </div>
    </div>
  );
}

export function ArtifactStudio({ dictionaryOnly = false, dictionaryDefaults }: ArtifactStudioProps = {}) {
  const [mode, setMode] = useState<ArtifactMode>(dictionaryOnly ? "dictionary" : "image");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const dictionaryKey = JSON.stringify(dictionaryDefaults ?? {});
  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-6" aria-labelledby="artifact-studio-title">
      <h2 id="artifact-studio-title" className="text-2xl font-extrabold">내 콘텐츠 출력</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">이미지 밈과 사전 카드를 브라우저 안에서 만들고 PNG로 내려받습니다. 파일은 서버에 업로드되지 않습니다.</p>
      <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm font-semibold">
        <input name="rights-confirmed" type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-0.5 size-5" />
        <span>이 파일을 편집하고 출력할 권리가 있으며, 제3자의 권리를 침해하지 않음을 확인합니다.</span>
      </label>
      {!rightsConfirmed && <p role="status" className="mt-2 text-sm text-muted">렌더와 다운로드 전에 권리 확인이 필요합니다.</p>}
      {!dictionaryOnly && (
        <div role="group" aria-label="출력 종류" className="my-5 flex flex-wrap gap-2">
          {(["image", "dictionary"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-11 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${mode === value ? "border-accent bg-accent-strong text-white" : "border-border bg-surface text-muted hover:border-accent hover:text-accent"}`}>
              {value === "image" ? "이미지 밈" : "사전 카드"}
            </button>
          ))}
        </div>
      )}
      {mode === "image" ? <ImageArtifact rightsConfirmed={rightsConfirmed} /> : <DictionaryArtifact key={dictionaryKey} rightsConfirmed={rightsConfirmed} defaults={dictionaryDefaults} />}
    </section>
  );
}
