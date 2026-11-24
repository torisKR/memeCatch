// app/(default)/onboarding/onboarding-form.tsx (src/pages/account/
// onboarding.rs): the chips are the form's state, kept in hidden inputs in
// the order the component renders them, and the form posts its inputs to
// POST /api/account/onboarding (`completeOnboarding`), which answers where
// to go. When the action fails, the segment's error page takes the place of
// <main>, as on Next.
{
  const form = document.querySelector("form[data-onboarding]");
  if (form) {
    const on = form.dataset.chipOn.split(" ");
    const off = form.dataset.chipOff.split(" ");
    const values = (name) => [...form.querySelectorAll(`input[type="hidden"][name="${name}"]`)].map((input) => input.value);
    let interests = values("interests");
    let platforms = values("preferred_platforms");
    const single = (name) => form.querySelector(`input[type="hidden"][name="${name}"]`);

    const hidden = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      return input;
    };
    // `[...interests]` before age_group, `[...preferredPlatforms]` after use_purpose.
    const writeLists = () => {
      for (const input of form.querySelectorAll('input[name="interests"], input[name="preferred_platforms"]')) input.remove();
      single("age_group").before(...interests.map((value) => hidden("interests", value)));
      single("use_purpose").after(...platforms.map((value) => hidden("preferred_platforms", value)));
    };
    const paint = (button, active, attribute) => {
      button.setAttribute(attribute, String(active));
      button.classList.remove(...(active ? off : on));
      button.classList.add(...(active ? on : off));
    };
    const repaint = () => {
      for (const button of form.querySelectorAll("[data-onboarding-interest]")) {
        paint(button, button.dataset.onboardingInterest.split(" ").some((category) => interests.includes(category)), "aria-pressed");
      }
      for (const button of form.querySelectorAll("[data-onboarding-platform]")) {
        paint(button, platforms.includes(button.dataset.onboardingPlatform), "aria-pressed");
      }
      for (const button of form.querySelectorAll("[data-onboarding-purpose]")) {
        paint(button, single("use_purpose").value === button.dataset.onboardingPurpose, "aria-checked");
      }
      for (const button of form.querySelectorAll("[data-onboarding-age]")) {
        paint(button, single("age_group").value === button.dataset.onboardingAge, "aria-checked");
      }
    };

    form.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("button[type='button']") : null;
      if (!button) return;
      if (button.dataset.onboardingInterest !== undefined) {
        // `toggleInterest`: a chip stands for one or more categories.
        const categories = button.dataset.onboardingInterest.split(" ");
        interests = categories.some((category) => interests.includes(category))
          ? interests.filter((category) => !categories.includes(category))
          : [...interests, ...categories.filter((category) => !interests.includes(category))];
      } else if (button.dataset.onboardingPlatform !== undefined) {
        const platform = button.dataset.onboardingPlatform;
        platforms = platforms.includes(platform) ? platforms.filter((value) => value !== platform) : [...platforms, platform];
      } else if (button.dataset.onboardingPurpose !== undefined) {
        single("use_purpose").value = button.dataset.onboardingPurpose;
      } else if (button.dataset.onboardingAge !== undefined) {
        single("age_group").value = button.dataset.onboardingAge;
      } else {
        return;
      }
      writeLists();
      repaint();
    });

    // "(선택)" after the age title follows the language switch.
    document.addEventListener("memecatch:page-copy", (event) => {
      const optional = event.detail?.onboarding?.optional;
      if (optional) form.querySelector("[data-onboarding-optional]").textContent = `(${optional})`;
    });

    const showError = () => {
      const template = document.querySelector("template[data-action-error]");
      const page = document.querySelector("main");
      if (!template || !page) return;
      const panel = template.content.firstElementChild.cloneNode(true);
      panel.querySelector("[data-action-retry]")?.addEventListener("click", () => location.reload());
      page.replaceWith(panel);
    };

    const submit = form.querySelector('button[type="submit"]');
    let pending = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      // The nickname input is `required`: the browser stops an empty form.
      if (!form.reportValidity()) return;
      pending = true;
      const copy = document.pageCopy?.onboarding;
      const spinner = document.createElement("span");
      spinner.setAttribute("aria-hidden", "true");
      spinner.className = "h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white";
      submit.disabled = true;
      submit.replaceChildren(spinner, copy?.submitting ?? "저장 중…");
      const data = new FormData(form);
      const body = {
        next: String(data.get("next") ?? ""),
        nickname: String(data.get("nickname") ?? ""),
        interests: data.getAll("interests").map(String),
        age_group: String(data.get("age_group") ?? ""),
        use_purpose: String(data.get("use_purpose") ?? ""),
        preferred_platforms: data.getAll("preferred_platforms").map(String),
      };
      try {
        const response = await fetch("/api/account/onboarding", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        const answer = await response.json();
        if (answer?.redirect) {
          location.assign(answer.redirect);
          return;
        }
      } catch {
        /* the error page below */
      }
      showError();
    });
  }
}
