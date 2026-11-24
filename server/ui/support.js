// /support (src/pages/account/support.rs): components/support/inquiry-form.tsx.
// The browser checks the fields first (`required`, `minLength`, as on Next);
// the form then posts to POST /api/support/inquiry (`createInquiry`). On
// success the fields empty, the notice says so, and the list is the one the
// answer carries (Next refreshes the page with `revalidatePath`).
{
  const form = document.querySelector("form[data-support-form]");
  if (form) {
    const category = form.querySelector("#inquiry-category");
    const subject = form.querySelector("#inquiry-subject");
    const body = form.querySelector("#inquiry-body");
    const count = form.querySelector("[data-support-count]");
    const submit = form.querySelector('button[type="submit"]');
    let notice = null;
    let pending = false;
    const showCount = () => {
      count.textContent = `${body.value.length.toLocaleString()}/2,000`;
    };
    body.addEventListener("input", showCount);
    const setNotice = (kind, text) => {
      notice?.remove();
      notice = null;
      if (!kind) return;
      notice = document.createElement("p");
      notice.setAttribute("role", "status");
      notice.className = `rounded-xl px-3 py-2.5 text-sm ${kind === "ok" ? "bg-accent-soft text-accent" : "bg-surface-2 font-medium text-foreground"}`;
      notice.textContent = text;
      submit.before(notice);
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      setNotice(null);
      pending = true;
      submit.disabled = true;
      submit.textContent = "보내는 중…";
      let result;
      try {
        const response = await fetch("/api/support/inquiry", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ category: category.value, subject: subject.value, body: body.value }),
        });
        result = await response.json();
      } catch {
        result = { ok: false, message: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요." };
      }
      if (result?.ok) {
        subject.value = "";
        body.value = "";
        showCount();
        setNotice("ok", "문의를 접수했어요. 답변이 등록되면 이 페이지에서 볼 수 있어요.");
        if (result.list) {
          const template = document.createElement("template");
          template.innerHTML = result.list;
          document.querySelector("section[data-support-list]")?.replaceWith(template.content.firstElementChild);
        }
      } else {
        setNotice("error", result?.message ?? "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
      }
      pending = false;
      submit.disabled = false;
      submit.textContent = "문의 보내기";
    });
  }
}
