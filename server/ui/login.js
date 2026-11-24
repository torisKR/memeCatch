// app/(default)/login/login-form.tsx: the sign-in page's tabs, its social
// buttons, and its copy, which follows the language switch (src/pages/
// account/login.rs). The two forms are auth-forms.js forms; a tab switch
// mounts the other form fresh, as Next unmounts one and mounts the other.
{
  const root = document.querySelector("[data-login]");
  if (root) {
    const slot = root.querySelector("[data-login-slot]");
    const notice = root.querySelector("[data-login-notice]");
    const next = root.dataset.loginNext || "/";
    // Each tab's form as the server rendered it: the active one before any
    // input, the other from its template.
    const pristine = { [root.dataset.login]: slot.firstElementChild.cloneNode(true) };
    for (const template of document.querySelectorAll("template[data-login-form]")) {
      pristine[template.dataset.loginForm] = template.content.firstElementChild.cloneNode(true);
    }
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
    let copy = null;
    const text = (key) => (copy ?? KO)[key];

    // The copy of `LOGIN_COPY[locale]` on every part that shows it.
    const applyCopy = (scope) => {
      if (!copy) return;
      for (const element of scope.querySelectorAll("[data-login-text]")) {
        const value = text(element.dataset.loginText);
        if (value === undefined) continue;
        const last = [...element.childNodes].reverse().find((node) => node.nodeType === 3 && node.data.trim());
        if (last) last.data = value;
        else element.textContent = value;
      }
      for (const element of scope.querySelectorAll("[data-login-lead]")) {
        const first = [...element.childNodes].find((node) => node.nodeType === 3);
        if (first) first.data = `${text(element.dataset.loginLead)} `;
      }
      for (const element of scope.querySelectorAll("[data-login-placeholder]")) {
        element.placeholder = text(element.dataset.loginPlaceholder);
      }
      for (const element of scope.querySelectorAll("[data-login-label]")) {
        element.setAttribute("aria-label", text(element.dataset.loginLabel));
      }
    };
    const applyHeading = () => {
      root.querySelector("[data-login-title]").textContent = text(mode === "login" ? "loginTitle" : "signupTitle");
      root.querySelector("[data-login-description]").textContent = text(mode === "login" ? "loginDescription" : "signupDescription");
    };

    document.addEventListener("memecatch:frame", (event) => {
      if (!event.detail?.login) return;
      copy = event.detail.login;
      // auth-forms.js reads the submit labels from here.
      root.loginCopy = copy;
      applyCopy(root);
      for (const form of Object.values(pristine)) applyCopy(form);
      applyHeading();
    });

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
        const form = pristine[mode].cloneNode(true);
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
