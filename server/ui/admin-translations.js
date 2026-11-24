// /admin/translations: the client parts of components/admin/translation-review.tsx
// and missing-translation-draft-preview.tsx over routes/admin/translations.rs.
// admin.js passes its `post` and `element`.
//
// Where Next calls `router.refresh()` the page is reloaded, and what the
// component kept in its state (a card's message, the preview and its
// edits, the saved note) is put back: the same end state.

const FLASH = "memecatch-admin-translation-flash";
const LANGUAGE_NAMES = { en: "English", ja: "日本語", zh: "中文(简体)", "zh-tw": "中文(繁體)" };
const AI_RECOMMENDATION_COPY = { approve: "발행 가능", edit: "교정 후 발행", reject: "발행 보류" };
const RECOMMENDATION_COPY = { approve: "발행 가능", edit: "수정 후 검토", reject: "발행 보류" };
const CONFIDENCE_COPY = { high: "높음", medium: "보통", low: "낮음" };
const DELETE_CLASS = "min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50";

const here = () => `${location.pathname}${location.search}`;

const keep = (state) => {
  try {
    sessionStorage.setItem(FLASH, JSON.stringify({ ...state, path: here() }));
  } catch {
    // Without storage the page still reloads, without the kept state.
  }
};

const takeKept = () => {
  try {
    const kept = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
    sessionStorage.removeItem(FLASH);
    return kept && kept.path === here() ? kept : null;
  } catch {
    return null;
  }
};

