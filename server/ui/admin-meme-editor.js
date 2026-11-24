// /admin/memes/{id} (pages/admin/meme.rs): the client parts of
// meme-status-controls, meme-origin-country-form, meme-translation-review,
// meme-edit-form, admin-meme-contents (MemeEmbed's players) and the
// dictionary card, over routes/admin/meme_editor.rs and translations.rs.
// admin.js passes its `post` and `element`.
//
// Where Next calls `router.refresh()` the page is reloaded and the message
// the component kept is shown again: the same end state.
import { dictionaryCard } from "@/server/ui/dictionary-card";

const FLASH = "memecatch-admin-editor-flash";
const LANGUAGE_NAMES = { en: "English", ja: "日本語", zh: "中文(简体)", "zh-tw": "中文(繁體)" };
const AI_RECOMMENDATION_COPY = { approve: "발행 가능", edit: "교정 후 발행", reject: "발행 보류" };

const keep = (key, ok, text) => {
  try {
    sessionStorage.setItem(FLASH, JSON.stringify({ key, ok, text, path: location.pathname }));
  } catch {
    // The page still reloads, without the message.
  }
};
const takeKept = () => {
  try {
    const kept = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
    sessionStorage.removeItem(FLASH);
    return kept && kept.path === location.pathname ? kept : null;
  } catch {
    return null;
  }
};

