// The operator screens (pages/admin): the client parts of components/admin/*
// over the action endpoints of routes/admin (POST /_axum/admin/<action>,
// the action's argument as JSON, its ActionResult back).
//
// Where Next re-renders the page after an action (revalidatePath, then the
// server components update in place), the page is reloaded and the message
// the component showed is shown again: the same end state.
{
  const ENDPOINT = "/_axum/admin/";
  const FLASH = "memecatch-admin-flash";

  // The proxy sends a POST under /admin without a session to /login and a
  // non-operator's to /: the browser follows it as a navigation.
  const post = async (action, body) => {
    let response;
    try {
      response = await fetch(`${ENDPOINT}${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
    } catch {
      return { ok: false, error: "실패했어요." };
    }
    if (response.status === 401) {
      location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
      return null;
    }
    if (response.status === 403) {
      location.assign("/");
      return null;
    }
    try {
      return await response.json();
    } catch {
      return { ok: false, error: "실패했어요." };
    }
  };

  const STATUS_CLASS = {
    true: "rounded-xl px-4 py-3 text-sm font-semibold bg-safety-green-bg text-safety-green",
    false: "rounded-xl px-4 py-3 text-sm font-semibold bg-safety-red-bg text-safety-red",
  };

  // The `{msg && <p role=…>}` at the top of a component.
  const showMessage = (root, ok, text) => {
    root.querySelector(":scope > [data-admin-message]")?.remove();
    if (text === null) return;
    const message = document.createElement("p");
    message.dataset.adminMessage = "";
    message.setAttribute("role", ok ? "status" : "alert");
    message.className = STATUS_CLASS[ok];
    message.textContent = text;
    root.prepend(message);
  };

  const keepForReload = (root, ok, text) => {
    try {
      sessionStorage.setItem(FLASH, JSON.stringify({ path: location.pathname, key: root.dataset.adminControls, ok, text }));
    } catch {
      // Without storage the page still reloads, without the message.
    }
  };

  const restoreFlash = () => {
    let flash = null;
    try {
      flash = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
      sessionStorage.removeItem(FLASH);
    } catch {
      return;
    }
    if (!flash || flash.path !== location.pathname) return;
    const root = [...document.querySelectorAll("[data-admin-controls]")].find((element) => element.dataset.adminControls === flash.key);
    if (root) showMessage(root, flash.ok, flash.text);
  };

  // components/admin/user-controls.tsx: every button is off while one runs;
  // "직접 설정" also until the password has eight characters; a success
  // empties the field.
  const userControls = (root) => {
    const field = root.querySelector("[data-admin-password]");
    const buttons = [...root.querySelectorAll("button[data-admin-action]")];
    const alwaysOff = new Set(buttons.filter((button) => button.disabled && !button.hasAttribute("data-admin-needs-password")));
    let pending = false;
    const sync = () => {
      for (const button of buttons) {
        const short = button.hasAttribute("data-admin-needs-password") && field.value.length < 8;
        button.disabled = pending || alwaysOff.has(button) || short;
      }
    };
    field?.addEventListener("input", sync);
    for (const button of buttons) {
      button.addEventListener("click", async () => {
        if (button.disabled) return;
        showMessage(root, true, null);
        let body = JSON.parse(button.dataset.adminBody);
        if (button.hasAttribute("data-admin-needs-password")) body = { ...body, password: field.value };
        pending = true;
        sync();
        const result = await post(button.dataset.adminAction, body);
        if (result === null) return;
        pending = false;
        const text = result.ok ? button.dataset.adminDone : (result.error ?? "실패했어요.");
        if (result.ok) field.value = "";
        sync();
        if (result.ok && button.hasAttribute("data-admin-refresh")) {
          keepForReload(root, true, text);
          location.reload();
          return;
        }
        showMessage(root, Boolean(result.ok), text);
      });
    }
  };

  // app/(default)/admin/radar-safety/review-form.tsx: the button pressed is
  // the decision; "처리 중…" while it runs; React resets the form after the
  // action. A success re-renders the list without this proposal.
  const radarReview = (form) => {
    const buttons = [...form.querySelectorAll("button[name=decision]")];
    const row = buttons[0]?.parentElement;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const decision = event.submitter?.value === "approved" ? "approved" : "rejected";
      const reviewNote = String(new FormData(form).get("reviewNote") ?? "");
      for (const button of buttons) button.disabled = true;
      const pending = document.createElement("span");
      pending.className = "text-xs text-muted";
      pending.textContent = "처리 중…";
      row?.append(pending);
      const result = await post("radar-review", { reviewId: form.dataset.adminReview, decision, reviewNote });
      if (result === null) return;
      pending.remove();
      for (const button of buttons) button.disabled = false;
      form.reset();
      if (result.ok) {
        location.reload();
        return;
      }
      form.querySelector(":scope > [data-admin-message]")?.remove();
      const message = document.createElement("p");
      message.dataset.adminMessage = "";
      message.setAttribute("role", "alert");
      message.className = "text-sm text-danger";
      message.textContent = result.error ?? "실패했어요.";
      form.append(message);
    });
  };

  // Buttons whose success is `router.refresh()` and whose failure is an
  // alert above them (components/admin/report-actions.tsx): every button is
  // off while one runs.
  const refreshButtons = (errorClass) => (root) => {
    const buttons = [...root.querySelectorAll("button[data-admin-action]")];
    for (const button of buttons) {
      button.addEventListener("click", async () => {
        root.querySelector(":scope > [data-admin-message]")?.remove();
        for (const each of buttons) each.disabled = true;
        const result = await post(button.dataset.adminAction, JSON.parse(button.dataset.adminBody));
        if (result === null) return;
        if (result.ok) {
          location.reload();
          return;
        }
        for (const each of buttons) each.disabled = false;
        const message = document.createElement("p");
        message.dataset.adminMessage = "";
        message.setAttribute("role", "alert");
        message.className = errorClass;
        message.textContent = result.error ?? "실패했어요.";
        root.prepend(message);
      });
    }
  };

  // components/admin/inquiry-actions.tsx: "답변 저장" needs a reply that is not
  // blank and reads "저장 중…" while either action runs.
  const inquiryActions = (root) => {
    const field = root.querySelector("textarea");
    const answer = root.querySelector("[data-admin-answer]");
    const toggle = root.querySelector("[data-admin-status]");
    let pending = false;
    const sync = () => {
      answer.disabled = pending || field.value.trim().length === 0;
      toggle.disabled = pending;
      answer.textContent = pending ? "저장 중…" : "답변 저장";
    };
    field.addEventListener("input", sync);
    const run = async (action, body) => {
      if (pending) return;
      root.querySelector("[data-admin-message]")?.remove();
      pending = true;
      sync();
      const result = await post(action, body);
      if (result === null) return;
      if (result.ok) {
        location.reload();
        return;
      }
      pending = false;
      sync();
      const message = document.createElement("p");
      message.dataset.adminMessage = "";
      message.setAttribute("role", "alert");
      message.className = "mt-1.5 text-sm font-medium text-foreground";
      message.textContent = result.error ?? "실패했어요.";
      field.after(message);
    };
    const inquiryId = root.dataset.adminInquiry;
    answer.addEventListener("click", () => run("inquiry-answer", { inquiryId, reply: field.value }));
    toggle.addEventListener("click", () => run("inquiry-status", { inquiryId, status: toggle.dataset.adminStatus }));
  };

  // components/admin/contribution-review.tsx: approve, or "반려" to ask for a
  // reason first. Fields are off while it runs; a success re-renders the
  // queue without this item.
  const contributionReview = (root) => {
    const buttons = root.querySelector("[data-admin-buttons]");
    const approve = root.querySelector("[data-admin-approve]");
    const openReject = root.querySelector("[data-admin-open-reject]");
    const rejectTemplate = root.querySelector("template[data-admin-reject]");
    const rejectButtonsTemplate = root.querySelector("template[data-admin-reject-buttons]");
    let mode = "idle";
    let pending = false;
    let reject = null;
    let rejectButtons = [];
    const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
    const sync = () => {
      for (const input of root.querySelectorAll("[data-admin-field]")) input.disabled = pending;
      approve.disabled = pending || mode === "reject";
      approve.textContent = pending ? "처리 중…" : "승인 → 문서에 반영";
      openReject.disabled = pending;
      const [submit, cancel] = rejectButtons;
      if (submit) submit.disabled = pending || !field("rejectReason").value.trim();
      if (cancel) cancel.disabled = pending;
    };
    const setMode = (next) => {
      mode = next;
      reject?.remove();
      for (const button of rejectButtons) button.remove();
      reject = null;
      rejectButtons = [];
      openReject.hidden = mode === "reject";
      if (mode === "reject") {
        reject = rejectTemplate.content.firstElementChild.cloneNode(true);
        buttons.before(reject);
        rejectButtons = [...rejectButtonsTemplate.content.children].map((button) => button.cloneNode(true));
        buttons.append(...rejectButtons);
        field("rejectReason").addEventListener("input", sync);
        rejectButtons[0].addEventListener("click", () => submit("reject"));
        rejectButtons[1].addEventListener("click", () => setMode("idle"));
      }
      sync();
    };
    const kind = root.dataset.adminKind;
    const submit = async (decision) => {
      root.querySelector(":scope > [data-admin-message]")?.remove();
      pending = true;
      sync();
      const value = (name) => field(name)?.value;
      const result = await post("contribution-review", {
        contributionId: root.dataset.adminContribution,
        decision,
        sourceTitle: kind === "source" ? value("sourceTitle") : undefined,
        situation: kind === "example" ? value("situation") : undefined,
        text: kind === "example" ? value("text") : undefined,
        rejectReason: decision === "reject" ? value("rejectReason") : undefined,
      });
      if (result === null) return;
      if (result.ok) {
        location.reload();
        return;
      }
      pending = false;
      sync();
      const message = document.createElement("p");
      message.dataset.adminMessage = "";
      message.setAttribute("role", "status");
      message.className = "rounded-lg p-3 text-base bg-safety-red-bg text-safety-red";
      message.textContent = result.error ?? "실패했어요.";
      (reject ?? buttons).before(message);
    };
    approve.addEventListener("click", () => submit("approve"));
    openReject.addEventListener("click", () => setMode("reject"));
  };

  const SAFETY_ICON = { green: "●", yellow: "▲", gray: "◌", red: "✕" };
  const MESSAGE_CLASS = {
    error: "rounded-lg p-3 text-base bg-safety-red-bg text-safety-red",
    warning: "rounded-lg p-3 text-base bg-safety-yellow-bg text-safety-yellow",
    success: "rounded-lg p-3 text-base bg-safety-green-bg text-safety-green",
  };
  const MODE_CLASS = {
    approve: ["border-safety-green", "bg-safety-green-bg", "text-safety-green"],
    reject: ["border-safety-red", "bg-safety-red-bg", "text-safety-red"],
  };

  // components/admin/submission-review.tsx. The forms keep what was typed
  // while closed (React keeps it in the parent's state).
  const submissionReview = (root) => {
    const submissionId = root.dataset.adminSubmission;
    const heading = root.querySelector("h2");
    const claimButton = root.querySelector("[data-admin-claim]");
    const draftButton = root.querySelector("[data-admin-draft]");
    const hasKey = draftButton.dataset.adminKey === "1";
    const modeButtons = [...root.querySelectorAll("[data-admin-mode]")];
    const forms = {};
    for (const template of root.querySelectorAll("template[data-admin-form]")) {
      forms[template.dataset.adminForm] = template.content.firstElementChild.cloneNode(true);
    }
    let mode = "idle";
    let pending = false;
    let drafting = false;
    let saved = null;
    let message = null;
    const field = (form, name) => forms[form].querySelector(`[data-admin-field="${name}"]`);
    const busy = () => pending || drafting || saved !== null;
    const render = () => {
      root.querySelector(":scope > [data-admin-message]")?.remove();
      root.querySelector(":scope > [data-admin-saved]")?.remove();
      if (message) {
        const p = document.createElement("p");
        p.dataset.adminMessage = "";
        p.setAttribute("role", message.kind === "warning" ? "alert" : "status");
        p.className = MESSAGE_CLASS[message.kind];
        p.textContent = message.text;
        heading.after(p);
        if (saved && (message.kind === "warning" || message.kind === "error")) {
          const links = document.createElement("div");
          links.dataset.adminSaved = "";
          links.className = "flex flex-wrap gap-x-4 gap-y-2 text-base";
          const link = (href, text) => {
            const a = document.createElement("a");
            a.href = href;
            a.className = "text-accent-text underline";
            a.textContent = text;
            return a;
          };
          links.append(
            link(`/admin/memes/${saved.id}`, `${saved.published ? "게시된 밈 관리" : "등록된 밈 관리"} (ID: ${saved.id})`),
            link(`/admin/submissions/${submissionId}`, `제보 상태 확인 (ID: ${submissionId})`),
          );
          p.after(links);
        }
      }
      if (claimButton) {
        claimButton.disabled = busy();
        claimButton.textContent = pending ? "처리 중…" : "내가 검토하기 (claim)";
      }
      draftButton.disabled = busy() || !hasKey;
      draftButton.textContent = drafting ? "GPT 검수 중…" : "GPT-5.6 Sol high로 검수 초안";
      for (const button of modeButtons) {
        button.disabled = busy();
        const on = mode === button.dataset.adminMode;
        button.classList.toggle("border-border", !on);
        button.classList.toggle("bg-surface-2", !on);
        for (const name of MODE_CLASS[button.dataset.adminMode]) button.classList.toggle(name, on);
      }
      for (const [name, form] of Object.entries(forms)) {
        if (name === mode && !form.isConnected) root.append(form);
        if (name !== mode) form.remove();
        const submit = form.querySelector("button[type=submit]");
        submit.disabled = busy();
        submit.textContent = pending ? (name === "approve" ? "생성 중…" : "처리 중…") : name === "approve" ? "밈 생성 및 게시" : "반려하기";
      }
      for (const label of forms.reject.querySelectorAll("[data-admin-choice]")) {
        const on = label.querySelector("input").checked;
        label.classList.toggle("border-border", !on);
        label.classList.toggle("bg-surface-2", !on);
        for (const name of ["border-safety-red", "bg-safety-red-bg", "font-semibold", "text-safety-red"]) label.classList.toggle(name, on);
      }
    };
    const say = (kind, text) => {
      message = text === null ? null : { kind, text };
      render();
    };
    for (const select of forms.approve.querySelectorAll("select[data-admin-field]")) {
      select.addEventListener("change", () => {
        const icon = select.parentElement.querySelector("[data-admin-safety-icon]");
        if (!icon) return;
        icon.textContent = SAFETY_ICON[select.value];
        icon.style.color = `var(--safety-${select.value})`;
      });
    }
    const setSafety = (name, value) => {
      const select = field("approve", name);
      select.value = value;
      select.dispatchEvent(new Event("change"));
    };
    for (const radio of forms.reject.querySelectorAll("input[type=radio]")) radio.addEventListener("change", render);
    for (const button of modeButtons) {
      button.addEventListener("click", () => {
        mode = mode === button.dataset.adminMode ? "idle" : button.dataset.adminMode;
        render();
      });
    }
    claimButton?.addEventListener("click", async () => {
      say(null, null);
      pending = true;
      render();
      const result = await post("submission-claim", submissionId);
      if (result === null) return;
      if (result.ok) {
        location.reload();
        return;
      }
      pending = false;
      say("error", result.error);
    });
    draftButton.addEventListener("click", async () => {
      say(null, null);
      drafting = true;
      render();
      const result = await post("submission-draft", submissionId);
      drafting = false;
      if (result === null) return;
      if (!result.ok) {
        say("error", result.error);
        return;
      }
      const draft = result.data;
      field("approve", "summary").value = draft.summary;
      field("approve", "description").value = draft.description;
      field("approve", "origin").value = draft.origin;
      setSafety("safetyLevel", draft.safety_level);
      for (const key of ["work", "friends", "family", "sns"]) setSafety(`usage.${key}`, draft.usage_context[key]);
      mode = "approve";
      say("success", "GPT-5.6 Sol high 검수 초안을 채웠어요. 내용을 검토하고 수정해 주세요.");
    });
    forms.approve.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (saved) return;
      say(null, null);
      const yearText = field("approve", "originYear").value;
      const year = yearText.trim() ? Number(yearText) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
        say("error", "연도는 1980~2100 사이 숫자로 입력해 주세요.");
        return;
      }
      pending = true;
      render();
      const value = (name) => field("approve", name).value;
      const result = await post("submission-approve", {
        submissionId,
        title: value("title"),
        summary: value("summary"),
        description: value("description"),
        origin: value("origin"),
        safetyLevel: value("safetyLevel"),
        category: value("category"),
        difficulty: value("difficulty"),
        originYear: year,
        tags: value("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
        usageContext: Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, value(`usage.${key}`)])),
      });
      if (result === null) return;
      pending = false;
      if (!result.ok) {
        if (result.createdMemeId) saved = { id: result.createdMemeId, published: false };
        say("error", result.error);
        return;
      }
      saved = { id: result.data.memeId, published: true };
      if (result.data.warning) {
        say("warning", result.data.warning);
        return;
      }
      location.assign("/admin/submissions");
    });
    forms.reject.addEventListener("submit", async (event) => {
      event.preventDefault();
      say(null, null);
      const category = forms.reject.querySelector("input[type=radio]:checked")?.value ?? "";
      const reason = field("reject", "rejectReason").value;
      if (!category) {
        say("error", "반려 사유 카테고리를 선택해 주세요.");
        return;
      }
      if (!reason.trim()) {
        say("error", "반려 사유를 입력해 주세요.");
        return;
      }
      pending = true;
      render();
      const result = await post("submission-reject", { submissionId, category, reason });
      if (result === null) return;
      pending = false;
      if (!result.ok) {
        say("error", result.error);
        return;
      }
      location.assign("/admin/submissions");
    });
    render();
  };

  // components/admin/source-review-card.tsx: the preview becomes the player;
  // a decision takes the candidate off the queue.
  const sourceReview = (root) => {
    const preview = root.querySelector("[data-admin-preview]");
    preview?.addEventListener("click", () => {
      if (preview.disabled || !root.dataset.adminEmbed) return;
      const frame = document.createElement("iframe");
      frame.src = root.dataset.adminEmbed;
      frame.title = root.dataset.adminEmbedTitle;
      frame.className = `${preview.dataset.adminPreviewClass} rounded-lg border border-border bg-black`;
      frame.loading = "lazy";
      frame.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture";
      frame.allowFullscreen = true;
      preview.replaceWith(frame);
    });
    const buttons = [...root.querySelectorAll("[data-admin-decision]")];
    const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
    for (const button of buttons) {
      button.addEventListener("click", async () => {
        root.querySelector("[data-admin-message]")?.remove();
        for (const each of buttons) each.disabled = true;
        const decision = button.dataset.adminDecision;
        const note = field("note").value;
        const result = await post("source-review", {
          ...JSON.parse(root.dataset.adminBody),
          decision,
          sourceRole: field("sourceRole").value,
          rightsBasis: field("rightsBasis").value,
          note: note || undefined,
        });
        if (result === null) return;
        for (const each of buttons) each.disabled = false;
        if (!result.ok) {
          const message = document.createElement("p");
          message.dataset.adminMessage = "";
          message.className = "text-sm text-safety-red";
          message.textContent = result.error ?? "실패했어요.";
          field("note").after(message);
          return;
        }
        // The component would show "승인했어요." or "반려했어요.", but the action's
        // revalidatePath re-renders the queue without this candidate first.
        location.reload();
      });
    }
  };

  const INGESTION = "/api/admin/source-ingestions";
  const INGESTION_KEY = "memecatch-admin-ingestion";
  const INGEST_PLATFORM = { youtube: "YouTube", youtube_shorts: "YouTube Shorts", tiktok: "TikTok", instagram: "Instagram" };
  const RIGHTS_MODE = { METADATA_ONLY: "메타데이터 전용", official_embed: "공식 임베드", api_metadata: "API 메타데이터", link_only: "링크 전용" };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const ingestionData = (payload) => {
    const data = payload && payload.ok === true ? payload.data : null;
    return data && typeof data.status === "string" && typeof data.platform === "string" && typeof data.canonicalUrl === "string"
      && typeof data.rightsMode === "string" && typeof data.duplicate === "boolean" ? data : null;
  };

  // components/admin/source-ingestion-form.tsx. Next refreshes the page and
  // keeps the result box; here it is kept across the reload.
  const sourceIngestion = (root) => {
    const form = root.querySelector("form");
    const url = root.querySelector('[data-admin-field="url"]');
    const target = root.querySelector('[data-admin-field="targetMemeId"]');
    const submitButton = form.querySelector("button[type=submit]");
    const noMemes = submitButton.disabled;
    let pending = false;
    let failedInput = null;
    const clear = () => root.querySelectorAll("[data-admin-result]").forEach((node) => node.remove());
    const showFailure = (failure) => {
      clear();
      const box = element("div", "mt-4 rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red");
      box.dataset.adminResult = "";
      box.setAttribute("role", "alert");
      box.append(element("p", "", failure.error), element("p", "mt-1 text-xs", "자동 메타데이터 확인 결과일 뿐, 원본성이나 권리를 승인한 것은 아니에요."));
      if (failure.retryable && failedInput) {
        const retry = element("button", "mt-3 min-h-11 rounded-lg border border-current px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50", "같은 입력으로 다시 확인");
        retry.type = "button";
        retry.addEventListener("click", () => submit(true, retry));
        box.append(retry);
      }
      root.append(box);
    };
    const showResult = (result) => {
      clear();
      const box = element("div", "mt-4 rounded-lg bg-safety-green-bg p-3 text-sm text-safety-green");
      box.dataset.adminResult = "";
      box.setAttribute("role", "status");
      box.append(element("p", "font-semibold", result.duplicate ? "이미 등록된 출처예요." : "검수 대기 후보를 만들었어요."));
      if (result.warning === "recovery_resolution_failed") {
        box.append(element("p", "mt-2 rounded-lg bg-safety-yellow-bg p-3 text-sm text-safety-yellow", "출처 접수는 성공했어요. 다만 이전 복구 기록 정리가 완료되지 않았어요. 이 성공한 접수를 다시 제출하지 말고, 아래 복구 상태에서 운영자가 확인해 주세요."));
      }
      const list = element("dl", "mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]");
      const status = result.duplicate || result.status === "duplicate" ? "중복" : result.status === "metadata_ready" ? "메타데이터 준비" : "검수 대기";
      const rows = [["플랫폼", INGEST_PLATFORM[result.platform] ?? result.platform], ["권리 모드", RIGHTS_MODE[result.rightsMode] ?? result.rightsMode], ["상태", status]];
      if (!result.duplicate) rows.push(["다음 단계", "운영자 검수 후에만 공개돼요."]);
      for (const [term, value] of rows) list.append(element("dt", "", term), element("dd", "", value));
      const link = element("a", "block truncate text-accent-text underline underline-offset-2", result.canonicalUrl);
      link.href = result.canonicalUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const dd = element("dd", "min-w-0");
      dd.append(link);
      list.append(element("dt", "", "정규 URL"), dd);
      box.append(list);
      root.append(box);
    };
    const submit = async (retry, retryButton) => {
      if (pending) return;
      if (retry && (!failedInput || failedInput.url !== url.value || failedInput.targetMemeId !== target.value)) {
        failedInput = null;
        showFailure({ error: "입력한 URL 또는 연결할 밈이 바뀌었어요. 현재 값으로 다시 시도해 주세요.", retryable: false });
        return;
      }
      pending = true;
      submitButton.disabled = true;
      submitButton.textContent = "수집 중…";
      if (retryButton) {
        retryButton.disabled = true;
        retryButton.textContent = "다시 확인 중…";
      } else clear();
      const input = { url: url.value, targetMemeId: target.value };
      try {
        const response = await fetch(INGESTION, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, ...(retry ? { retry: true } : {}) }),
        });
        const payload = await response.json();
        const data = ingestionData(payload);
        if (!response.ok || !data) {
          const error = typeof payload?.error === "string" ? payload.error : null;
          failedInput = input;
          showFailure(error === null
            ? { error: "출처를 수집하지 못했어요. 잠시 후 다시 시도해 주세요.", retryable: true }
            : { error, retryable: typeof payload.code === "string" && typeof payload.retryable === "boolean" ? payload.retryable : false });
          return;
        }
        try {
          sessionStorage.setItem(INGESTION_KEY, JSON.stringify(data));
        } catch {
          // The reload then shows the page without the box.
        }
        location.reload();
        return;
      } catch {
        failedInput = input;
        showFailure({ error: "출처를 수집하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.", retryable: true });
      } finally {
        pending = false;
        submitButton.disabled = noMemes;
        submitButton.textContent = "검수 후보 만들기";
      }
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void submit(false);
    });
    try {
      const kept = JSON.parse(sessionStorage.getItem(INGESTION_KEY) ?? "null");
      sessionStorage.removeItem(INGESTION_KEY);
      if (kept) showResult(kept);
    } catch {
      // Nothing kept.
    }
  };

  // components/admin/source-recovery-panel.tsx: a manual retry per entry.
  const sourceRecovery = (root) => {
    let pending = null;
    const buttons = [...root.querySelectorAll("li[data-admin-recovery] button")];
    const say = (kind, text) => {
      root.querySelector(":scope > [data-admin-message]")?.remove();
      const message = element("p", `mt-4 rounded-lg p-3 text-sm ${kind === "error" ? "bg-safety-red-bg text-safety-red" : "bg-safety-green-bg text-safety-green"}`, text);
      message.dataset.adminMessage = "";
      message.setAttribute("role", kind === "error" ? "alert" : "status");
      root.append(message);
    };
    for (const button of buttons) {
      const item = button.closest("li");
      const label = button.textContent;
      button.addEventListener("click", async () => {
        const targetMemeId = item.querySelector("select").value;
        if (!targetMemeId || !item.dataset.adminUrl) {
          say("error", "재시도할 URL과 연결할 밈을 모두 선택해 주세요. 기존 source_id가 없어도 밈을 추측하지 않아요.");
          return;
        }
        if (pending) return;
        pending = item;
        root.querySelector(":scope > [data-admin-message]")?.remove();
        for (const each of buttons) each.disabled = true;
        button.textContent = "다시 확인 중…";
        try {
          const response = await fetch(INGESTION, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: item.dataset.adminUrl, targetMemeId, retry: true }),
          });
          const payload = await response.json();
          if (!response.ok || !payload || typeof payload !== "object" || payload.ok !== true) {
            say("error", "수동 재시도를 기록하지 못했어요. 입력과 운영자 권한을 확인해 주세요.");
            return;
          }
          say("success", payload.warning === "recovery_resolution_failed"
            ? "출처 재확인은 성공했어요. 다만 이전 복구 기록 정리가 완료되지 않았어요. 이 성공한 요청을 다시 제출하지 말고 상태를 운영자 검토 대상으로 남겨 주세요."
            : "같은 출처를 선택한 밈에 다시 확인 요청했어요. 승인이나 원본 확인을 뜻하지 않아요.");
        } catch {
          say("error", "수동 재시도에 실패했어요. 네트워크 상태를 확인해 주세요.");
        } finally {
          pending = null;
          for (const each of buttons) each.disabled = false;
          button.textContent = label;
        }
      });
    }
  };

  const COMPONENTS = {
    user: userControls,
    "source-ingestion": sourceIngestion,
    "source-recovery": sourceRecovery,
    "source-review": sourceReview,
    submission: submissionReview,
    contribution: contributionReview,
    inquiry: inquiryActions,
    "radar-review": radarReview,
    report: refreshButtons("rounded-lg bg-safety-red-bg p-3 text-base text-safety-red"),
  };
  for (const root of document.querySelectorAll("[data-admin-controls]")) {
    COMPONENTS[root.dataset.adminControls]?.(root);
  }
  restoreFlash();
}
