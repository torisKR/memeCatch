// components/originals-editorial/original-edition-content.tsx: copy the
// edition's link, and save the illustration with its caption as a PNG card
// drawn on a canvas, as the component does.
{
  const edition = document.querySelector("main[data-edition-slug]");
  if (edition) {
    const status = edition.querySelector("[data-edition-status]");
    const copyButton = edition.querySelector("[data-copy-link]");
    const saveButton = edition.querySelector("[data-save-card]");
    const STATUS = {
      idle: "한국어 원문 캡션과 출처가 포함된 PNG로 저장됩니다.",
      busy: "밈 카드를 만드는 중입니다…",
      success: "밈 카드 PNG를 저장했어요.",
      error: "밈 카드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
      copyError: "링크를 복사하지 못했어요. 다시 시도해 주세요.",
    };
    const FONT = 'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    let saveState = "idle";
    let copyState = "idle";

    const render = () => {
      const failed = saveState === "error" || copyState === "error";
      status.textContent = copyState === "error" ? STATUS.copyError : STATUS[saveState];
      status.classList.toggle("original-edition-error", failed);
      saveButton.disabled = saveState === "busy";
      saveButton.lastChild.textContent = saveState === "busy" ? "카드 만드는 중…" : "문구 포함 카드 저장";
      const icon = edition.querySelector(`template[data-icon="${copyState === "success" ? "check" : "copy"}"]`);
      copyButton.replaceChildren(icon.content.firstElementChild.cloneNode(true), copyState === "success" ? "링크 복사됨" : "작품 링크 복사");
    };

    const wrapCaption = (caption, maxWidth, context) => {
      const words = caption.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
      const lines = [];
      let current = "";
      context.font = `800 42px ${FONT}`;
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (current && context.measureText(next).width > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
      return lines.slice(0, 3);
    };

    const renderCaptionCard = async (imagePath, caption) => {
      if (!/^\/images\/originals\/[a-z0-9-]+\.png$/.test(imagePath)) throw new Error("editorial_image_path_invalid");
      await document.fonts?.ready;
      const image = await new Promise((resolve, reject) => {
        const element = document.createElement("img");
        element.decoding = "async";
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("editorial_image_load_failed"));
        element.src = imagePath;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("editorial_canvas_unavailable");
      context.fillStyle = "#f3f2ed";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, 1080, 1080);
      const lines = wrapCaption(caption, 952, context);
      context.fillStyle = "#18181a";
      context.textAlign = "left";
      context.textBaseline = "top";
      context.font = `800 42px ${FONT}`;
      lines.forEach((line, index) => context.fillText(line, 64, 1110 + index * 54));
      context.fillStyle = "#a52b13";
      context.font = `800 24px ${FONT}`;
      context.fillText("MEMECATCH ORIGINAL", 64, 1290);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("editorial_card_encode_failed");
      return blob;
    };

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(edition.dataset.shareUrl);
        copyState = "success";
      } catch {
        copyState = "error";
      }
      render();
    });

    saveButton.addEventListener("click", async () => {
      if (saveState === "busy") return;
      saveState = "busy";
      render();
      try {
        const blob = await renderCaptionCard(edition.dataset.editionImage, edition.dataset.editionCaption);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `memecatch-${edition.dataset.editionSlug}-meme-card.png`;
        link.hidden = true;
        document.body.append(link);
        try {
          link.click();
        } finally {
          link.remove();
          URL.revokeObjectURL(url);
        }
        saveState = "success";
      } catch {
        saveState = "error";
      }
      render();
    });
  }
}
