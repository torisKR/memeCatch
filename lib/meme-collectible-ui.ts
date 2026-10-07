import { isMemeCardId } from "@/lib/meme-collectible";

export const SCRATCH_REVEAL_RATIO = 0.35;
export type ScratchPoint = { x: number; y: number; radiusX: number; radiusY: number };

/** Equal-area cells estimate the actual erased area, independent of device pixels. */
export function createScratchCoverage(columns = 64, rows = 96) {
  const cells = new Uint8Array(columns * rows);
  let cleared = 0;
  return {
    mark(from: ScratchPoint, to = from) {
      const distance = Math.hypot((to.x - from.x) / to.radiusX, (to.y - from.y) / to.radiusY);
      const steps = Math.max(1, Math.ceil(distance * 3));
      for (let step = 0; step <= steps; step++) {
        const x = from.x + (to.x - from.x) * step / steps;
        const y = from.y + (to.y - from.y) * step / steps;
        const minCol = Math.max(0, Math.floor((x - to.radiusX) * columns));
        const maxCol = Math.min(columns - 1, Math.ceil((x + to.radiusX) * columns));
        const minRow = Math.max(0, Math.floor((y - to.radiusY) * rows));
        const maxRow = Math.min(rows - 1, Math.ceil((y + to.radiusY) * rows));
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            const dx = ((col + 0.5) / columns - x) / to.radiusX;
            const dy = ((row + 0.5) / rows - y) / to.radiusY;
            const index = row * columns + col;
            if (dx * dx + dy * dy <= 1 && !cells[index]) {
              cells[index] = 1;
              cleared++;
            }
          }
        }
      }
      return cleared / cells.length;
    },
    get ratio() { return cleared / cells.length; },
  };
}

export function scratchPoint(clientX: number, clientY: number, rect: Pick<DOMRect, "left" | "top" | "width" | "height">): ScratchPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y, radiusX: 0.075, radiusY: 0.075 * rect.width / rect.height };
}

export function memeCardReturnHref(cardId: string, page: number, revealed = true, query = "", category = "") {
  if (!isMemeCardId(cardId)) return "/meme-cards";
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query) params.set("query", query);
  if (category) params.set("category", category);
  params.set("card", cardId);
  if (revealed) params.set("revealed", "1");
  return `/meme-cards?${params}#reveal`;
}

export function memeCardCatalogHref(page = 1, query = "", category = "") {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query) params.set("query", query);
  if (category) params.set("category", category);
  return `/meme-cards${params.size ? `?${params}` : ""}`;
}
