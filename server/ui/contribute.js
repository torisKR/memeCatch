// components/meme-contribute.tsx: the meme page's form that sends a source
// link or an example for review. A link to #contribute, #contribute-source or
// #contribute-example on the page opens it on that tab. Next's form calls its
// server action; this one posts the same input to POST /api/memes/contribution,
// which answers with the action's result.
{
  const details = document.querySelector("details[data-contribute]");
  if (details) {
    const form = details.querySelector("form");
    const submit = form.querySelector('button[type="submit"]');
    const exampleTemplate = form.querySelector("template[data-contribute-example]");
    const fields = {
      source: [...form.querySelectorAll('[data-contribute-field="source"]')],
      example: [...exampleTemplate.content.children].map((field) => field.cloneNode(true)),
    };
    const input = (name) =>
      [...fields.source, ...fields.example].map((field) => field.querySelector(`[data-contribute-input="${name}"]`)).find(Boolean);
    const credit = form.querySelector('[data-contribute-input="creditPublic"]');
    const selected = details.dataset.kindSelected.split(" ");
    const idle = details.dataset.kindIdle.split(" ");
    let kind = "source";
    let pending = false;
    let notice = null;

    const canSubmit = () =>
      !pending && (kind === "source"
        ? input("sourceUrl").value.trim().length > 0
        : Boolean(input("situation").value.trim() && input("text").value.trim()));

    const render = () => {
      for (const radio of form.querySelectorAll('input[type="radio"]')) {
        const on = radio.value === kind;
        radio.checked = on;
        const label = radio.closest("label");
        label.classList.remove(...(on ? idle : selected));
        label.classList.add(...(on ? selected : idle));
      }
      // Only the chosen kind's fields are in the form, as the component renders them.
      const shown = fields[kind];
      const hidden = fields[kind === "source" ? "example" : "source"];
      if (!shown[0].isConnected) {
        const anchor = hidden[0].isConnected ? hidden[0] : exampleTemplate;
        anchor.before(...shown);
      }
      for (const field of hidden) field.remove();
      submit.disabled = !canSubmit();
      submit.textContent = pending ? "보내는 중…" : "검수 요청 보내기";
    };

    const showNotice = (next) => {
      notice?.remove();
      notice = null;
      if (!next) return;
      notice = document.createElement("p");
      notice.setAttribute("role", next.kind === "error" ? "alert" : "status");
      notice.className = "text-base";
      notice.style.color = next.kind === "error" ? "var(--safety-red)" : "var(--safety-green)";
      notice.append(next.message);
      if (next.loginLink) {
        const link = document.createElement("a");
        link.href = `/login?next=${encodeURIComponent(`${location.pathname}#contribute-${kind}`)}`;
        link.className = "font-semibold underline underline-offset-2";
        link.textContent = "로그인하고 이어서 쓰기";
        notice.append(" ", link);
      }
      submit.after(notice);
    };

    // kindFromHash, and opening on a link to the form.
    const sync = () => {
      const next = { "#contribute-source": "source", "#contribute-example": "example", "#contribute": null }[location.hash];
      if (next === undefined) return;
      details.open = true;
      if (next) kind = next;
      render();
      details.scrollIntoView?.({ block: "start" });
    };

    form.addEventListener("change", (event) => {
      if (event.target.matches('input[type="radio"]')) {
        kind = event.target.value;
        render();
      }
    });
    form.addEventListener("input", render);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canSubmit()) return;
      showNotice(null);
      pending = true;
      render();
      const creditPublic = credit.checked;
      const body = kind === "source"
        ? { memeId: details.dataset.contribute, kind, sourceUrl: input("sourceUrl").value, note: input("note").value, creditPublic }
        : { memeId: details.dataset.contribute, kind, situation: input("situation").value, text: input("text").value, creditPublic };
      let result;
      try {
        const response = await fetch("/api/memes/contribution", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        result = await response.json();
      } catch {
        result = { ok: false, error: "failed", message: "제보를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요." };
      }
      pending = false;
      if (result.ok) {
        track("meme_contribution_submitted", { short_id: details.dataset.contributeShortId, kind });
        for (const name of ["sourceUrl", "note", "situation", "text"]) input(name).value = "";
        showNotice({
          kind: "success",
          message: creditPublic
            ? "고마워요! 검수를 거쳐 반영되면 「함께 채운 사람」에 닉네임이 올라가요."
            : "고마워요! 검수를 거쳐 이 문서에 반영할게요.",
        });
      } else {
        showNotice({ kind: "error", message: result.message, loginLink: result.error === "login_required" });
      }
      render();
    });
    addEventListener("hashchange", sync);
    sync();
  }
}
