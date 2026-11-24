// `DictionaryArtifact` of components/studio/artifact-studio.tsx: the card
// drawn on a canvas once the rights are confirmed and the fields are
// filled, and its PNG. The studio (ui/studio.js) and the meme editor
// (ui/admin-memes.js) both run it.
import { downloadBlob, renderDictionaryCard } from "@/components/studio/meme-artifacts";

const CANVAS = "mx-auto max-h-[650px] w-full object-contain";

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** `root`: the artifact's markup; `rights`: the rights checkbox. */
export function dictionaryCard(root, rights) {
  const field = (name) => root.querySelector(`[name="${name}"]`);
  const [renderButton, download] = root.querySelectorAll(".flex.flex-wrap.gap-2 > button");
  const names = ["dictionary-name", "dictionary-summary", "dictionary-safety", "dictionary-detail-url", "dictionary-source"];
  const detailUrl = field("dictionary-detail-url");
  const preset = field("artifact-preset");
  const canvas = root.querySelector("canvas");
  const placeholder = canvas.nextElementSibling;
  let rendered = false;
  let urlError = null;

  const show = () => {
    canvas.className = `${CANVAS} ${rendered ? "block" : "hidden"}`;
    if (rendered) placeholder.remove();
    else if (!placeholder.isConnected) canvas.after(placeholder);
  };
  const validUrl = () => {
    try {
      const parsed = new URL(detailUrl.value.trim());
      return parsed.protocol === "https:" && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  };
  const data = () => ({
    name: field("dictionary-name").value,
    summary: field("dictionary-summary").value,
    safety: field("dictionary-safety").value,
    detailUrl: detailUrl.value,
    source: field("dictionary-source").value,
  });
  const ready = () => {
    const value = data();
    return value.name.trim().length > 0 && value.summary.trim().length > 0 && validUrl() && value.source.trim().length > 0;
  };
  const update = () => {
    const invalid = Boolean(detailUrl.value) && !validUrl();
    if (detailUrl.value) detailUrl.setAttribute("aria-invalid", String(invalid));
    else detailUrl.removeAttribute("aria-invalid");
    if (invalid && !urlError) {
      urlError = element("p", "text-sm text-accent-text", "https로 시작하는 올바른 주소를 입력해 주세요.");
      urlError.setAttribute("role", "alert");
      detailUrl.closest("label").after(urlError);
    } else if (!invalid && urlError) {
      urlError.remove();
      urlError = null;
    }
    renderButton.disabled = !rights.checked || !ready();
    download.disabled = !(rights.checked && rendered);
    show();
  };
  for (const name of names) {
    field(name).addEventListener("input", () => {
      rendered = false;
      update();
    });
  }
  preset.addEventListener("change", () => {
    rendered = false;
    update();
  });
  renderButton.addEventListener("click", () => {
    if (!rights.checked || !ready()) return;
    renderDictionaryCard(canvas, preset.value, data());
    rendered = true;
    update();
  });
  download.addEventListener("click", () => canvas.toBlob((blob) => blob && downloadBlob(blob, "memecatch-dictionary-card.png"), "image/png"));
  update();
  return { root, update, dispose: () => {} };
}
