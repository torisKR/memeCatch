// app/(default)/login/login-form.tsx: the sign-in page's tabs, its headings
// and its social buttons (src/pages/account/login.rs). The two forms are
// auth-forms.js forms, each kept in a template; a tab switch mounts a fresh
// copy of the other, as Next unmounts one form and mounts the other. The
// copy follows the language switch through core.js (`data-i18n`).
{
  const root = document.querySelector("[data-login]");
  if (root) {
    const slot = root.querySelector("[data-login-slot]");
    const notice = root.querySelector("[data-login-notice]");
    const next = root.dataset.loginNext || "/";
    // The active form as rendered, before any input, joins the other's
    // template, so both follow the language switch.
    const own = document.createElement("template");
    own.dataset.loginForm = root.dataset.login;
    own.content.append(slot.firstElementChild.cloneNode(true));
    root.after(own);
    const templateFor = (mode) => document.querySelector(`template[data-login-form="${mode}"]`);
    // Korean until the language switch brings other copy.
    const KO = {
      loginTitle: "다시 만나서 반가워요",
      signupTitle: "밈캐치에 어서 오세요",
      loginDescription: "로그인하면 밈 저장과 제보를 이어서 할 수 있어요.",
      signupDescription: "가입하면 밈을 저장하고 직접 제보할 수 있어요.",
      providerNames: { kakao: "카카오", google: "구글" },
      oauthUnavailable: "{provider} 로그인은 곧 열려요. 지금은 이메일로 시작해 주세요.",
    };
    let mode = root.dataset.login;
    const text = (key) => (document.pageCopy ?? KO)[key];
    const applyHeading = () => {
      root.querySelector("[data-login-title]").textContent = text(mode === "login" ? "loginTitle" : "signupTitle");
      root.querySelector("[data-login-description]").textContent = text(mode === "login" ? "loginDescription" : "signupDescription");
    };
    document.addEventListener("memecatch:page-copy", applyHeading);

    // The tabs: the pill moves to the chosen one, and its form is mounted.
    const pill = root.querySelector("[data-login-pill]");
    for (const tab of root.querySelectorAll("[data-login-tab]")) {
      tab.addEventListener("click", () => {
        const chosen = tab.dataset.loginTab;
        if (chosen === mode) return;
        mode = chosen;
        for (const other of root.querySelectorAll("[data-login-tab]")) {
          const on = other === tab;
          other.setAttribute("aria-selected", String(on));
          other.classList.toggle("text-foreground", on);
          other.classList.toggle("text-muted", !on);
        }
        tab.prepend(pill);
        const form = templateFor(mode).content.firstElementChild.cloneNode(true);
        slot.replaceChildren(form);
        bindAuthForm(form);
        applyHeading();
      });
    }

    // The social buttons: while one starts, both are disabled and its icon
    // is a spinner; a provider that gives no URL is not open yet.
    const SPINNER = { kakao: "border-[#191600]/30 border-t-[#191600]", google: "border-muted/30 border-t-muted" };
    const providers = [...root.querySelectorAll("[data-login-provider]")];
    let busy = null;
    const setBusy = (provider) => {
      busy = provider;
      for (const button of providers) {
        button.disabled = Boolean(provider);
        const icon = button.firstElementChild;
        if (button.dataset.loginProvider === provider) {
          const spinner = document.createElement("span");
          spinner.setAttribute("aria-hidden", "true");
          spinner.className = `h-4 w-4 animate-spin rounded-full border-2 ${SPINNER[provider]}`;
          button.icon = icon;
          icon.replaceWith(spinner);
        } else if (button.icon) {
          icon.replaceWith(button.icon);
          button.icon = null;
        }
      }
    };
    for (const button of providers) {
      button.addEventListener("click", async () => {
        if (busy) return;
        const provider = button.dataset.loginProvider;
        setBusy(provider);
        notice.textContent = "";
        if (await startSocialSignIn(provider, next)) return;
        setBusy(null);
        notice.textContent = text("oauthUnavailable").replace("{provider}", text("providerNames")[provider]);
      });
    }
  }
}
