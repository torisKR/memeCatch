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

  const COMPONENTS = {
    user: userControls,
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