export function editorComponents({ post, element }) {
  const kept = takeKept();
  const restore = (key, say) => {
    if (kept && kept.key === key) say(kept.ok, kept.text);
  };

  // MemeStatusControls: approving a catalog meme and limiting ask first; a
  // house original's publication needs the attestation.
  const memeStatus = (root) => {
    const memeId = root.dataset.adminMeme;
    const house = root.dataset.adminHouse === "true";
    const blocked = root.dataset.adminBlocked === "true";
    const attest = root.querySelector("[data-admin-attest]");
    const buttons = [...root.querySelectorAll("button[data-admin-to]")];
    if (buttons.length === 0) return;
    const confirms = {};
    let pending = false;
    const showError = (text) => {
      root.querySelector(":scope > [data-admin-error]")?.remove();
      if (text === null) return;
      const alert = element("p", "rounded-lg bg-safety-red-bg p-3 text-base text-safety-red", text);
      alert.dataset.adminError = "";
      alert.setAttribute("role", "alert");
      const anchor = root.querySelector("#house-original-rights-evidence") ?? attest?.closest("label") ?? buttons[0].parentElement;
      anchor.before(alert);
    };
    const sync = () => {
      for (const button of buttons) {
        const to = button.dataset.adminTo;
        button.disabled = pending || (blocked && (to === "limited" || to === "approved"));
      }
      for (const [to, panel] of Object.entries(confirms)) {
        const run = panel.querySelector("[data-admin-run]");
        for (const button of panel.querySelectorAll("button")) button.disabled = pending;
        run.textContent = pending ? (to === "approved" ? "게시 중…" : "전환 중…") : to === "approved" ? "확인하고 게시" : "제한 공개로 전환";
      }
    };
    const open = (to) => {
      if (confirms[to]) return;
      const panel = root.querySelector(`template[data-admin-confirm="${to}"]`).content.firstElementChild.cloneNode(true);
      panel.querySelector("[data-admin-run]").addEventListener("click", () => void run(to));
      panel.querySelector("[data-admin-cancel]").addEventListener("click", () => {
        panel.remove();
        delete confirms[to];
      });
      confirms[to] = panel;
      // The approval's box comes before the limitation's.
      if (to === "approved" && confirms.limited) confirms.limited.before(panel);
      else root.append(panel);
      sync();
    };
    const run = async (to) => {
      showError(null);
      const publishing = to === "approved" || to === "limited";
      if (house && publishing && !attest?.checked) {
        showError("자체 제작 권리 확인에 동의해 주세요.");
        return;
      }
      pending = true;
      sync();
      const result = await post("meme-transition", { memeId, to, ...(house && publishing ? { attested: true } : {}) });
      if (result === null) return;
      if (!result.ok) {
        pending = false;
        sync();
        showError(result.error);
        return;
      }
      location.reload();
    };
    for (const button of buttons) {
      const to = button.dataset.adminTo;
      button.addEventListener("click", () => {
        if (to === "limited") open("limited");
        else if (to === "approved" && !house) open("approved");
        else void run(to);
      });
    }
  };

  const statusMessage = (root, ok, text, className) => {
    root.querySelector("[data-admin-message]")?.remove();
    if (text === null) return null;
    const message = element("p", className(ok), text);
    message.dataset.adminMessage = "";
    message.setAttribute("role", ok ? "status" : "alert");
    return message;
  };

  // MemeOriginCountryForm.
  const memeCountry = (root) => {
    const form = root.querySelector("form");
    const button = form.querySelector("button[type=submit]");
    const say = (ok, text) => {
      const message = statusMessage(root, ok, text, (good) => `rounded-lg p-3 text-sm ${good ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`);
      if (message) root.append(message);
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      say(true, null);
      button.disabled = true;
      button.textContent = "저장 중…";
      const result = await post("meme-origin-country", {
        memeId: root.dataset.adminMeme,
        country: form.querySelector('[data-admin-field="country"]').value,
        localTitle: form.querySelector('[data-admin-field="localTitle"]').value,
      });
      if (result === null) return;
      if (result.ok) {
        keep("meme-country", true, "출처 국가 검수를 저장했어요.");
        location.reload();
        return;
      }
      button.disabled = false;
      button.textContent = "출처 국가 검수 저장";
      say(false, result.error);
    });
    restore("meme-country", say);
  };

  // TranslationEditor: save, publish, mark stale and the GPT review.
  const memeTranslation = (root) => {
    const body = JSON.parse(root.dataset.adminBody);
    const fresh = root.dataset.adminFresh === "true";
    const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
    const button = (name) => root.querySelector(`[data-admin-action="${name}"]`);
    const [gpt, save, review, stale] = ["gpt", "save", "review", "stale"].map(button);
    const configured = !gpt.disabled;
    const isStale = stale.disabled;
    const name = LANGUAGE_NAMES[body.locale];
    const prefix = `[${body.locale}]`;
    let pending = false;
    let reviewing = false;
    const say = (ok, text) => {
      const message = statusMessage(root, ok, text, (good) => `rounded-lg px-3 py-2.5 text-sm font-semibold ${good ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`);
      if (message) root.firstElementChild.after(message);
    };
    const sync = () => {
      const busy = pending || reviewing;
      gpt.disabled = busy || !configured;
      gpt.textContent = reviewing ? "GPT 검수 중…" : "GPT-5.6 Sol high 검수";
      save.disabled = busy;
      save.textContent = busy ? "처리 중…" : `${prefix} 초안 저장`;
      review.disabled = busy || !fresh;
      stale.disabled = busy || isStale;
    };
    const content = () => ({
      ...body,
      title: field("title").value,
      summary: field("summary").value,
      description: field("description").value,
      origin: field("origin").value,
      usageNote: field("usageNote").value,
      caution: field("caution").value,
      aliases: field("aliases").value.split(",").map((alias) => alias.trim()).filter(Boolean),
    });
    const run = async (action, payload, done) => {
      say(true, null);
      pending = true;
      sync();
      const result = await post(action, payload);
      if (result === null) return;
      if (!result.ok) {
        pending = false;
        sync();
        say(false, result.error ?? "처리하지 못했어요.");
        return;
      }
      keep(root.dataset.adminKey, true, done);
      location.reload();
    };
    save.addEventListener("click", () => void run("translation-save", content(), `${name} 번역을 저장했어요. 다시 검수해 주세요.`));
    review.addEventListener("click", () => void run("translation-review", content(), `${name} 번역을 검수 완료하고 발행했어요.`));
    stale.addEventListener("click", () => void run("translation-stale", body, `${name} 번역을 stale로 표시했어요.`));
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
    restore(root.dataset.adminKey, say);
  };

  // MemeEditForm: the year check, the save and GPT's Korean draft.
  const memeEdit = (form) => {
    const memeId = form.dataset.adminMeme;
    const field = (name) => form.querySelector(`[data-admin-field="${name}"]`);
    const draftButton = form.querySelector("[data-admin-draft]");
    const submit = form.querySelector("button[type=submit]");
    const configured = !draftButton.disabled;
    let pending = false;
    let translating = false;
    const say = (ok, text) => {
      form.querySelector(":scope > [data-admin-message]")?.remove();
      if (text === null) return;
      const message = element("p", `rounded-lg p-3 text-base ${ok ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`, text);
      message.dataset.adminMessage = "";
      message.setAttribute("role", "status");
      form.firstElementChild.after(message);
    };
    const sync = () => {
      draftButton.disabled = pending || translating || !configured;
      draftButton.textContent = translating ? "GPT 검수 중…" : "GPT-5.6 Sol high로 검수 초안";
      submit.disabled = pending;
      submit.textContent = pending ? "저장 중…" : "저장";
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      say(true, null);
      const raw = field("originYear").value;
      const year = raw.trim() ? Number(raw) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
        say(false, "연도는 1980~2100 사이 숫자로 입력해 주세요.");
        return;
      }
      pending = true;
      sync();
      const result = await post("meme-update", {
        memeId,
        title: field("title").value,
        summary: field("summary").value,
        description: field("description").value,
        origin: field("origin").value,
        usageNote: field("usageNote").value,
        caution: field("caution").value,
        aliases: field("aliases").value.split(",").map((alias) => alias.trim()).filter(Boolean),
        safetyLevel: field("safetyLevel").value,
        lifecycleStatus: field("lifecycleStatus").value,
        category: field("category").value,
        difficulty: field("difficulty").value,
        sentiment: field("sentiment").value,
        originYear: year,
        usageContext: Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, field(key).value])),
      });
      if (result === null) return;
      if (!result.ok) {
        pending = false;
        sync();
        say(false, result.error);
        return;
      }
      keep(
        "meme-edit",
        true,
        result.data?.revertedToRightsChecking
          ? "저장했어요. 본문이 바뀌어 권리 확인으로 돌아갔어요. 다시 수동 게시해야 공개됩니다."
          : result.data?.safetyReviewQueued
            ? "내용을 저장하고 안전 등급 변경은 Radar 검수 대기열에 추가했어요."
            : "저장했어요.",
      );
      location.reload();
    });
    draftButton.addEventListener("click", async () => {
      say(true, null);
      translating = true;
      sync();
      try {
        const result = await post("meme-korean-draft", memeId);
        if (result === null) return;
        if (!result.ok) {
          say(false, result.error);
          return;
        }
        const draft = result.data;
        const fill = (key, value) => {
          if (value !== undefined && value !== null) field(key).value = String(value);
        };
        fill("title", draft.title);
        fill("summary", draft.summary);
        fill("description", draft.description);
        fill("origin", draft.origin);
        fill("usageNote", draft.usage_note);
        fill("caution", draft.caution);
        say(true, draft.review_basis === "korean_wikipedia"
          ? "한국어 위키백과 자료로 검수 초안을 채웠어요. 항목 일치 여부와 사실관계를 확인한 뒤 저장해 주세요."
          : "한국어 검수 초안을 채웠어요. 사실관계와 고유명사를 확인한 뒤 저장해 주세요.");
      } finally {
        translating = false;
        sync();
      }
    });
    restore("meme-edit", say);
  };

  // `<ArtifactStudio dictionaryOnly>`: the rights note, then the card.
  const dictionaryStudio = (root) => {
    const rights = root.querySelector('input[name="rights-confirmed"]');
    const note = root.querySelector(':scope > p[role="status"]');
    const card = dictionaryCard(root.querySelector("[data-studio-artifact]"), rights);
    rights.addEventListener("change", () => {
      if (rights.checked) note.remove();
      else rights.closest("label").after(note);
      card.update();
    });
  };

  // MemeEmbed's players: a related YouTube video plays on a click; a social
  // post without a player URL asks /api/oembed for one.
  const memeContents = (root) => {
    for (const facade of root.querySelectorAll("[data-admin-youtube]")) {
      facade.addEventListener("click", () => {
        const frame = element("iframe", "h-full w-full border-0");
        frame.src = `https://www.youtube-nocookie.com/embed/${facade.dataset.adminYoutube}?rel=0&autoplay=1`;
        frame.title = facade.dataset.adminYoutubeTitle;
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-presentation");
        frame.allow = "autoplay; encrypted-media; picture-in-picture";
        frame.allowFullscreen = true;
        frame.loading = "lazy";
        facade.replaceWith(frame);
      });
    }
    for (const box of root.querySelectorAll("[data-admin-social]")) {
      const loading = box.querySelector("[data-admin-loading]");
      if (!loading) continue;
      const provider = box.dataset.adminSocial;
      const source = box.dataset.adminSource;
      const trusted = (url) => {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:") return false;
          if (provider === "tiktok") return parsed.hostname === "www.tiktok.com" && parsed.pathname.startsWith("/player/v1/");
          if (provider === "instagram") return parsed.hostname === "www.instagram.com" && parsed.pathname.endsWith("/embed/captioned/");
          if (provider === "threads") return false;
          return parsed.hostname === "www.facebook.com" && parsed.pathname.startsWith("/plugins/");
        } catch {
          return false;
        }
      };
      void (async () => {
        try {
          const response = await fetch(`/api/oembed?url=${encodeURIComponent(source)}`);
          const data = await response.json();
          if (!response.ok || !("embedUrl" in data)) throw new Error("error" in data ? data.error : undefined);
          const good = provider === "threads" ? typeof data.embedHtml === "string" && data.embedHtml.length > 0 : typeof data.embedUrl === "string" && trusted(data.embedUrl);
          if (data.provider !== provider || !good) throw new Error("안전한 임베드 주소를 확인하지 못했습니다.");
          const frame = element("iframe", box.dataset.adminFrame);
          if (data.embedHtml) {
            frame.srcdoc = `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body>${data.embedHtml}</body></html>`;
          }
          if (data.embedUrl) frame.src = data.embedUrl;
          frame.title = box.dataset.adminFrameTitle;
          frame.setAttribute("sandbox", box.dataset.adminSandbox);
          frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
          frame.allowFullscreen = true;
          frame.loading = "lazy";
          frame.referrerPolicy = "strict-origin-when-cross-origin";
          loading.replaceWith(frame);
        } catch (error) {
          const failure = element("div", "mx-auto flex min-h-32 w-full max-w-[540px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 p-5 text-center");
          const alert = element("p", "text-sm text-muted", error instanceof Error && error.message ? error.message : "콘텐츠를 불러오지 못했습니다.");
          alert.setAttribute("role", "alert");
          failure.append(alert);
          if (provider !== "tiktok") {
            const link = element("a", "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-bold transition-colors hover:border-accent hover:text-accent");
            link.href = source;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            const arrow = element("span", "", "↗");
            arrow.setAttribute("aria-hidden", "true");
            link.append(`${box.querySelector("span.font-bold").textContent}에서 보기 `, arrow);
            failure.append(link);
          }
          loading.replaceWith(failure);
        }
      })();
    }
  };

  return {
    "meme-status": memeStatus,
    "meme-country": memeCountry,
    "meme-translation": memeTranslation,
    "meme-edit": memeEdit,
    "dictionary-studio": dictionaryStudio,
    "meme-contents": memeContents,
  };
}
