// components/save-button.tsx: saving a meme to MY. Signed out, the choice is
// kept on this device and the frame's sign-in dialog (login-gate.tsx) opens;
// signed in, the toggle_save function stores it. Choices kept while signed
// out are saved once a session exists.
{
  const SAVE_INTENT_KEY = "memecatch:save-intents:v1";
  const SAVE_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const SAVE_INTENT_LIMIT = 10;
  const NOTICE_MS = 2500;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // parseSaveIntents and enqueueSaveIntent of the component.
  const readIntents = (now = Date.now()) => {
    try {
      const value = JSON.parse(storage.get("localStorage", SAVE_INTENT_KEY) ?? "[]");
      if (!Array.isArray(value)) return [];
      const kept = new Map();
      for (const item of value) {
        if (item && typeof item.memeId === "string" && UUID_RE.test(item.memeId)
          && typeof item.createdAt === "number" && item.createdAt <= now && now - item.createdAt < SAVE_INTENT_TTL_MS) {
          kept.delete(item.memeId);
          kept.set(item.memeId, { memeId: item.memeId, createdAt: item.createdAt });
        }
      }
      return [...kept.values()].slice(-SAVE_INTENT_LIMIT);
    } catch {
      return [];
    }
  };
  const writeIntents = (intents) => {
    if (intents.length) storage.set("localStorage", SAVE_INTENT_KEY, JSON.stringify(intents));
    else storage.remove("localStorage", SAVE_INTENT_KEY);
  };
  const isTerminal = (error) => error.code === "22P02" || error.code === "23503" || error.message?.includes("premium_save_limit");

  for (const button of document.querySelectorAll("[data-save-meme]")) {
    const memeId = button.dataset.saveMeme;
    const status = button.parentElement.querySelector('[role="status"]');
    const copy = () => JSON.parse(button.dataset.saveCopy);
    let saved = false;
    let busy = false;
    let signedIn = null; // null: not known yet
    let noticeTimer = 0;

    const show = () => {
      button.setAttribute("aria-pressed", String(saved));
      button.classList.remove(...(saved ? button.dataset.unsavedClass : button.dataset.savedClass).split(" "));
      button.classList.add(...(saved ? button.dataset.savedClass : button.dataset.unsavedClass).split(" "));
      button.querySelector("svg").setAttribute("fill", saved ? "currentColor" : "none");
      button.lastChild.textContent = saved ? copy().savedButton : copy().saveButton;
    };
    const notice = (message) => {
      clearTimeout(noticeTimer);
      status.textContent = message;
      noticeTimer = setTimeout(() => (status.textContent = ""), NOTICE_MS);
    };
    const openGate = () => openLoginGate(copy().loginGate);
    const rememberGuestSave = () => {
      const intents = readIntents();
      if (!intents.some((intent) => intent.memeId === memeId) && intents.length >= SAVE_INTENT_LIMIT) {
        openGate();
        return;
      }
      const now = Date.now();
      writeIntents([...intents.filter((intent) => intent.memeId !== memeId), { memeId, createdAt: now }].slice(-SAVE_INTENT_LIMIT));
      saved = true;
      show();
      openGate();
    };

    (async () => {
      const user = await currentUser();
      signedIn = Boolean(user);
      if (!user) return;
      const remaining = [];
      for (const intent of readIntents()) {
        const { error } = await rpc("save_meme", { p_meme_id: intent.memeId });
        if (error && !isTerminal(error)) remaining.push(intent);
        if (!error && intent.memeId === memeId) saved = true;
      }
      writeIntents(remaining);
      const { data } = await selectOne("saved_memes", ["meme_id"], "meme_id", memeId, false);
      if (data) saved = true;
      show();
    })();

    button.addEventListener("click", async () => {
      if (busy) return;
      if (!saved) track("follow_click", { meme_id: memeId });
      if (signedIn === false) {
        rememberGuestSave();
        return;
      }
      busy = true;
      const wasSaved = saved;
      saved = !wasSaved;
      show();
      const { data, error } = await rpc("toggle_save", { p_meme_id: memeId });
      busy = false;
      if (error) {
        saved = wasSaved;
        show();
        if (String(error.message).includes("login_required")) {
          signedIn = false;
          rememberGuestSave();
        } else {
          notice(copy().retry);
        }
        return;
      }
      signedIn = true;
      saved = data === true;
      show();
      if (saved) {
        // Counted by the install prompt (pwa.js).
        window.dispatchEvent(new Event("memecatch:save"));
        notice(copy().saved);
      } else {
        notice(copy().removed);
      }
    });
    // The language switch replaces the copy; the label follows it.
    onFrame(show);
  }
}
