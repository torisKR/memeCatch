// /admin/mpe and /admin/mpe/{id} (pages/admin/mpe.rs, mpe_console.rs): the
// client parts of mpe-upload-form and mpe-review-console, over
// /api/mpe/uploads, /api/admin/mpe-candidates and routes/admin/mpe.rs.
// admin.js passes its `post` and `element`.
//
// Where the console calls `router.refresh()` the page is reloaded with what
// the component kept (its message, the draft, the memo and the two selects)
// put back: the same end state. The upload form's refresh only re-renders
// the queue below it, so the page is fetched again and the queue replaced.
const FLASH = "memecatch-admin-mpe-flash";

const UPLOAD_ERRORS = {
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
const MEME_TYPES = [
  ["PHRASE", "문구"],
  ["REACTION_IMAGE", "리액션 이미지"],
  ["VIDEO_SCENE", "영상 장면"],
  ["SOUND", "사운드"],
  ["CHALLENGE", "챌린지"],
  ["IMAGE_TEMPLATE", "이미지 템플릿"],
  ["CHARACTER", "캐릭터"],
  ["EVENT_RECORD", "사건 기록"],
  ["OTHER", "기타"],
];

const keep = (kept) => {
  try {
    sessionStorage.setItem(FLASH, JSON.stringify({ ...kept, path: location.pathname }));
  } catch {
    // The page still reloads, without what the component kept.
  }
};
const takeKept = () => {
  try {
    const kept = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
    sessionStorage.removeItem(FLASH);
    return kept && kept.path === location.pathname ? kept : null;
  } catch {
    return null;
  }
};

export function mpeComponents({ post, element }) {
  // MpeUploadForm.
  const upload = (section) => {
    const form = section.querySelector("form");
    const fileInput = form.querySelector("input[type=file]");
    const rights = form.querySelector("input[type=checkbox]");
    const submitButton = form.querySelector("button[type=submit]");
    let pending = false;
    let creating = false;
    let error = null;
    let result = null;
    let title = "";
    let memeType = "OTHER";
    let errorNode = null;
    let resultNode = null;

    const refreshQueue = async () => {
      try {
        const response = await fetch(location.href, { credentials: "same-origin" });
        const fresh = new DOMParser().parseFromString(await response.text(), "text/html");
        const next = fresh.querySelector("[data-admin-controls=mpe-upload]")?.nextElementSibling;
        if (next) section.nextElementSibling?.replaceWith(document.importNode(next, true));
      } catch {
        // The queue stays as it was.
      }
    };
    const renderResult = () => {
      resultNode?.remove();
      resultNode = null;
      if (!result) return;
      resultNode = element("div", "mt-3 space-y-4 rounded-lg bg-safety-green-bg p-3 text-sm text-safety-green");
      const status = element("div");
      status.setAttribute("role", "status");
      status.append(
        element("p", "font-semibold", "분석 작업을 접수했어요."),
        element("p", "mt-1 break-all", `ingestion: ${result.ingestionId}`),
        element("p", "mt-1 break-all", `jobs: ${result.jobIds.join(", ")}`),
        element("p", "mt-2 text-foreground", "모든 작업이 완료되면 후보를 생성하고 근거 초안을 검수할 수 있어요."),
      );
      const grid = element("div", "grid gap-3 border-t border-safety-green pt-3 sm:grid-cols-2");
      const titleLabel = element("label", "block text-foreground");
      const titleInput = element("input", "min-h-11 w-full rounded-lg border border-border bg-background px-3");
      titleInput.maxLength = 200;
      titleInput.value = title;
      titleInput.addEventListener("input", () => {
        title = titleInput.value;
      });
      titleLabel.append(element("span", "mb-1 block font-medium", "후보 제목"), titleInput);
      const typeLabel = element("label", "block text-foreground");
      const typeSelect = element("select", "min-h-11 w-full rounded-lg border border-border bg-background px-3");
      for (const [value, text] of MEME_TYPES) {
        const option = element("option", "", text);
        option.value = value;
        typeSelect.append(option);
      }
      typeSelect.value = memeType;
      typeSelect.addEventListener("change", () => {
        memeType = typeSelect.value;
      });
      typeLabel.append(element("span", "mb-1 block font-medium", "밈 유형"), typeSelect);
      grid.append(titleLabel, typeLabel);
      const create = element("button", "min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50");
      create.type = "button";
      create.dataset.adminCreate = "";
      create.addEventListener("click", () => void createCandidate());
      resultNode.append(status, grid, create);
      section.append(resultNode);
    };
    const sync = () => {
      submitButton.disabled = pending;
      submitButton.textContent = pending ? "업로드 접수 중…" : "분석 작업 접수";
      errorNode?.remove();
      errorNode = null;
      if (error !== null) {
        errorNode = element("p", "mt-3 rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red", error);
        errorNode.setAttribute("role", "alert");
        form.after(errorNode);
      }
      const create = resultNode?.querySelector("[data-admin-create]");
      if (create) {
        create.disabled = creating;
        create.textContent = creating ? "후보 생성 중…" : "분석 완료 후 후보 생성";
      }
    };
    const fail = (text) => {
      error = text;
      sync();
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error = null;
      result = null;
      renderResult();
      const file = fileInput.files?.[0] ?? null;
      if (!file) return fail("업로드할 파일을 선택해 주세요.");
      if (!rights.checked) return fail("직접 제작했거나 분석 권한이 있는 파일인지 확인해 주세요.");
      const body = new FormData();
      body.set("file", file);
      body.set("rightsDeclaration", JSON.stringify({ accepted: true }));
      pending = true;
      sync();
      try {
        const response = await fetch("/api/mpe/uploads", { method: "POST", body, credentials: "same-origin" });
        const payload = await response.json();
        if (!response.ok || !payload.ok || !payload.data) {
          error = UPLOAD_ERRORS[payload.error ?? ""] ?? "업로드를 접수하지 못했어요.";
        } else {
          result = payload.data;
          renderResult();
          void refreshQueue();
        }
      } catch {
        error = "네트워크 오류로 업로드를 접수하지 못했어요.";
      }
      pending = false;
      sync();
    });

    const createCandidate = async () => {
      if (!result || !title.trim()) return fail("후보 제목을 입력해 주세요.");
      error = null;
      creating = true;
      sync();
      try {
        const response = await fetch("/api/admin/mpe-candidates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "create", ingestionId: result.ingestionId, title: title.trim(), memeType }),
          credentials: "same-origin",
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          error = payload.error === "processing_jobs_not_terminal"
            ? "분석 작업이 아직 끝나지 않았어요. 잠시 후 다시 시도해 주세요."
            : payload.error === "processing_jobs_failed"
              ? "실패한 분석 작업을 재처리한 뒤 다시 시도해 주세요."
              : "후보를 생성하지 못했어요.";
        } else {
          const candidateId = payload.data?.candidate?.id;
          if (candidateId) location.assign(`/admin/mpe/${candidateId}`);
          else error = "생성된 후보 ID를 확인하지 못했어요.";
        }
      } catch {
        error = "네트워크 오류로 후보를 생성하지 못했어요.";
      }
      creating = false;
      sync();
    };
  };

  return { "mpe-upload": upload, "mpe-console": (root) => consoleControls(root, post, element) };
}

