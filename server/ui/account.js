// components/auth-menu.tsx: the sign-in link until the session is known,
// then the initial of the user's nickname and its menu (MY, saved memes,
// sign out). The last nickname is kept so the next page shows the avatar
// before the session answers.
{
  const AUTH_HINT_KEY = "mc_auth_nick";
  let nickname = null; // null: not known yet; "": signed out

  const render = (nick) => {
    const slot = document.querySelector("[data-account]");
    if (!slot) return;
    slot.querySelector("[data-account-root]")?.remove();
    const login = slot.querySelector("[data-account-login]");
    login.hidden = Boolean(nick);
    if (!nick) return;
    const template = slot.querySelector("template[data-account-menu]");
    const menu = template.content.firstElementChild.cloneNode(true);
    menu.dataset.accountRoot = "";
    const button = menu.querySelector("button");
    button.setAttribute("aria-label", `${nick} · ${template.dataset.label}`);
    menu.querySelector("[data-initial]").textContent = Array.from(nick.trim())[0]?.toUpperCase() ?? "?";
    disclosurePanel(button).querySelector("[data-nickname]").textContent = nick;
    slot.append(menu);
  };

  const load = async () => {
    const user = await currentUser();
    if (!user) {
      nickname = "";
      storage.remove("localStorage", AUTH_HINT_KEY);
    } else {
      const { data } = await selectOne("profiles", ["nickname"], "id", user.id, true);
      nickname = data?.nickname ?? "밈러";
      storage.set("localStorage", AUTH_HINT_KEY, nickname);
    }
    render(nickname);
  };

  onFrame(() => {
    if (nickname !== null) {
      render(nickname);
      return;
    }
    const hint = storage.get("localStorage", AUTH_HINT_KEY);
    if (hint) render(hint);
    load();
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("[data-account-root] > button");
    if (button) {
      const panel = disclosurePanel(button);
      const open = button.getAttribute("aria-expanded") !== "true";
      setDisclosure(button, panel, open);
      // The first entry takes focus, as the menu opens.
      if (open) panel.querySelector('[role="menuitem"]')?.focus();
      return;
    }
    if (!target?.closest("[data-sign-out]")) return;
    // Next signs out with a server action; a page without Next's runtime asks
    // better-auth directly, and goes home as that action does.
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
    } catch {
      /* the home page shows what the session is */
    }
    storage.remove("localStorage", AUTH_HINT_KEY);
    location.assign("/");
  });
}
