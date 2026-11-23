// components/meme-chatbot.tsx: the launcher opens a labelled, non-modal
// panel; a question goes to /api/memes/chat (Next's) and the streamed answer
// is read by lib/meme-chat-stream.ts itself. The conversation stays while the
// page is open, and starts over when the language switch replaces the panel.
{
  const MAX_TURNS = 6;
  const STILL = "/images/meme-chat/mascot-idle.png";
  const LOOP = "/images/meme-chat/mascot-wave.gif";
  const ERRORS = { 429: "limited", 504: "timeout", 400: "invalid", 413: "invalid" };

  const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  const isChatItem = (value) => isRecord(value)
    && ["id", "short_id", "slug", "title", "summary", "href"].every((key) => typeof value[key] === "string" && value[key].length <= 12000)
    && Array.isArray(value.sources) && value.sources.length <= 8
    && value.sources.every((source) => isRecord(source) && typeof source.url === "string" && source.url.length <= 2048
      && typeof source.label === "string" && source.label.length <= 300);
  const isChatResult = (value) => isRecord(value)
    && typeof value.answer === "string" && value.answer.length <= 12000
    && ["generated", "retrieved", "empty"].includes(value.mode)
    && ["hybrid", "keyword"].includes(value.retrievalMode)
    && Array.isArray(value.items) && value.items.length <= 12 && value.items.every(isChatItem);
  const safeMemeHref = (value) => {
    if (value.length > 2048 || /[\u0000-\u001f\u007f\\]/u.test(value)) return null;
    return /^\/(?:ko\/|en\/|ja\/|zh\/|zh-tw\/)?memes\/[^/?#]+$/u.test(value) ? value : null;
  };

  let chat = null;

  const setCharacter = (face, state) => {
    const character = face.querySelector("[data-character-state]");
    if (!character || character.dataset.characterState === state) return;
    character.dataset.characterState = state;
    character.querySelector("img").src = state === "ready" || state === "found" ? STILL : LOOP;
    character.querySelector(".meme-chatbot-character-state")?.remove();
    const icon = chat.root.querySelector(`template[data-chat-icon="${state === "found" ? "ready" : state}"]`);
    if (icon) character.append(icon.content.firstElementChild.cloneNode(true));
  };

  const fill = (selector) => chat.root.querySelector(`template[${selector}]`).content.firstElementChild.cloneNode(true);

  function render() {
    const { root: box, copy, open, pending, progress, error } = chat;
    const launcher = box.querySelector("[data-chat-launcher]");
    const { panel } = chat;
    if (open && !panel.isConnected) launcher.before(panel);
    if (!open) panel.remove();
    launcher.dataset.chatOpen = String(open);
    launcher.setAttribute("aria-label", open ? copy.close : copy.open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open) launcher.setAttribute("aria-controls", panel.id);
    else launcher.removeAttribute("aria-controls");
    launcher.querySelector("[data-chat-prompt]").textContent = open ? copy.close : copy.launcherHint;
    launcher.querySelector("[data-chat-x]").hidden = !open;
    setCharacter(launcher.querySelector("[data-chat-face]"), open ? (pending !== null ? "searching" : "ready") : "idle");
    const waiting = progress?.stage === "found" && progress.count === 0 ? "idle" : progress?.stage ?? "reading";
    setCharacter(panel.querySelector("header [data-chat-face]"), pending !== null ? waiting : chat.turns ? "ready" : "idle");
    // Next renders the welcome only while there is nothing else.
    const welcome = chat.turns === 0 && pending === null;
    if (welcome && !chat.welcome.isConnected) panel.querySelector("[data-chat-log]").prepend(chat.welcome);
    if (!welcome) chat.welcome.remove();

    const alert = panel.querySelector("[data-chat-error]");
    alert.hidden = !error;
    alert.textContent = error ? copy[error] : "";
    const input = panel.querySelector("textarea");
    const length = input.value.trim().length;
    input.disabled = pending !== null;
    panel.querySelector("[data-chat-count]").textContent = `${input.value.length}/120`;
    panel.querySelector('button[type="submit"]').disabled = pending !== null || length < 2 || length > 120;

    const slot = panel.querySelector("[data-chat-pending-slot]");
    slot.replaceChildren();
    if (pending !== null) slot.append(pendingCard());
    const scroller = panel.querySelector("[data-chat-scroll]");
    scroller.scrollTop = scroller.scrollHeight;
  }

  // PendingAnswer of the component.
  function pendingCard() {
    const { copy, pending, progress, foundCount } = chat;
    const card = fill("data-chat-pending");
    card.querySelector("[data-question]").textContent = pending;
    const stage = progress?.stage;
    card.querySelector("[data-chat-progress]").dataset.chatProgress = stage ?? "pending";
    setCharacter(card.querySelector("[data-chat-face]"), stage === "found" && progress.count === 0 ? "idle" : stage ?? "idle");
    const references = stage === "found" ? progress.count : foundCount;
    const foundLabel = references === 0 ? copy.noReferences : copy.found.replace("{count}", String(references));
    card.querySelector("[data-status]").textContent = stage === "found" ? foundLabel : stage ? copy[stage] : copy.pending;
    if (foundCount !== null && stage === "answering") {
      const badge = card.querySelector("[data-found]");
      badge.hidden = false;
      badge.className = foundCount > 0 ? "meme-chatbot-found-badge" : "meme-chatbot-empty-badge";
      if (foundCount === 0) badge.querySelector("[data-found-check]").remove();
      badge.querySelector("[data-found-label]").textContent = foundLabel;
    }
    card.querySelector("[data-skeleton]").hidden = stage !== "answering";
    return card;
  }

  function appendTurn(question, result) {
    const { copy } = chat;
    const turn = fill("data-chat-turn");
    turn.querySelector("[data-question]").textContent = question;
    turn.querySelector("[data-mode]").textContent = copy[result.mode];
    turn.querySelector("[data-answer]").textContent = result.answer;
    const references = turn.querySelector("[data-references]");
    if (!result.items.length) references.remove();
    references.querySelector("[data-references-title]").textContent = copy.references;
    for (const item of result.items) {
      const card = fill("data-chat-reference");
      const title = card.querySelector("[data-title]");
      const href = safeMemeHref(item.href);
      if (href) title.href = href;
      else title.replaceWith(Object.assign(document.createElement("span"), { className: "font-bold text-foreground", textContent: item.title }));
      title.textContent = item.title;
      card.querySelector("[data-summary]").textContent = item.summary;
      const sources = card.querySelector("[data-sources]");
      sources.querySelector("[data-sources-title]").textContent = copy.sources;
      const links = item.sources.flatMap((source) => {
        const url = lib.sourceLinks.publicSourceUrl(source.url);
        return url ? [{ url, label: source.label }] : [];
      });
      if (!links.length) sources.remove();
      for (const link of links) {
        const anchor = fill("data-chat-source");
        anchor.href = link.url;
        anchor.textContent = link.label || new URL(link.url).hostname;
        sources.append(anchor);
      }
      references.querySelector("ul").append(card);
    }
    const log = chat.panel.querySelector("[data-chat-log]");
    log.append(turn);
    const turns = log.querySelectorAll("article");
    if (turns.length > MAX_TURNS) turns[0].remove();
    chat.turns = Math.min(turns.length, MAX_TURNS);
  }

  const input = () => chat.panel.querySelector("textarea");

  function cancel() {
    chat.controller?.abort();
    Object.assign(chat, { controller: null, pending: null, progress: null, foundCount: null });
  }

  function setOpen(open) {
    if (!open) cancel();
    chat.open = open;
    render();
    if (open) input().focus();
    else chat.root.querySelector("[data-chat-launcher]").focus();
  }

  async function ask() {
    if (chat.controller) return;
    const question = input().value.trim();
    if (question.length < 2 || question.length > 120) {
      chat.error = "invalid";
      render();
      return;
    }
    const controller = new AbortController();
    Object.assign(chat, { controller, pending: question, progress: { stage: "reading" }, foundCount: null, error: null });
    render();
    const current = () => !controller.signal.aborted && chat?.controller === controller;
    try {
      const response = await fetch("/api/memes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ question, locale: chat.locale }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!current()) return;
      if (!response.ok) {
        chat.error = ERRORS[response.status] ?? "unavailable";
        return;
      }
      const result = await lib.chatStream.readMemeChatResponse(response, {
        signal: controller.signal,
        onProgress(progress) {
          if (!current()) return;
          chat.progress = progress;
          if (progress.stage === "found") chat.foundCount = progress.count;
          render();
        },
      });
      if (!current()) return;
      if (!isChatResult(result)) {
        chat.error = "unavailable";
        return;
      }
      appendTurn(question, result);
      input().value = "";
    } catch (caught) {
      if (current()) chat.error = caught?.error === "request_timed_out" ? "timeout" : "unavailable";
    } finally {
      if (chat?.controller === controller) {
        cancel();
        render();
        if (chat.open) input().focus();
      }
    }
  }

  onFrame(() => {
    chat?.controller?.abort();
    const box = document.querySelector("[data-chat]");
    const panel = box?.querySelector("template[data-chat-panel]").content.firstElementChild.cloneNode(true);
    chat = box && {
      root: box,
      panel,
      copy: JSON.parse(box.dataset.chatCopy),
      locale: box.dataset.chatLocale,
      welcome: panel.querySelector("[data-chat-welcome]"),
      open: false, turns: 0, pending: null, progress: null, foundCount: null, error: null, controller: null,
    };
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!chat || !target || !chat.root.contains(target)) return;
    if (target.closest("[data-chat-launcher]")) setOpen(!chat.open);
    else if (target.closest("[data-chat-close]")) setOpen(false);
    else if (target.closest("[data-chat-clear]")) {
      cancel();
      chat.panel.querySelectorAll("[data-chat-log] article").forEach((turn) => turn.remove());
      Object.assign(chat, { turns: 0, error: null });
      input().value = "";
      render();
      input().focus();
    } else if (target.closest("[data-chat-suggestion]")) {
      input().value = target.closest("[data-chat-suggestion]").firstChild.textContent;
      chat.error = null;
      render();
      input().focus();
    }
  });
  document.addEventListener("input", (event) => {
    if (!chat || event.target !== input()) return;
    chat.error = null;
    render();
  });
  document.addEventListener("submit", (event) => {
    if (!chat || !event.target.closest?.("[data-chat-form]")) return;
    event.preventDefault();
    ask();
  });
  document.addEventListener("keydown", (event) => {
    if (!chat?.open) return;
    if (event.target === input() && event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      if (chat.pending === null) input().form.requestSubmit();
      return;
    }
    if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
    // A modal over the page has Escape first.
    if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')) return;
    event.preventDefault();
    setOpen(false);
  });
}