// MpeReviewConsole: every button is off while an action runs; one marked
// `data-admin-blocked` always.
function consoleControls(root, post, element) {
  const candidateId = root.dataset.adminCandidate;
  const stage = root.dataset.adminStage;
  const ingestionId = root.dataset.adminIngestion;
  const draft = root.querySelector("[data-admin-draft]");
  const reason = root.querySelector("[data-admin-reason]");
  const role = root.querySelector('[data-admin-select="role"]');
  const basis = root.querySelector('[data-admin-select="basis"]');
  const buttons = [...root.querySelectorAll("button")];
  let pending = false;

  const showMessage = (ok, text) => {
    root.querySelector(":scope > [data-admin-message]")?.remove();
    if (text === null) return;
    const message = element("p", `rounded-lg p-3 text-base ${ok ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`, text);
    message.dataset.adminMessage = "";
    message.setAttribute("role", ok ? "status" : "alert");
    root.prepend(message);
  };
  const sync = () => {
    for (const button of buttons) button.disabled = pending || button.hasAttribute("data-admin-blocked");
  };
  const run = async (action, body, success) => {
    showMessage(true, null);
    pending = true;
    sync();
    const result = await post(action, body);
    if (result === null) return;
    if (!result.ok) {
      pending = false;
      sync();
      showMessage(false, result.error);
      return;
    }
    keep({ text: success, draft: draft.value, reason: reason.value, role: role.value, basis: basis.value });
    location.reload();
  };

  const kept = takeKept();
  if (kept) {
    draft.value = kept.draft;
    reason.value = kept.reason;
    role.value = kept.role;
    basis.value = kept.basis;
    showMessage(true, kept.text);
  }

  for (const button of root.querySelectorAll("button[data-admin-reprocess]")) {
    button.addEventListener("click", () =>
      void run("mpe-reprocess", { jobId: button.dataset.adminReprocess }, "재처리를 등록하고 기존 근거 승인과 검수 단계를 초기화했어요."),
    );
  }
  for (const button of root.querySelectorAll("button[data-admin-claim]")) {
    const decision = button.dataset.adminDecision;
    button.addEventListener("click", () =>
      void run("mpe-claim", { candidateId, claimId: button.dataset.adminClaim, decision }, decision === "APPROVED" ? "주장 근거를 승인했어요." : "주장 근거를 반려했어요."),
    );
  }
  root.querySelector("button[data-admin-rights]").addEventListener("click", () => {
    if (!role.value || !basis.value) {
      showMessage(false, "출처 역할과 권리 근거를 모두 선택해 주세요.");
      return;
    }
    void run("mpe-source-rights", { ingestionId, sourceRole: role.value, rightsBasis: basis.value }, "출처 역할과 권리 근거를 저장했어요.");
  });
  root.querySelector("button[data-admin-revision]").addEventListener("click", () => {
    let parsed;
    try {
      parsed = JSON.parse(draft.value);
    } catch {
      showMessage(false, "초안 JSON 형식을 확인해 주세요.");
      return;
    }
    void run("mpe-revision", { candidateId, draft: parsed }, "수정 전·후 초안 이력을 저장했어요.");
  });
  for (const button of root.querySelectorAll("button[data-admin-review]")) {
    button.addEventListener("click", () => {
      const memo = reason.value.trim();
      void run(
        "mpe-review",
        { candidateId, stage, decision: button.dataset.adminReview, ...(memo ? { reason: memo } : {}) },
        "검수 결정을 반영했어요.",
      );
    });
  }
}
