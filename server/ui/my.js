// /my (src/pages/account/my.rs): the nickname form posts to
// POST /api/account/nickname (`updateNickname`) and goes where its answer
// says; the sign-out button signs out with better-auth and goes home
// (`signOut`). The card collection is components/meme-collectible-
// collection.tsx below; the recently viewed memes and the daily quiz are
// further down.
import { ownedMemeCardArtPath } from "@/lib/meme-card-art";
import { memeCardReturnHref } from "@/lib/meme-collectible-ui";
import { startDailyQuiz } from "@/server/ui/daily-quiz-widget";

// DailyMemeQuiz variant="compact".
{
  const quiz = document.querySelector("section[data-daily-quiz]");
  if (quiz) startDailyQuiz(quiz, quiz.dataset.dailyQuiz);
}
{
  const postJson = (path, body) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });

  const nickname = document.querySelector("form[data-my-nickname]");
  nickname?.addEventListener("submit", async (event) => {
    event.preventDefault();
    // `minLength`, `maxLength` and `required` stop the form as they do on Next.
    if (!nickname.reportValidity()) return;
    const button = nickname.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await postJson("/api/account/nickname", { nickname: nickname.elements.nickname.value });
      const answer = await response.json();
      if (answer?.redirect) {
        location.assign(answer.redirect);
        return;
      }
    } catch {
      /* the action's failure answer */
    }
    location.assign(`/my?nickname_error=${encodeURIComponent("닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요")}`);
  });

  const signOut = document.querySelector("form[data-my-sign-out]");
  signOut?.addEventListener("submit", async (event) => {
    event.preventDefault();
    signOut.querySelector('button[type="submit"]').disabled = true;
    await postJson("/api/auth/sign-out", {}).catch(() => undefined);
    location.assign("/");
  });
}

