"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UploadResult = { ingestionId: string; jobIds: string[]; status: string };

const ERROR_LABEL: Record<string, string> = {
  signed_out: "로그인이 필요해요.",
  rights_required: "직접 제작했거나 분석 권한이 있는 파일인지 확인해 주세요.",
  file_required: "업로드할 파일을 선택해 주세요.",
  file_too_large: "파일은 20MB 이하여야 해요.",
  unsupported_media_type: "지원하지 않는 파일 형식이에요.",
  mime_mismatch: "파일 내용과 확장자 형식이 일치하지 않아요.",
  rate_limited: "업로드 요청이 많아요. 잠시 후 다시 시도해 주세요.",
  upload_failed: "임시 파일 업로드에 실패했어요.",
  ingestion_failed: "처리 작업 등록에 실패했어요.",
};

export function MpeUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [candidateTitle, setCandidateTitle] = useState("");
  const [memeType, setMemeType] = useState("OTHER");
  const [creating, setCreating] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!file) return setError("업로드할 파일을 선택해 주세요.");
    if (!rightsAccepted) return setError("직접 제작했거나 분석 권한이 있는 파일인지 확인해 주세요.");

    const form = new FormData();
    form.set("file", file);
    form.set("rightsDeclaration", JSON.stringify({ accepted: true }));
    setPending(true);
    try {
      const response = await fetch("/api/mpe/uploads", { method: "POST", body: form });
      const payload = await response.json() as { ok: boolean; data?: UploadResult; error?: string };
      if (!response.ok || !payload.ok || !payload.data) {
        setError(ERROR_LABEL[payload.error ?? ""] ?? "업로드를 접수하지 못했어요.");
        return;
      }
      setResult(payload.data);
      router.refresh();
    } catch {
      setError("네트워크 오류로 업로드를 접수하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  async function createCandidate() {
    if (!result || !candidateTitle.trim()) return setError("후보 제목을 입력해 주세요.");
    setError(null);
    setCreating(true);
    try {
      const response = await fetch("/api/admin/mpe-candidates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", ingestionId: result.ingestionId, title: candidateTitle.trim(), memeType }),
      });
      const payload = await response.json() as { ok: boolean; data?: { candidate?: { id?: string } }; error?: string };
      if (!response.ok || !payload.ok) {
        const retry = payload.error === "processing_jobs_not_terminal"
          ? "분석 작업이 아직 끝나지 않았어요. 잠시 후 다시 시도해 주세요."
          : payload.error === "processing_jobs_failed"
            ? "실패한 분석 작업을 재처리한 뒤 다시 시도해 주세요."
            : "후보를 생성하지 못했어요.";
        setError(retry);
        return;
      }
      const candidateId = payload.data?.candidate?.id;
      if (!candidateId) return setError("생성된 후보 ID를 확인하지 못했어요.");
      router.push(`/admin/mpe/${candidateId}`);
    } catch {
      setError("네트워크 오류로 후보를 생성하지 못했어요.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">권한 있는 미디어 직접 업로드</h2>
      <p className="mt-1 text-sm text-muted">이미지·영상은 20MB 이하만 접수하며 원본은 24시간 후 삭제됩니다. 처리 작업 완료 후 후보 제목과 유형을 정해 후보를 생성하세요.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">미디어 파일</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block min-h-11 w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
        </label>
        <label className="flex min-h-11 items-start gap-3 rounded-lg bg-surface-2 p-3 text-sm">
          <input type="checkbox" checked={rightsAccepted} onChange={(event) => setRightsAccepted(event.target.checked)} className="mt-1 h-5 w-5" />
          <span>이 파일을 직접 제작했거나 OCR·STT·프레임 분석을 수행할 권한이 있습니다.</span>
        </label>
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50">
          {pending ? "업로드 접수 중…" : "분석 작업 접수"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red">{error}</p>}
      {result && (
        <div className="mt-3 space-y-4 rounded-lg bg-safety-green-bg p-3 text-sm text-safety-green">
          <div role="status">
          <p className="font-semibold">분석 작업을 접수했어요.</p>
          <p className="mt-1 break-all">ingestion: {result.ingestionId}</p>
          <p className="mt-1 break-all">jobs: {result.jobIds.join(", ")}</p>
          <p className="mt-2 text-foreground">모든 작업이 완료되면 후보를 생성하고 근거 초안을 검수할 수 있어요.</p>
          </div>
          <div className="grid gap-3 border-t border-safety-green pt-3 sm:grid-cols-2">
            <label className="block text-foreground">
              <span className="mb-1 block font-medium">후보 제목</span>
              <input value={candidateTitle} onChange={(event) => setCandidateTitle(event.target.value)} maxLength={200} className="min-h-11 w-full rounded-lg border border-border bg-background px-3" />
            </label>
            <label className="block text-foreground">
              <span className="mb-1 block font-medium">밈 유형</span>
              <select value={memeType} onChange={(event) => setMemeType(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
                <option value="PHRASE">문구</option>
                <option value="REACTION_IMAGE">리액션 이미지</option>
                <option value="VIDEO_SCENE">영상 장면</option>
                <option value="SOUND">사운드</option>
                <option value="CHALLENGE">챌린지</option>
                <option value="IMAGE_TEMPLATE">이미지 템플릿</option>
                <option value="CHARACTER">캐릭터</option>
                <option value="EVENT_RECORD">사건 기록</option>
                <option value="OTHER">기타</option>
              </select>
            </label>
          </div>
          <button type="button" disabled={creating} onClick={createCandidate} className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50">
            {creating ? "후보 생성 중…" : "분석 완료 후 후보 생성"}
          </button>
        </div>
      )}
    </section>
  );
}
