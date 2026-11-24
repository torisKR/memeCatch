// The meme editors (pages/admin/meme_new.rs, …): the client parts of
// components/admin/house-original-form.tsx over routes/admin/memes.rs.
// admin.js passes its `post` and `element`.
import { sanitizeStudioText } from "@/components/studio/meme-artifacts";

const STUDIO = "/api/admin/meme-studio";

export function memeComponents({ post, element }) {
  // HouseOriginalForm: the Bedrock drafts, saving one directly or into the
  // fields, and the save itself; `router.push` to the new meme.
  const houseOriginal = (form) => {
    const countries = JSON.parse(form.dataset.adminCountries);
    const field = (name) => form.querySelector(`[data-admin-field="${name}"]`);
    const studio = form.querySelector("[data-admin-studio]");
    const generate = studio.querySelector("[data-admin-generate]");
    const submitButton = form.querySelector("button[type=submit]");
    const studioFields = ["topic", "country", "tone", "format"].map(field);
    let pending = false;
    let loading = false;
    let result = null;
    let selected = null;
    let saving = null;
    let studioError = null;

    const showError = (text) => {
      form.querySelector(":scope > [data-admin-error]")?.remove();
      if (text === null) return;
      const alert = element("p", "rounded-lg bg-safety-red-bg p-3 text-base text-safety-red", text);
      alert.dataset.adminError = "";
      alert.setAttribute("role", "alert");
      studio.after(alert);
    };
    const sync = () => {
      generate.disabled = field("topic").value.trim().length < 2 || loading;
      generate.textContent = loading ? "초안 만드는 중…" : "자체 밈 초안 3개 만들기";
      for (const each of studioFields) each.disabled = loading;
      submitButton.disabled = pending;
      submitButton.textContent = pending ? "저장 중…" : "대기로 저장";
    };
    const usageContext = () => Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, field(key).value]));
    const conceptInput = (concept) => {
      const topic = sanitizeStudioText(field("topic").value.trim());
      const label = countries[concept.country_code] ?? countries[field("country").value];
      return {
        title: sanitizeStudioText(concept.headline).replace(/\s+/g, " ").trim(),
        summary: sanitizeStudioText(concept.caption).replace(/\s+/g, " ").trim(),
        description: `현지 맥락: ${sanitizeStudioText(concept.cultural_anchor).trim()}\n\n비주얼: ${sanitizeStudioText(concept.visual_brief).trim()}\n\n왜 통하나요? ${sanitizeStudioText(concept.why_it_works).trim()}\n\n추천 활용: ${sanitizeStudioText(concept.usage_context).trim()}`,
        origin: `밈캐치가 ${label}의 "${topic}" 주제로 문구를 자체 기획해 만든 밈입니다. 외부 SNS 원본이나 제3자 미디어를 사용하지 않았습니다.`,
        country: concept.country_code,
        localTitle: sanitizeStudioText(concept.local_caption).replace(/\s+/g, " ").trim(),
        safetyLevel: "yellow",
        category: field("format").value === "caption" ? "phrase" : "image",
        difficulty: "normal",
        originYear: new Date().getFullYear(),
        usageContext: usageContext(),
      };
    };
    // The alert and the drafts at the end of the studio section.
    const renderStudio = () => {
      studio.querySelectorAll(":scope > [data-admin-after]").forEach((node) => node.remove());
      const after = [];
      if (studioError) {
        const alert = element("p", "rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red", studioError);
        alert.setAttribute("role", "alert");
        after.push(alert);
      }
      if (result) {
        const box = element("div", "space-y-3");
        box.setAttribute("aria-live", "polite");
        const grid = element("div", "grid gap-3 lg:grid-cols-3");
        result.concepts.forEach((concept, index) => grid.append(conceptCard(concept, index)));
        box.append(element("p", "text-sm font-semibold text-accent-text", result.mode === "ai" && result.provider === "bedrock" ? "AWS Bedrock 초안" : "$0 기본 템플릿 초안"), grid);
        after.push(box);
      }
      for (const node of after) {
        node.dataset.adminAfter = "";
        studio.append(node);
      }
    };
    const save = async (input, onFailure) => {
      pending = true;
      sync();
      renderStudio();
      const answer = await post("house-original", input);
      if (answer === null) return;
      if (!answer.ok) {
        pending = false;
        onFailure?.();
        sync();
        renderStudio();
        showError(answer.error);
        return;
      }
      location.assign(`/admin/memes/${answer.data?.memeId}`);
    };
    const conceptCard = (concept, index) => {
      const card = element("article", `rounded-lg border bg-surface p-3 ${selected === index ? "border-accent" : "border-border"}`);
      const headline = sanitizeStudioText(concept.headline);
      const labelled = (label, text, className) => {
        const line = element("p", className);
        line.append(element("strong", "", label), ` ${text}`);
        return line;
      };
      card.append(
        element("h3", "font-bold", headline),
        element("p", "mt-1 text-xs font-semibold text-accent-text", countries[concept.country_code] ?? concept.country_code),
        element("p", "mt-2 whitespace-pre-line text-sm leading-relaxed", sanitizeStudioText(concept.caption)),
        labelled("현지 문구:", sanitizeStudioText(concept.local_caption), "mt-2 text-sm leading-relaxed"),
        labelled("현지 맥락:", sanitizeStudioText(concept.cultural_anchor), "mt-2 text-xs leading-relaxed text-muted"),
        labelled("비주얼:", sanitizeStudioText(concept.visual_brief), "mt-2 text-xs leading-relaxed text-muted"),
        element("p", "mt-2 text-xs leading-relaxed text-muted", sanitizeStudioText(concept.why_it_works)),
      );
      const buttons = element("div", "mt-3 grid gap-2");
      const direct = element("button", "min-h-11 rounded-lg bg-accent-strong px-3 text-sm font-semibold text-white disabled:opacity-50", saving === index ? "대기로 저장 중…" : "대기로 바로 저장");
      direct.type = "button";
      direct.disabled = pending;
      direct.setAttribute("aria-label", `“${headline}” 대기로 바로 저장`);
      direct.addEventListener("click", () => {
        showError(null);
        saving = index;
        void save(conceptInput(concept), () => {
          saving = null;
        });
      });
      const apply = element("button", "min-h-11 rounded-lg border border-accent px-3 text-sm font-semibold text-accent-text disabled:opacity-50", selected === index ? "아래 항목에 적용됨" : "수정 후 저장");
      apply.type = "button";
      apply.disabled = pending;
      apply.setAttribute("aria-label", `“${headline}” 초안 사용`);
      apply.addEventListener("click", () => {
        const input = conceptInput(concept);
        for (const key of ["title", "summary", "description", "origin"]) field(key).value = input[key];
        field("originYear").value = String(input.originYear);
        field("category").value = input.category;
        selected = index;
        showError(null);
        renderStudio();
      });
      buttons.append(direct, apply);
      card.append(buttons);
      return card;
    };
    const reset = () => {
      result = null;
      selected = null;
      studioError = null;
      renderStudio();
      sync();
    };
    for (const each of studioFields) each.addEventListener(each.tagName === "INPUT" ? "input" : "change", reset);
    generate.addEventListener("click", async () => {
      const topic = field("topic").value.trim();
      if (topic.length < 2 || loading) return;
      loading = true;
      studioError = null;
      sync();
      renderStudio();
      try {
        const response = await fetch(STUDIO, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topic, tone: field("tone").value, format: field("format").value, country: field("country").value }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || "error" in payload) {
          studioError = response.status === 429 ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." : "초안을 만들지 못했습니다. 입력을 확인하고 다시 시도해 주세요.";
          return;
        }
        result = payload;
        selected = null;
      } catch {
        studioError = "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
      } finally {
        loading = false;
        sync();
        renderStudio();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      showError(null);
      const raw = field("originYear").value.trim();
      const year = raw ? Number(raw) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
        showError("제작 연도는 1980~2100 사이 숫자로 입력해 주세요.");
        return;
      }
      const title = field("title").value;
      void save({
        title,
        summary: field("summary").value,
        description: field("description").value,
        origin: field("origin").value,
        safetyLevel: field("safetyLevel").value,
        category: field("category").value,
        difficulty: field("difficulty").value,
        originYear: year,
        usageContext: usageContext(),
        country: field("country").value,
        localTitle: selected === null ? title : result?.concepts[selected]?.local_caption ?? title,
      });
    });
  };

  // CatalogRegistrationForm: any change forgets the last duplicate check;
  // registering checks again first, and keeps one request id until a change.
  const catalog = (form) => {
    const field = (scope, name) => scope.querySelector(`[data-admin-field="${name}"]`);
    const sourcesSection = form.querySelector("[data-admin-sources]");
    const addButton = sourcesSection.querySelector("[data-admin-add]");
    const checkButton = form.querySelector("[data-admin-check]");
    const submitButton = form.querySelector("button[type=submit]");
    const fieldsets = () => [...sourcesSection.querySelectorAll("fieldset[data-admin-source]")];
    let pending = false;
    let message = null;
    let duplicates = [];
    let checked = null;
    let registrationKey = null;

    const fingerprint = () => JSON.stringify([field(form, "title").value.trim(), ...fieldsets().map((set) => field(set, "url").value.trim())]);
    const render = () => {
      form.querySelectorAll(":scope > [data-admin-after-intro]").forEach((node) => node.remove());
      const intro = form.firstElementChild;
      const nodes = [];
      if (message) {
        const note = element("p", "rounded-lg border border-border bg-surface-2 p-3 text-sm", message);
        note.setAttribute("role", "status");
        nodes.push(note);
      }
      if (duplicates.length > 0) {
        const list = element("ul", "space-y-2 rounded-xl border border-safety-yellow bg-safety-yellow-bg p-4");
        list.setAttribute("aria-label", "중복 후보");
        for (const match of duplicates) {
          const item = element("li", "text-sm");
          const link = element("a", "font-semibold underline", match.title);
          link.href = `/admin/memes/${match.memeId}`;
          item.append(link, ` · ${match.reason === "title" ? "제목 일치" : "출처 URL 일치"}`);
          list.append(item);
        }
        nodes.push(list);
      }
      for (const node of nodes.reverse()) {
        node.dataset.adminAfterIntro = "";
        intro.after(node);
      }
      checkButton.disabled = pending;
      submitButton.disabled = pending || duplicates.length > 0;
      submitButton.textContent = pending ? "확인 중…" : "대기 상태로 등록";
      const count = fieldsets().length;
      addButton.disabled = count >= 8;
      addButton.textContent = `출처 추가 (${count}/8)`;
    };
    const changed = () => {
      checked = null;
      duplicates = [];
      message = null;
      registrationKey = null;
      render();
    };
    form.addEventListener("input", changed);
    form.addEventListener("change", changed);
    // A further source: every role, "사용 예시" and "권리 미확인" chosen.
    const relabel = () =>
      fieldsets().forEach((set, index) => {
        if (index >= 2) set.querySelector("legend").textContent = `추가 출처 ${index - 1}`;
      });
    addButton.addEventListener("click", () => {
      if (fieldsets().length >= 8) return;
      const copy = fieldsets()[1].cloneNode(true);
      for (const input of copy.querySelectorAll("input")) input.value = "";
      const roles = field(copy, "sourceRole");
      roles.replaceChildren(...JSON.parse(form.dataset.adminRoles).map(([value, label]) => {
        const option = element("option", "", label);
        option.value = value;
        return option;
      }));
      roles.value = "usage_example";
      field(copy, "platform").value = "web";
      field(copy, "rightsBasis").value = "unknown";
      const remove = element("button", "min-h-11 rounded-lg border border-border px-3 text-sm text-muted", "이 출처 제거");
      remove.type = "button";
      remove.addEventListener("click", () => {
        copy.remove();
        relabel();
        changed();
      });
      copy.append(remove);
      addButton.before(copy);
      relabel();
      changed();
    });
    const lines = (value) => value.split(",").map((part) => part.trim()).filter(Boolean);
    const year = (value) => (value.trim() ? Number(value) : null);
    const check = async () => {
      message = null;
      duplicates = [];
      render();
      const result = await post("catalog-duplicates", { title: field(form, "title").value, sourceUrls: fieldsets().map((set) => field(set, "url").value) });
      if (result === null) return null;
      if (!result.ok) {
        message = result.error.message;
        return false;
      }
      checked = fingerprint();
      duplicates = result.data.matches;
      if (duplicates.length > 0) {
        message = "기존 항목과 겹칠 가능성이 있어요. 기존 밈을 확인한 뒤 등록 여부를 다시 판단해 주세요.";
        return false;
      }
      message = "중복 후보가 없어요. 이제 대기 상태로 등록할 수 있어요.";
      return true;
    };
    const run = async (work) => {
      pending = true;
      render();
      const done = await work();
      if (done === null) return;
      pending = false;
      render();
    };
    checkButton.addEventListener("click", () => void run(check));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const before = duplicates.length;
      void run(async () => {
        if (checked !== fingerprint()) {
          const ok = await check();
          if (ok !== true) return ok;
        }
        if (before > 0) return false;
        registrationKey ??= crypto.randomUUID();
        const body = (name) => field(form, name).value;
        const result = await post("catalog-register", {
          registrationKey,
          title: body("title"),
          aliases: lines(body("aliases")),
          summary: body("summary"),
          description: body("description"),
          origin: body("origin"),
          sourceWorkYear: year(body("sourceWorkYear")),
          memeFirstSeenYear: year(body("memeFirstSeenYear")),
          koreaViralYear: year(body("koreaViralYear")),
          yearPrecision: body("yearPrecision"),
          tags: lines(body("tags")),
          safetyLevel: body("safetyLevel"),
          category: body("category"),
          difficulty: body("difficulty"),
          sentiment: body("sentiment"),
          usageContext: Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, body(key)])),
          sources: fieldsets().map((set) => ({
            url: field(set, "url").value,
            platform: field(set, "platform").value,
            sourceRole: field(set, "sourceRole").value,
            rightsBasis: field(set, "rightsBasis").value,
            title: field(set, "title").value,
            creatorName: field(set, "creatorName").value,
            reviewNote: field(set, "reviewNote").value,
          })),
        });
        if (result === null) return null;
        if (!result.ok) {
          message = result.error.message;
          return false;
        }
        if (result.data.status === "duplicate") {
          duplicates = result.data.matches;
          message = "저장 직전에 중복 항목이 확인되어 등록하지 않았어요.";
          return false;
        }
        location.assign(`/admin/memes/${result.data.memeId}`);
        return null;
      });
    });
  };

  return { "house-original": houseOriginal, catalog };
}