export function translationComponents({ post, element }) {
  const kept = takeKept();

  // TranslationQueueCard: the message under the header; every button is off
  // while one runs; delete asks twice.
  const translationReview = (root) => {
    const body = JSON.parse(root.dataset.adminBody);
    const fresh = root.dataset.adminFresh === "true";
    const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
    const button = (name) => root.querySelector(`[data-admin-action="${name}"]`);
    const [gpt, approve, reject, remove] = ["gpt", "approve", "reject", "delete"].map(button);
    const configured = !gpt.disabled;
    const name = LANGUAGE_NAMES[body.locale];
    let pending = false;
    let reviewing = false;
    let confirming = false;
    const say = (ok, text) => {
      root.querySelector(":scope > [data-admin-message]")?.remove();
      if (text === null) return;
      const message = element("p", `rounded-lg px-3 py-2.5 text-sm font-semibold ${ok ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`, text);
      message.dataset.adminMessage = "";
      message.setAttribute("role", ok ? "status" : "alert");
      root.firstElementChild.after(message);
    };
    const sync = () => {
      const busy = pending || reviewing;
      gpt.disabled = busy || !configured;
      gpt.textContent = reviewing ? "GPT 검수 중…" : "GPT-5.6 Sol high 검수";
      approve.disabled = busy || !fresh;
      approve.textContent = busy ? "처리 중…" : "승인·발행";
      reject.disabled = busy;
      remove.disabled = busy;
      remove.className = `${DELETE_CLASS} ${confirming ? "border-safety-red bg-safety-red-bg text-safety-red" : "border-border bg-surface-2 text-muted"}`;
      remove.textContent = confirming ? "정말 삭제할까요? 다시 클릭" : "삭제";
    };
    const run = async (action, payload, done, reload) => {
      say(true, null);
      pending = true;
      sync();
      const result = await post(action, payload);
      if (result === null) return false;
      if (!result.ok) {
        pending = false;
        sync();
        say(false, result.error ?? "처리하지 못했어요.");
        return false;
      }
      if (reload) {
        keep({ key: root.dataset.adminKey, ok: true, text: done });
        location.reload();
        return true;
      }
      pending = false;
      sync();
      say(true, done);
      return true;
    };
    approve.addEventListener("click", () => {
      void run("translation-review", {
        ...body,
        title: field("title").value,
        summary: field("summary").value,
        description: field("description").value,
        origin: field("origin").value,
        usageNote: field("usageNote").value,
        caution: field("caution").value,
        aliases: field("aliases").value.split(",").map((alias) => alias.trim()).filter(Boolean),
      }, `${name} 번역을 승인하고 발행했어요.`, true);
    });
    gpt.addEventListener("click", async () => {
      say(true, null);
      reviewing = true;
      sync();
      try {
        const result = await post("translation-gpt-review", body);
        if (result === null) return;
        if (!result.ok) {
          say(false, result.error);
          return;
        }
        const draft = result.data;
        const fill = (key, value) => {
          // A controlled field given `undefined` or `null` keeps what it shows.
          if (value !== undefined && value !== null) field(key).value = String(value);
        };
        fill("title", draft.title);
        fill("summary", draft.summary);
        fill("description", draft.description);
        fill("origin", draft.origin);
        fill("usageNote", draft.usage_note);
        fill("caution", draft.caution);
        fill("aliases", draft.aliases.join(", "));
        const notes = draft.review_notes.slice(0, 2).join(" · ");
        say(true, `GPT 검수 의견: ${AI_RECOMMENDATION_COPY[draft.recommendation]} · 신뢰도 ${draft.confidence}${notes ? ` · ${notes}` : ""}`);
      } finally {
        reviewing = false;
        sync();
      }
    });
    reject.addEventListener("click", async () => {
      const reason = field("reason");
      if (!reason.value.trim()) {
        say(false, "반려 사유를 입력해 주세요.");
        return;
      }
      // Nothing on the page changes, so Next's refresh shows the same page.
      if (await run("translation-reject", { ...body, reason: reason.value }, "반려 사유를 감사 로그에 기록했어요.", false)) reason.value = "";
    });
    remove.addEventListener("click", () => {
      if (!confirming) {
        confirming = true;
        sync();
        return;
      }
      void run("translation-delete", body, `${name} 번역을 삭제했어요.`, true);
    });
    if (kept && kept.key === root.dataset.adminKey) say(kept.ok, kept.text);
  };

  // MissingTranslationDraftPreview: a preview per row, one at a time; the
  // operator's edit of it saved as a machine draft.
  const missingTranslation = (root) => {
    const locale = root.dataset.adminLocale;
    if (!locale) return;
    const rows = JSON.parse(root.dataset.adminRows);
    const lane = locale === "zh";
    const items = [...root.querySelectorAll("li[data-admin-meme]")];
    let active = items.find((item) => item.querySelector("[data-admin-active]"))?.dataset.adminMeme ?? null;
    let loading = null;
    let saving = false;
    let error = root.querySelector("[data-admin-error]")?.textContent ?? null;
    let saved = null;
    let preview = null;
    let form = null;

    const showError = () => {
      root.querySelector("[data-admin-error]")?.remove();
      if (error === null) return;
      const alert = element("p", "mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red", error);
      alert.dataset.adminError = "";
      alert.setAttribute("role", "alert");
      root.querySelector("[data-admin-list]")?.before(alert);
    };
    const showRows = () => {
      for (const item of items) {
        const id = item.dataset.adminMeme;
        const on = lane && active === id;
        item.className = `flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${on ? "border-accent bg-accent-soft/10" : "border-border bg-surface-2"}`;
        item.dataset.translationOperatorActive = on ? "true" : "false";
        const badge = item.querySelector("[data-admin-active]");
        if (on && !badge) {
          const span = element("span", "mt-2 inline-flex rounded-full bg-surface px-2 py-1 text-xs font-semibold text-accent-text", "현재 후보");
          span.dataset.adminActive = "";
          item.firstElementChild.append(span);
        } else if (!on) badge?.remove();
        const go = item.querySelector("button");
        go.disabled = loading !== null;
        go.textContent = loading === id ? "GPT-5.6 Sol high 생성 중…" : "GPT-5.6 Sol high로 미리보기";
      }
    };
    const previewField = (label, value) => {
      const box = element("div");
      box.append(element("dt", "text-xs font-semibold uppercase tracking-wide text-muted", label), element("dd", "mt-1 whitespace-pre-wrap text-sm leading-relaxed", value || "—"));
      return box;
    };
    const textList = (values) => (values.length > 0 ? values.join(", ") : "—");
    const draftField = (label, key, multiline) => {
      const box = element("label", "block");
      box.append(element("span", "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted", label));
      const input = multiline ? element("textarea", "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed") : element("input", "min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm");
      if (multiline) input.rows = 4;
      input.value = key === "aliases" ? form.aliases.join("\n") : form[key];
      input.addEventListener("input", () => {
        if (key !== "aliases") {
          form = { ...form, [key]: input.value };
          return;
        }
        // The field shows the parsed list, as the controlled textarea does.
        form = { ...form, aliases: input.value.split(/[\n,]/).map((alias) => alias.trim()).filter(Boolean) };
        input.value = form.aliases.join("\n");
      });
      box.append(input);
      return box;
    };
    const saveButton = () => {
      const button = element("button", "mt-5 min-h-11 rounded-lg bg-accent-strong px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60", "검수 대기 초안 저장");
      button.type = "button";
      button.addEventListener("click", () => void save(button));
      return button;
    };
    const previewArticle = () => {
      const { draft, row } = preview;
      const article = element("article", "mt-5 rounded-xl border border-accent/30 bg-background p-5");
      article.setAttribute("aria-labelledby", "translation-draft-preview-result-title");
      const title = element("h3", "text-lg font-bold", `${row.title} 번역 초안 미리보기`);
      title.id = "translation-draft-preview-result-title";
      const list = element("dl", "mt-4 grid gap-4 lg:grid-cols-2");
      list.append(
        previewField("title", draft.title),
        previewField("summary", draft.summary),
        previewField("description", draft.description),
        previewField("origin", draft.origin),
        previewField("usage_note", draft.usage_note),
        previewField("caution", draft.caution),
        previewField("aliases", textList(draft.aliases)),
        previewField("recommendation", `${RECOMMENDATION_COPY[draft.recommendation]} (${draft.recommendation})`),
        previewField("confidence", `${CONFIDENCE_COPY[draft.confidence]} (${draft.confidence})`),
        previewField("review_notes", textList(draft.review_notes)),
      );
      article.append(title, element("p", "mt-2 rounded-lg bg-safety-yellow-bg px-3 py-2.5 text-sm font-semibold leading-relaxed text-safety-yellow", "이 미리보기는 저장되거나 발행되지 않았습니다. 반드시 사람이 검토해야 합니다."), list);
      if (form) {
        const editor = element("div", "mt-6 rounded-xl border border-border bg-surface-2 p-4");
        const fields = element("div", "mt-4 grid gap-4 lg:grid-cols-2");
        fields.append(
          draftField("title", "title", false),
          draftField("summary", "summary", true),
          draftField("description", "description", true),
          draftField("origin", "origin", true),
          draftField("usage_note", "usage_note", true),
          draftField("caution", "caution", true),
          draftField("aliases", "aliases", true),
        );
        editor.append(element("h4", "text-base font-bold", "운영자 편집본"), element("p", "mt-1 text-sm leading-relaxed text-muted", "내용을 직접 다듬은 뒤 저장해야 기존 machine 검수 큐에 들어갑니다."), fields, saveButton());
        article.append(editor);
      }
      return article;
    };
    // The nodes after the list, in the component's order.
    const render = () => {
      showError();
      showRows();
      root.querySelectorAll(":scope > [data-admin-after]").forEach((node) => node.remove());
      const after = [];
      if (loading) {
        const status = element("p", "mt-4 text-sm font-semibold text-accent-text", "GPT-5.6 Sol high가 읽기 전용 번역 초안을 만들고 있어요.");
        status.setAttribute("role", "status");
        after.push(status);
      }
      if (preview) after.push(previewArticle());
      if (saved) {
        const note = element("p", "mt-4 rounded-lg bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent-text", saved);
        note.setAttribute("role", "status");
        after.push(note);
      }
      for (const node of after) {
        node.dataset.adminAfter = "";
        root.append(node);
      }
    };
    const request = async (row) => {
      if (loading) return;
      error = null;
      saved = null;
      preview = null;
      form = null;
      active = row.memeId;
      loading = row.memeId;
      render();
      try {
        const result = await post("translation-preview", { memeId: row.memeId, locale, expectedSourceUpdatedAt: row.updatedAt });
        if (result === null) return;
        if (!result.ok) {
          error = result.error;
          return;
        }
        const { draft, sourceUpdatedAt } = result.data;
        preview = { row, draft, sourceUpdatedAt };
        form = { title: draft.title, summary: draft.summary, description: draft.description, origin: draft.origin, usage_note: draft.usage_note, caution: draft.caution, aliases: draft.aliases };
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "번역 초안 미리보기를 만들지 못했어요.";
      } finally {
        loading = null;
        render();
      }
    };
    const save = async (button) => {
      if (!preview || !form || saving) return;
      error = null;
      saved = null;
      showError();
      root.querySelectorAll(":scope > [data-admin-after][role=status]").forEach((node) => node.remove());
      saving = true;
      button.disabled = true;
      button.textContent = "검수 대기 초안 저장 중…";
      const result = await post("translation-draft", {
        memeId: preview.row.memeId,
        locale,
        expectedSourceUpdatedAt: preview.sourceUpdatedAt,
        title: form.title,
        summary: form.summary,
        description: form.description,
        origin: form.origin,
        usageNote: form.usage_note,
        caution: form.caution,
        aliases: form.aliases,
      });
      if (result === null) return;
      saving = false;
      if (!result.ok) {
        error = result.error;
        button.disabled = false;
        button.textContent = "검수 대기 초안 저장";
        showError();
        return;
      }
      let state;
      if (lane) {
        const index = rows.findIndex((row) => row.memeId === preview.row.memeId);
        const next = index >= 0 ? rows[index + 1] : undefined;
        state = {
          active: next?.memeId ?? null,
          saved: next
            ? `machine 초안을 저장했어요. 공개 발행은 아직 되지 않았습니다. 다음 후보: ${next.title}`
            : "machine 초안을 저장했어요. 공개 발행은 아직 되지 않았습니다. 이 배치의 후보를 모두 처리했어요.",
          preview: null,
          form: null,
        };
      } else {
        state = { active, saved: "machine 초안을 검수 큐에 저장했어요. 공개 발행은 아직 되지 않았습니다.", preview, form };
      }
      keep({ key: "missing-translation", ...state });
      location.reload();
    };
    for (const item of items) {
      const row = rows.find((each) => each.memeId === item.dataset.adminMeme);
      item.querySelector("button").addEventListener("click", () => void request(row));
    }
    if (kept && kept.key === "missing-translation") {
      ({ active, saved, preview, form } = kept);
      render();
    }
  };

  return { "translation-review": translationReview, "missing-translation": missingTranslation };
}
