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

  const COMPONENTS = { user: userControls };
  for (const root of document.querySelectorAll("[data-admin-controls]")) {
    COMPONENTS[root.dataset.adminControls]?.(root);
  }
  restoreFlash();
}
