// The forms of the sign-in pages (batch B6, src/pages/account). On Next each
// is a `useActionState` form whose server action lives in
// lib/actions/auth.ts; here the same checks run in the page and the action's
// work is the HTTP request better-auth's client would make. What the form
// shows afterwards is what the component renders for the action's state:
// the form-level message, the field errors, and the inputs reset to the
// values the state carries (React resets an action form when it finishes).
//
// `bindAuthForm(form)` is top level: the sign-in page (login.js) binds the
// form of the tab it switches to.
const bindAuthForm = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const STRONG_PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{12,}$/;
  const WEAK_PASSWORD = "비밀번호는 영문과 숫자를 포함해 12자 이상이어야 해요";
  const PASSWORD_FAILED = "비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요.";

  const postJson = (path, body) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });

  /** A `<p>` with the given attributes and text. */
  const paragraph = (attributes, text) => {
    const element = document.createElement("p");
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    element.append(text);
    return element;
  };

  // Each form: what its action does (`act`, resolving to the action's state),
  // and how the component renders a state. `messages` are the form-level
  // paragraphs in the order the component puts them first in the form;
  // `fieldError` is the class of a field's error paragraph, `hint` a field's
  // hint shown while it has no error.
  const FORMS = {
    // requestPasswordReset
    forgot: {
      async act(data) {
        const email = String(data.get("email") ?? "").trim();
        if (!email) return { fieldErrors: { email: "이메일을 입력해 주세요" } };
        if (!EMAIL_RE.test(email)) return { fieldErrors: { email: "이메일 형식이 맞지 않아요" }, values: { email } };
        // The same notice whatever the answer: it must not tell whether the
        // address has an account.
        await postJson("/api/auth/request-password-reset", { email, redirectTo: "/reset-password" }).catch(() => undefined);
        return {
          notice: "재설정 메일을 보냈어요. 메일함(스팸함도 함께) 을 확인해 주세요. 링크는 1시간 동안 유효해요.",
          values: { email },
        };
      },
      messages: [
        ["formError", { role: "alert", class: "rounded-xl bg-safety-red-bg px-4 py-3 text-sm font-semibold text-safety-red" }],
        ["notice", { role: "status", class: "rounded-xl bg-safety-green-bg px-4 py-3 text-sm font-semibold leading-relaxed text-safety-green" }],
      ],
      fieldError: "mt-1.5 text-sm font-semibold text-safety-red",
      button: (state, pending) => (pending ? "보내는 중…" : state?.notice ? "다시 보내기" : "재설정 메일 받기"),
    },
    // updatePassword: with the mail's token through better-auth's reset
    // endpoint, signed in without one through /api/account/password.
    reset: {
      async act(data) {
        const password = String(data.get("password") ?? "");
        const confirm = String(data.get("confirm") ?? "");
        const token = String(data.get("token") ?? "");
        if (!STRONG_PASSWORD_RE.test(password)) return { fieldErrors: { password: WEAK_PASSWORD } };
        if (password !== confirm) return { fieldErrors: { password: "두 비밀번호가 서로 달라요" } };
        try {
          if (token) {
            const response = await postJson("/api/auth/reset-password", { newPassword: password, token });
            return response.ok ? { redirect: "/my" } : { formError: PASSWORD_FAILED };
          }
          const response = await postJson("/api/account/password", { password, confirm });
          // A refusal in better-auth's shape (a password over 128) reads as
          // the token path reads one.
          return response.ok ? await response.json() : { formError: PASSWORD_FAILED };
        } catch {
          return { formError: PASSWORD_FAILED };
        }
      },
      messages: [
        ["formError", { role: "alert", class: "rounded-xl bg-safety-red-bg px-4 py-3 text-sm font-semibold leading-relaxed text-safety-red" }],
      ],
      fieldError: "mt-1.5 text-sm font-semibold text-safety-red",
      button: (_state, pending) => (pending ? "저장 중…" : "비밀번호 변경"),
    },
  };

  // The fields that show an error (those rendered with `aria-invalid`), each
  // with the hint it shows while it has none.
  const fieldsOf = (form) =>
    [...form.querySelectorAll("input[name][aria-invalid]")].map((input) => ({
      input,
      hint: document.getElementById(`${input.id}-hint`),
    }));

  // The login page's copy in the language the frame shows (login.js keeps
  // it current); Korean until the language changes.
  const loginCopy = () => document.pageCopy ?? {
    loginSubmit: "로그인", loginPending: "로그인 중…", signupSubmit: "가입하고 시작하기", signupPending: "가입 중…",
  };
  // `SubmitButton`: a spinner before the label while pending.
  const submitButton = (submit, pendingKey) => (form, button, _state, pending) => {
    const copy = loginCopy();
    const agree = form.querySelector('input[name="agree"]');
    button.disabled = pending || (agree ? !agree.checked : false);
    const label = pending ? copy[pendingKey] : copy[submit];
    if (pending) {
      const spinner = document.createElement("span");
      spinner.setAttribute("aria-hidden", "true");
      spinner.className = "h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white";
      button.replaceChildren(spinner, label);
    } else {
      button.replaceChildren(label);
    }
  };
  // `safeNext` has already run on the server; a tampered value goes home.
  const sameSitePath = (value) => (/^\/(?![\/\\])/.test(value) && !value.includes("\\") ? value : "/");
  const LOGIN_ERROR_CLASS = "mt-1.5 text-sm text-safety-red";
  const FORM_ERROR = ["formError", { role: "alert", class: "rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red" }];
  // lib/auth/reserved-email.ts
  const INTERNAL_DOMAINS = ["@auth.memecatch.internal", "@wallet.memecatch.internal", "@kakao.memecatch.internal"];
  const blockedPublicEmail = (email) => INTERNAL_DOMAINS.some((domain) => email.trim().toLowerCase().endsWith(domain));

  // signIn: better-auth's email sign-in, then `redirect(next)`.
  FORMS.signin = {
    async act(data) {
      const email = String(data.get("email") ?? "").trim();
      const password = String(data.get("password") ?? "");
      const next = sameSitePath(String(data.get("next") ?? "/"));
      const fieldErrors = {};
      if (!email) fieldErrors.email = "이메일을 입력해 주세요";
      else if (!EMAIL_RE.test(email)) fieldErrors.email = "이메일 형식이 맞지 않아요";
      if (!password) fieldErrors.password = "비밀번호를 입력해 주세요";
      if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values: { email } };
      const response = await postJson("/api/auth/sign-in/email", { email, password }).catch(() => null);
      if (!response?.ok) return { formError: "이메일 또는 비밀번호가 맞지 않아요", values: { email } };
      return { redirect: next };
    },
    messages: [FORM_ERROR],
    fieldError: LOGIN_ERROR_CLASS,
    renderButton: submitButton("loginSubmit", "loginPending"),
  };

  // signUp: better-auth's sign-up, then its sign-out, and the same notice
  // whatever the answer.
  FORMS.signup = {
    async act(data) {
      const nickname = String(data.get("nickname") ?? "").trim();
      const email = String(data.get("email") ?? "").trim();
      const password = String(data.get("password") ?? "");
      const fieldErrors = {};
      if (nickname.length < 2 || nickname.length > 20) fieldErrors.nickname = "닉네임은 2~20자로 지어 주세요";
      if (!email) fieldErrors.email = "이메일을 입력해 주세요";
      else if (!EMAIL_RE.test(email)) fieldErrors.email = "이메일 형식이 맞지 않아요";
      else if (blockedPublicEmail(email)) fieldErrors.email = "가입할 수 없는 이메일 도메인이에요";
      if (!STRONG_PASSWORD_RE.test(password)) fieldErrors.password = WEAK_PASSWORD;
      if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values: { email, nickname } };
      await postJson("/api/auth/sign-up/email", { email, password, name: nickname }).catch(() => undefined);
      await postJson("/api/auth/sign-out", {}).catch(() => undefined);
      return {
        notice: "가입 요청을 접수했어요. 가입 가능한 이메일이면 확인 메일을 보내요. 메일의 링크를 열기 전에는 로그인되지 않아요.",
        values: { email, nickname },
      };
    },
    // `FormNotice` comes before `FormError`.
    messages: [["notice", { role: "status", "aria-live": "polite", class: "rounded-xl bg-surface-2 px-4 py-3 text-foreground" }], FORM_ERROR],
    fieldError: LOGIN_ERROR_CLASS,
    renderButton: submitButton("signupSubmit", "signupPending"),
    // The consent box is `agreed` state: the button waits for it.
    init(form, isPending) {
      const agree = form.querySelector('input[name="agree"]');
      const button = form.querySelector('button[type="submit"]');
      agree.addEventListener("change", () => {
        button.disabled = isPending() || !agree.checked;
      });
    },
  };

  const render = (form, spec, fields, state, pending) => {
    for (const message of form.querySelectorAll(":scope > [data-form-message]")) message.remove();
    const messages = spec.messages
      .filter(([key]) => state?.[key])
      .map(([key, attributes]) => {
        const element = paragraph(attributes, state[key]);
        element.dataset.formMessage = "";
        return element;
      });
    // After the hidden inputs the form starts with, as the component puts them.
    let anchor = null;
    for (const child of form.children) {
      if (child.matches('input[type="hidden"]')) anchor = child;
      else break;
    }
    if (anchor) anchor.after(...messages);
    else form.prepend(...messages);
    for (const { input, hint } of fields) {
      const error = state?.fieldErrors?.[input.name];
      const errorId = `${input.id}-error`;
      document.getElementById(errorId)?.remove();
      input.setAttribute("aria-invalid", error ? "true" : "false");
      if (error) {
        input.setAttribute("aria-describedby", errorId);
        const element = paragraph({ id: errorId, role: "alert", class: spec.fieldError }, error);
        if (hint?.isConnected) hint.replaceWith(element);
        else input.after(element);
      } else if (hint) {
        if (!hint.isConnected) input.after(hint);
        input.setAttribute("aria-describedby", hint.id);
      } else {
        input.removeAttribute("aria-describedby");
      }
    }
    // React resets an action form when the action ends: every input that is
    // not hidden goes back to its default value, the one the state carries.
    if (!pending) {
      for (const input of form.querySelectorAll('input[name]:not([type="hidden"]):not([type="checkbox"])')) {
        input.value = state?.values?.[input.name] ?? "";
      }
    }
    const button = form.querySelector('button[type="submit"]');
    if (spec.renderButton) spec.renderButton(form, button, state, pending);
    else {
      button.disabled = pending;
      button.textContent = spec.button(state, pending);
    }
  };

  const bind = (form) => {
    const spec = FORMS[form.dataset.authForm];
    if (!spec) return;
    const fields = fieldsOf(form);
    let state = null;
    let pending = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(form);
      pending = true;
      render(form, spec, fields, state, true);
      const next = await spec.act(data);
      // `redirect()` in the action: the page moves on, the form stays pending.
      if (next?.redirect) {
        location.assign(next.redirect);
        return;
      }
      state = next;
      pending = false;
      render(form, spec, fields, state, false);
    });
    spec.init?.(form, () => pending);
  };
  for (const form of document.querySelectorAll("form[data-auth-form]")) bind(form);
  return bind;
})();