// MemeCollectibleCollection: the first page comes with the document, shown
// once this browser is confirmed to be signed in as its owner (again on
// focus and when the tab becomes visible); other pages and filters from
// GET /api/meme-cards/collection.
{
  const section = document.querySelector("section[data-my-cards]");
  if (section) {
    const COPY = {
      checking: "로그인 확인 중…",
      accountChanged: "계정이 바뀌었어요. 새 계정의 컬렉션을 다시 열어 주세요.",
      authFailure: "로그인 상태를 확인하지 못했어요. 다시 확인해 주세요.",
      loadFailure: "컬렉션을 불러오지 못했어요. 다시 시도해 주세요.",
      loginClaim: "로그인하고 보유하기",
      retry: "다시 시도",
      noResults: "조건에 맞는 카드가 없어요",
      empty: "아직 모은 밈카드가 없어요",
      noResultsBody: "필터를 바꾸거나 전체 카드를 둘러보세요.",
      emptyBody: "좋아하는 밈을 골라 첫 카드를 공개해 보세요.",
      start: "첫 카드 찾기",
      owned: "소장 중",
      hidden: "내용 확인 중",
      hiddenBody: "보유 기록은 유지돼요. 다시 공개 가능한지 확인하고 있어요.",
      previous: "이전",
      next: "다음",
      my: "내 밈카드",
      target: (total) => `${total} / 1,000`,
      count: (total) => `${total}종 보유`,
      page: (page, pages) => `${page} / ${pages} 페이지`,
    };
    const owner = section.dataset.myCards;
    let initial = null;
    try {
      initial = section.dataset.myCardsPage ? JSON.parse(section.dataset.myCardsPage) : null;
    } catch {
      initial = null;
    }
    let page = initial;
    let total = initial?.total ?? null;
    let error = !initial;
    let loginRequired = false;
    let busy = false;
    let status = "verifying";
    let filters = { query: "", category: "" };
    let epoch = 0;
    let request = null;
    let retained = { page: initial, total, error };

    const element = (tag, attributes = {}, ...children) => {
      const node = document.createElement(tag);
      for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
      node.append(...children);
      return node;
    };
    const cls = (name) => `meme-collectible-${name}`;
    const heading = section.querySelector(`.${cls("section-heading")}`).lastElementChild;
    const form = section.querySelector("form");
    const apply = form.querySelector('button[type="submit"]');
    const catalog = section.querySelector(`.${cls("text-button")}`);

    const face = (card) => {
      const path = ownedMemeCardArtPath(card.thumbnailUrl);
      const template = document.querySelector(path ? "template[data-my-card-art]" : "template[data-my-card-face]");
      const node = template.content.firstElementChild.cloneNode(true);
      if (path) {
        const image = node.querySelector("img");
        image.setAttribute("src", image.getAttribute("src").replace("/__art__", path));
        image.setAttribute("srcset", image.getAttribute("srcset").replaceAll("/__art__", path));
        image.setAttribute("alt", `${card.title} 상징 일러스트`);
        // `MemeCardFace`: art that fails to load gives way to the poster.
        image.addEventListener("error", () => node.replaceWith(face({ ...card, thumbnailUrl: null })), { once: true });
      }
      const title = node.querySelector("[data-meme-card-title]");
      title.textContent = card.title;
      title.title = card.title;
      const summary = node.querySelector("[data-meme-card-summary]");
      if (card.summary.trim()) {
        summary.textContent = card.summary;
        summary.title = card.summary;
      } else {
        summary.remove();
      }
      const badges = node.querySelector(".meme-card-badges");
      if (card.originYear == null) badges.replaceChildren();
      else badges.querySelector(".meme-card-year").textContent = String(card.originYear);
      return node;
    };
    const item = (card) => {
      if (!card.available) {
        return element("li", {}, element("div", { class: cls("hidden-card") },
          element("span", { "aria-hidden": "true" }, "▧"),
          element("strong", {}, COPY.hidden),
          element("p", {}, COPY.hiddenBody),
          element("span", { class: cls("small") }, card.id)));
      }
      const link = element("a", { class: cls("catalog-button"), href: memeCardReturnHref(card.id, Math.ceil(card.cardNo / 24), true), "aria-label": `${card.title} · ${COPY.owned}` }, face(card));
      const date = new Intl.DateTimeFormat("ko", { dateStyle: "medium" }).format(new Date(card.claimedAt));
      return element("li", {}, link, element("p", { class: cls("claimed-date") }, date));
    };

    const render = () => {
      section.setAttribute("aria-busy", String(busy));
      heading.replaceChildren(...(status === "ready" && total !== null
        ? [element("span", { class: cls("free-badge") }, COPY.target(total)), element("p", {}, COPY.count(total))]
        : []));
      apply.disabled = busy || status !== "ready";
      for (const node of section.querySelectorAll("[data-my-cards-part]")) node.remove();
      const parts = [];
      if (status === "verifying" && !error) parts.push(element("p", { role: "status", class: cls("notice") }, COPY.checking));
      if (error) {
        const message = status === "changed" ? COPY.accountChanged : status === "failed" ? COPY.authFailure : status === "verifying" ? COPY.checking : COPY.loadFailure;
        const action = loginRequired
          ? element("a", { href: "/login?next=%2Fmy%23meme-cards", class: cls("primary-button") }, COPY.loginClaim)
          : element("button", { type: "button", class: cls("secondary-button") }, COPY.retry);
        if (!loginRequired) {
          action.disabled = busy || status === "verifying";
          action.addEventListener("click", () => (status === "changed" ? location.reload() : load(page?.page ?? 1)));
        }
        parts.push(element("div", { class: cls("empty") }, element("p", { role: status === "verifying" ? "status" : "alert" }, message), action));
      }
      if (status === "ready" && !error && page?.cards.length === 0) {
        const filtered = Boolean(filters.query || filters.category);
        parts.push(element("div", { class: cls("empty") },
          element("h3", {}, filtered ? COPY.noResults : COPY.empty),
          element("p", {}, filtered ? COPY.noResultsBody : COPY.emptyBody),
          element("a", { href: "/meme-cards", class: cls("primary-button") }, COPY.start)));
      }
      if (status === "ready" && page && page.cards.length > 0) {
        parts.push(element("ul", { class: cls("grid") }, ...page.cards.map(item)));
      }
      const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
      if (status === "ready" && !error && page && pages > 1) {
        const nav = element("nav", { class: cls("pagination"), "aria-label": COPY.my });
        if (page.page > 1) {
          const previous = element("button", { type: "button", class: cls("secondary-button") }, COPY.previous);
          previous.disabled = busy;
          previous.addEventListener("click", () => load(page.page - 1));
          nav.append(previous);
        }
        nav.append(element("span", {}, COPY.page(page.page, pages)));
        if (page.hasMore) {
          const next = element("button", { type: "button", class: cls("secondary-button") }, COPY.next);
          next.disabled = busy;
          next.addEventListener("click", () => load(page.page + 1));
          nav.append(next);
        }
        parts.push(nav);
      }
      for (const part of parts) part.dataset.myCardsPart = "";
      catalog.before(...parts);
    };

    const invalidate = (next) => {
      epoch += 1;
      request?.abort();
      status = next;
      if (next !== "verifying") retained = { page: null, total: null, error: true };
      page = null;
      total = null;
      error = true;
      busy = false;
      loginRequired = next === "signed-out";
      render();
    };
    const verify = async (at, restore = false) => {
      try {
        const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
        if (at !== epoch) return false;
        if (!response.ok && ![400, 401, 403].includes(response.status)) throw new Error(String(response.status));
        const user = response.ok ? (await response.json())?.user : null;
        if (at !== epoch) return false;
        if (!user) {
          invalidate("signed-out");
          return false;
        }
        if (user.id !== owner) {
          invalidate("changed");
          return false;
        }
        status = "ready";
        loginRequired = false;
        if (restore) ({ page, total, error } = retained);
        render();
        return true;
      } catch {
        if (at === epoch) invalidate("failed");
        return false;
      }
    };
    const load = async (target, next = filters) => {
      if (["signed-out", "changed", "verifying"].includes(status)) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const at = epoch;
      busy = true;
      error = false;
      loginRequired = false;
      render();
      const params = new URLSearchParams({ page: String(target) });
      if (next.query) params.set("query", next.query);
      if (next.category) params.set("category", next.category);
      const fetchPage = async (search) => {
        const response = await fetch(`/api/meme-cards/collection?${search}`, { signal: controller.signal, cache: "no-store" });
        if (controller.signal.aborted || epoch !== at) throw new Error("stale_collection");
        if (response.status === 401) {
          invalidate("signed-out");
          throw new Error("signed_out");
        }
        if (!response.ok) throw new Error("collection_failed");
        const result = await response.json();
        if (!Array.isArray(result.cards) || typeof result.total !== "number") throw new Error("invalid_collection");
        return result;
      };
      try {
        if (!(await verify(at)) || controller.signal.aborted) return;
        const filtered = Boolean(next.query || next.category);
        const [result, complete] = await Promise.all([
          fetchPage(params),
          total === null && filtered ? fetchPage(new URLSearchParams({ page: "1" })) : Promise.resolve(null),
        ]);
        if (controller.signal.aborted || epoch !== at || !(await verify(at)) || controller.signal.aborted) return;
        const full = complete?.total ?? (!filtered ? result.total : total);
        retained = { page: result, total: full, error: false };
        page = result;
        filters = next;
        if (complete) total = complete.total;
        else if (!filtered) total = result.total;
      } catch {
        if (!controller.signal.aborted && epoch === at) {
          retained.error = true;
          error = true;
        }
      } finally {
        if (!controller.signal.aborted && epoch === at) busy = false;
        render();
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      load(1, { query: String(data.get("query") ?? "").trim(), category: String(data.get("category") ?? "") });
    });
    const revalidate = () => {
      invalidate("verifying");
      verify(epoch, true);
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") revalidate();
    });
    epoch += 1;
    verify(epoch);
  }
}

// MyRecent: the memes this browser viewed last (`mc_recent_memes`, kept by
// the meme page), at most six, as cards; nothing at all when there are none.
// "전체 지우기" forgets them and hides the section.
{
  const section = document.querySelector("section[data-my-recent]");
  if (section) {
    const RECENT_KEY = "mc_recent_memes";
    const hide = () => section.remove();
    let ids = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      ids = Array.isArray(parsed) ? parsed : [];
    } catch {
      ids = [];
    }
    if (ids.length === 0) hide();
    else {
      fetch(`/_axum/my/recent?ids=${encodeURIComponent(ids.slice(0, 6).join(","))}`, { credentials: "same-origin" })
        .then((response) => (response.status === 200 ? response.text() : ""))
        .then((html) => {
          if (!html) return hide();
          const template = document.createElement("template");
          template.innerHTML = html;
          const filled = template.content.firstElementChild;
          section.replaceWith(filled);
          filled.querySelector("[data-my-recent-clear]")?.addEventListener("click", () => {
            try {
              localStorage.removeItem(RECENT_KEY);
            } catch {
              /* the section goes all the same */
            }
            filled.remove();
          });
        })
        .catch(hide);
    }
  }
}
