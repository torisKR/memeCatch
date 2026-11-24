// /studio: components/studio/meme-studio-app.tsx and components/studio/artifact-studio.tsx.
// Two workspaces: ideas (a topic, a tone and a format → POST /api/meme-studio,
// three concepts to copy; the reference search on the topic) and the
// artifacts (an image meme or a dictionary card drawn on a canvas in the
// browser and saved as PNG, after the rights are confirmed). The page carries
// components/studio/meme-artifacts.ts, lib/upload.ts and ui/reference-search.js
// (scripts/build-ui.mjs, PAGE_FILES).
import { downloadBlob, renderImageArtifact, sanitizeStudioText } from "@/components/studio/meme-artifacts";
import { dictionaryCard } from "@/server/ui/dictionary-card";
import { validateUploadFile } from "@/lib/upload";
import { referenceSearch } from "@/server/ui/reference-search";

{
  const main = document.querySelector("main[data-studio]");
  if (main) {
    const COPIED_MS = 2000;
    const SELECTED = "border-accent bg-accent-strong text-white";
    const UNSELECTED = "border-border bg-surface text-muted hover:border-accent hover:text-accent";
    const WORKSPACE = "min-h-11 rounded-xl border px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
    const TONE = "min-h-11 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
    const FORMAT = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
    const MODE = "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
    const CANVAS = "mx-auto max-h-[650px] w-full object-contain";

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    // One choice of a group: `aria-pressed` and the two looks.
    const choose = (buttons, attribute, value, base, hint) => {
      for (const button of buttons) {
        const active = button.getAttribute(attribute) === value;
        button.setAttribute("aria-pressed", String(active));
        button.className = `${base} ${active ? SELECTED : UNSELECTED}`;
        const small = hint ? button.querySelectorAll("span")[1] : null;
        if (small) small.className = `block text-xs ${active ? hint[0] : hint[1]}`;
      }
    };

    // The workspaces.
    const workspaces = main.querySelectorAll("[data-studio-workspace]");
    for (const button of workspaces) {
      button.addEventListener("click", () => {
        const value = button.dataset.studioWorkspace;
        choose(workspaces, "data-studio-workspace", value, WORKSPACE, ["text-white/85", "text-muted"]);
        for (const other of workspaces) {
          document.getElementById(`studio-workspace-${other.dataset.studioWorkspace}`).hidden = other !== button;
        }
      });
    }

    // Ideas.
    const topic = main.querySelector("#studio-topic");
    const generateButton = main.querySelector("[data-studio-generate]");
    const results = main.querySelector("[data-studio-results]");
    const tones = main.querySelectorAll("[data-studio-tone]");
    const formats = main.querySelectorAll("[data-studio-format]");
    const reference = referenceSearch(main.querySelector("[data-studio-reference]"), "");
    let tone = [...tones].find((button) => button.getAttribute("aria-pressed") === "true").dataset.studioTone;
    let format = [...formats].find((button) => button.getAttribute("aria-pressed") === "true").dataset.studioFormat;
    let loading = false;
    let errorMsg = null;
    let result = null;
    let copyState = null;
    let heading = null;
    let referenceQuery = "";
    const emptyState = results.firstElementChild;

    for (const button of tones) {
      button.addEventListener("click", () => {
        tone = button.dataset.studioTone;
        choose(tones, "data-studio-tone", tone, TONE, ["text-white/80", ""]);
      });
    }
    for (const button of formats) {
      button.addEventListener("click", () => {
        format = button.dataset.studioFormat;
        choose(formats, "data-studio-format", format, FORMAT);
      });
    }

    const canSubmit = () => topic.value.trim().length >= 2 && !loading;
    const headingText = () => `“${sanitizeStudioText(topic.value.trim())}” 게시물 아이디어 ${result.concepts.length}개`;

    function renderButton() {
      generateButton.disabled = !canSubmit();
      generateButton.textContent = loading ? "아이디어를 만드는 중입니다" : "밈 아이디어 만들기";
    }

    function renderResults() {
      results.setAttribute("aria-busy", String(loading));
      results.replaceChildren();
      heading = null;
      if (errorMsg) {
        const alert = el("p", "rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm font-medium text-accent-text", errorMsg);
        alert.setAttribute("role", "alert");
        results.append(alert);
      }
      if (loading) {
        for (let index = 0; index < 3; index += 1) {
          const bone = el("div", "mt-3 h-40 animate-pulse rounded-xl border border-border bg-surface-2 motion-reduce:animate-none");
          bone.setAttribute("aria-hidden", "true");
          results.append(bone);
        }
      }
      if (!loading && result) {
        const head = el("div", "flex items-center justify-between gap-3");
        heading = el("h2", "text-lg font-extrabold tracking-tight", headingText());
        head.append(heading, el("span", "shrink-0 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text", result.mode === "ai" ? "Ox Alpha 생성" : "기본 템플릿"));
        results.append(head);
        result.concepts.forEach((concept, index) => results.append(article(concept, index)));
      }
      if (!loading && !result && !errorMsg) results.append(emptyState);
    }

    function article(concept, index) {
      const node = el("article", "mt-4 overflow-hidden rounded-xl border border-border bg-surface p-5");
      node.append(el("p", "text-sm font-bold text-accent", sanitizeStudioText(concept.headline)));
      node.append(el("blockquote", "mt-2 rounded-xl bg-accent-soft px-4 py-3 text-base font-extrabold leading-relaxed text-foreground", `“${sanitizeStudioText(concept.caption)}”`));
      const list = el("dl", "mt-3 space-y-1.5 text-sm leading-relaxed text-muted");
      for (const [term, value] of [["포인트:", concept.why_it_works], ["활용:", concept.usage_context]]) {
        const row = el("div", "flex gap-2");
        row.append(el("dt", "shrink-0 font-bold text-foreground", term), el("dd", "", sanitizeStudioText(value)));
        list.append(row);
      }
      node.append(list);
      const copy = el("button", "mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none");
      copy.type = "button";
      copy.setAttribute("aria-live", "polite");
      const label = () => {
        copy.textContent = copyState?.index === index ? (copyState.ok ? "문구를 복사했어요" : "복사 실패, 다시 시도") : "문구 복사";
      };
      label();
      copy.addEventListener("click", async () => {
        const ok = await copyText(sanitizeStudioText(concept.caption));
        copyState = { index, ok };
        results.querySelectorAll("article button").forEach((button) => button.dispatchEvent(new Event("studio-copy")));
        setTimeout(() => {
          if (copyState?.index === index) copyState = null;
          results.querySelectorAll("article button").forEach((button) => button.dispatchEvent(new Event("studio-copy")));
        }, COPIED_MS);
      });
      copy.addEventListener("studio-copy", label);
      node.append(copy);
      return node;
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        try {
          const area = document.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "");
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(area);
          return ok;
        } catch {
          return false;
        }
      }
    }

    const errorMessage = (status) => {
      if (status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
      if (status === 400) return "토픽과 선택 항목을 확인해 주세요.";
      return "아이디어를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
    };

    async function generate() {
      if (!canSubmit()) return;
      loading = true;
      errorMsg = null;
      renderButton();
      renderResults();
      try {
        const response = await fetch("/api/meme-studio", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topic: topic.value.trim(), tone, format }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || "error" in payload) {
          errorMsg = errorMessage(response.status);
          return;
        }
        result = payload;
        copyState = null;
      } catch {
        errorMsg = "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
      } finally {
        loading = false;
        renderButton();
        renderResults();
      }
    }

    topic.addEventListener("input", () => {
      renderButton();
      if (heading) heading.textContent = headingText();
      const query = topic.value.trim();
      if (query !== referenceQuery) {
        referenceQuery = query;
        reference.reset(query);
      }
    });
    topic.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) void generate();
    });
    generateButton.addEventListener("click", () => void generate());

    // Artifacts.
    const studio = main.querySelector("#studio-workspace-artifacts section");
    const rights = studio.querySelector('input[name="rights-confirmed"]');
    const rightsNote = studio.querySelector('p[role="status"]');
    const modes = studio.querySelectorAll("[data-studio-mode]");
    const templates = {
      image: studio.querySelector("[data-studio-artifact]").cloneNode(true),
      dictionary: studio.querySelector("template[data-studio-dictionary]").content.firstElementChild,
    };
    let mode = "image";
    let artifact = start("image", studio.querySelector("[data-studio-artifact]"));

    rights.addEventListener("change", () => {
      if (rights.checked) rightsNote.remove();
      else rights.closest("label").after(rightsNote);
      artifact.update();
    });
    for (const button of modes) {
      button.addEventListener("click", () => {
        const next = button.dataset.studioMode;
        choose(modes, "data-studio-mode", next, MODE);
        if (next === mode) return;
        mode = next;
        const fresh = templates[next].cloneNode(true);
        artifact.root.replaceWith(fresh);
        artifact.dispose();
        artifact = start(next, fresh);
      });
    }

    function start(kind, root) {
      return kind === "image" ? imageArtifact(root) : dictionaryArtifact(root);
    }

    function field(root, name) {
      return root.querySelector(`[name="${name}"]`);
    }
    // The render and download buttons.
    function buttonsOf(root) {
      return root.querySelectorAll(".flex.flex-wrap.gap-2 > button");
    }

    // The canvas shown once drawn, its placeholder until then.
    function output(root) {
      const canvas = root.querySelector("canvas");
      const placeholder = canvas.nextElementSibling;
      return {
        canvas,
        show(rendered) {
          canvas.className = `${CANVAS} ${rendered ? "block" : "hidden"}`;
          if (rendered) placeholder.remove();
          else if (!placeholder.isConnected) canvas.after(placeholder);
        },
      };
    }

    function imageArtifact(root) {
      const [renderButton, download] = buttonsOf(root);
      const file = field(root, "image-file");
      const attribution = field(root, "image-attribution");
      const preset = field(root, "artifact-preset");
      const view = output(root);
      let image = null;
      let imageReady = false;
      let rendered = false;
      let url = null;
      let fileError = null;

      const update = () => {
        const attributed = Boolean(attribution.value.trim());
        renderButton.disabled = !rights.checked || !imageReady || !attributed;
        download.disabled = !(rights.checked && attributed && rendered);
        view.show(rendered);
      };
      const stale = () => {
        rendered = false;
        update();
      };
      file.addEventListener("change", () => {
        const next = file.files?.[0] ?? null;
        const error = next ? validateUploadFile(next) : null;
        fileError?.remove();
        fileError = null;
        if (error) {
          fileError = el("p", "text-sm text-(--accent-text)", error);
          fileError.setAttribute("role", "alert");
          file.closest("label").after(fileError);
        }
        if (url) URL.revokeObjectURL(url);
        url = error || !next ? null : URL.createObjectURL(next);
        imageReady = false;
        rendered = false;
        update();
        if (!url) return;
        const loaded = new Image();
        loaded.onload = () => {
          image = loaded;
          imageReady = true;
          update();
        };
        loaded.src = url;
      });
      for (const name of ["image-top-text", "image-bottom-text", "image-attribution"]) field(root, name).addEventListener("input", stale);
      preset.addEventListener("change", stale);
      renderButton.addEventListener("click", () => {
        if (!rights.checked || !attribution.value.trim() || !image) return;
        renderImageArtifact(view.canvas, image, preset.value, {
          topText: field(root, "image-top-text").value,
          bottomText: field(root, "image-bottom-text").value,
          attribution: attribution.value,
        });
        rendered = true;
        update();
      });
      download.addEventListener("click", () => view.canvas.toBlob((blob) => blob && downloadBlob(blob, "memecatch-meme.png"), "image/png"));
      return {
        root,
        update,
        dispose: () => url && URL.revokeObjectURL(url),
      };
    }

    function dictionaryArtifact(root) {
      return dictionaryCard(root, rights);
    }
  }
}
