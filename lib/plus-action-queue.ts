import {
  buildSavedReuseRadar,
  type SavedReuseRadarItem,
} from "@/lib/saved-reuse-radar";

export type PlusActionKind = "useNow" | "checkContext" | "review";

export type PlusAction = {
  kind: PlusActionKind;
  item: SavedReuseRadarItem;
};

export function buildPlusActionQueue(
  items: readonly SavedReuseRadarItem[],
): PlusAction[] {
  const radar = buildSavedReuseRadar(items);
  const candidates: Array<[PlusActionKind, SavedReuseRadarItem | undefined]> = [
    ["useNow", radar.readyNow[0]],
    ["checkContext", radar.checkContext[0]],
    ["review", radar.archive[0]],
  ];

  return candidates.flatMap(([kind, item]) => (item ? [{ kind, item }] : []));
}
