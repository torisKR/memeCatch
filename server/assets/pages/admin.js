(() => {
"use strict";
const lib = {};
{
    const ENDPOINT = "/_axum/admin/";
    const FLASH = "memecatch-admin-flash";
    const post = async (action, body) => {
        let response;
        try {
            response = await fetch(`${ENDPOINT}${action}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
                credentials: "same-origin",
            });
        }
        catch {
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
        }
        catch {
            return { ok: false, error: "실패했어요." };
        }
    };
    const STATUS_CLASS = {
        true: "rounded-xl px-4 py-3 text-sm font-semibold bg-safety-green-bg text-safety-green",
        false: "rounded-xl px-4 py-3 text-sm font-semibold bg-safety-red-bg text-safety-red",
    };
    const showMessage = (root, ok, text) => {
        root.querySelector(":scope > [data-admin-message]")?.remove();
        if (text === null)
            return;
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
        }
        catch {
        }
    };
    const restoreFlash = () => {
        let flash = null;
        try {
            flash = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
            sessionStorage.removeItem(FLASH);
        }
        catch {
            return;
        }
        if (!flash || flash.path !== location.pathname)
            return;
        const root = [...document.querySelectorAll("[data-admin-controls]")].find((element) => element.dataset.adminControls === flash.key);
        if (root)
            showMessage(root, flash.ok, flash.text);
    };
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
                if (button.disabled)
                    return;
                showMessage(root, true, null);
                let body = JSON.parse(button.dataset.adminBody);
                if (button.hasAttribute("data-admin-needs-password"))
                    body = { ...body, password: field.value };
                pending = true;
                sync();
                const result = await post(button.dataset.adminAction, body);
                if (result === null)
                    return;
                pending = false;
                const text = result.ok ? button.dataset.adminDone : (result.error ?? "실패했어요.");
                if (result.ok)
                    field.value = "";
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
    const radarReview = (form) => {
        const buttons = [...form.querySelectorAll("button[name=decision]")];
        const row = buttons[0]?.parentElement;
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const decision = event.submitter?.value === "approved" ? "approved" : "rejected";
            const reviewNote = String(new FormData(form).get("reviewNote") ?? "");
            for (const button of buttons)
                button.disabled = true;
            const pending = document.createElement("span");
            pending.className = "text-xs text-muted";
            pending.textContent = "처리 중…";
            row?.append(pending);
            const result = await post("radar-review", { reviewId: form.dataset.adminReview, decision, reviewNote });
            if (result === null)
                return;
            pending.remove();
            for (const button of buttons)
                button.disabled = false;
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
    const refreshButtons = (errorClass) => (root) => {
        const buttons = [...root.querySelectorAll("button[data-admin-action]")];
        for (const button of buttons) {
            button.addEventListener("click", async () => {
                root.querySelector(":scope > [data-admin-message]")?.remove();
                for (const each of buttons)
                    each.disabled = true;
                const result = await post(button.dataset.adminAction, JSON.parse(button.dataset.adminBody));
                if (result === null)
                    return;
                if (result.ok) {
                    location.reload();
                    return;
                }
                for (const each of buttons)
                    each.disabled = false;
                const message = document.createElement("p");
                message.dataset.adminMessage = "";
                message.setAttribute("role", "alert");
                message.className = errorClass;
                message.textContent = result.error ?? "실패했어요.";
                root.prepend(message);
            });
        }
    };
    const COMPONENTS = {
        user: userControls,
        "radar-review": radarReview,
        report: refreshButtons("rounded-lg bg-safety-red-bg p-3 text-base text-safety-red"),
    };
    for (const root of document.querySelectorAll("[data-admin-controls]")) {
        COMPONENTS[root.dataset.adminControls]?.(root);
    }
    restoreFlash();
}
})();
