import { createSignal, createMemo } from "solid-js";
import type { QueryParam, TieredResource, UniqueCategory, UniqueItem } from "../../data/resources";

export type Selection =
  | { type: "tiered"; resourceName: string; tier: string; ids: number[]; param: QueryParam }
  | { type: "unique"; categoryName: string; itemName: string; ids: number[]; param: QueryParam };

export function useSelection() {
  const [selection, setSelection] = createSignal<Selection[]>([]);

  const selectionKeys = createMemo(() => {
    const keys = new Set<string>();
    for (const item of selection()) {
      if (item.type === "tiered") {
        keys.add(`t:${item.resourceName}:${item.tier}`);
      } else {
        keys.add(`u:${item.categoryName}:${item.itemName}`);
      }
    }
    return keys;
  });

  function toggleTiered(resource: TieredResource, tier: string) {
    const ids = resource.tiers[tier];
    if (!ids?.length) return;
    setSelection((current) => {
      const exists = current.some(
        (item) =>
          item.type === "tiered" && item.resourceName === resource.name && item.tier === tier,
      );

      if (exists) {
        return current.filter(
          (item) =>
            !(
              item.type === "tiered" &&
              item.resourceName === resource.name &&
              item.tier === tier
            ),
        );
      }

      return [
        ...current,
        { type: "tiered", resourceName: resource.name, tier, ids, param: resource.param },
      ];
    });
  }

  function toggleUnique(category: UniqueCategory, item: UniqueItem) {
    setSelection((current) => {
      const exists = current.some(
        (selected) =>
          selected.type === "unique" &&
          selected.categoryName === category.name &&
          selected.itemName === item.name,
      );

      if (exists) {
        return current.filter(
          (selected) =>
            !(
              selected.type === "unique" &&
              selected.categoryName === category.name &&
              selected.itemName === item.name
            ),
        );
      }

      return [
        ...current,
        {
          type: "unique",
          categoryName: category.name,
          itemName: item.name,
          ids: item.ids,
          param: category.param,
        },
      ];
    });
  }

  function isTieredSelected(name: string, tier: string): boolean {
    return selectionKeys().has(`t:${name}:${tier}`);
  }

  function isUniqueSelected(categoryName: string, itemName: string): boolean {
    return selectionKeys().has(`u:${categoryName}:${itemName}`);
  }

  function clear() {
    setSelection([]);
  }

  return {
    selection,
    setSelection,
    toggleTiered,
    toggleUnique,
    isTieredSelected,
    isUniqueSelected,
    clear,
  };
}
