import { createMemo, createEffect, createSignal, onCleanup } from "solid-js";
import { BASE_URL } from "../../data/resources";
import type { Selection } from "./useSelection";

const EMBED_MAP_HASH =
  '#{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"popupText":[""],"iconName":"Hex_Logo","turnLayerOff":["ruinedLayer","treesLayer","templesLayer"]},"geometry":{"type":"Point","coordinates":[-5000,-5000]}}]}';
const IFRAME_DEBOUNCE_MS = 400;

type MapUrlOptions = {
  includePlayerId?: () => boolean;
  playerIds?: () => string[];
};

export function useMapUrl(selection: () => Selection[], options?: MapUrlOptions) {
  const url = createMemo(() => {
    const selectedItems = selection();

    const resourceIds = new Set<number>();
    const enemyIds = new Set<number>();

    for (const item of selectedItems) {
      const target = item.param === "resourceId" ? resourceIds : enemyIds;
      for (const id of item.ids) {
        if (Number.isInteger(id)) target.add(id);
      }
    }

    const params: string[] = [];
    if (resourceIds.size > 0) {
      params.push(`resourceId=${Array.from(resourceIds).join(",")}`);
    }
    if (enemyIds.size > 0) {
      params.push(`enemyId=${Array.from(enemyIds).join(",")}`);
    }
    if (options?.includePlayerId?.()) {
      const playerIds = options.playerIds?.() ?? [];
      const normalizedPlayerIds = playerIds
        .map((rawId) => rawId.trim())
        .filter((playerId) => playerId.length > 0);
      if (normalizedPlayerIds.length > 0) {
        params.push(`playerId=${normalizedPlayerIds.map(encodeURIComponent).join(",")}`);
      }
    }

    if (params.length === 0) return "";
    return `${BASE_URL}?${params.join("&")}`;
  });

  const [iframeUrl, setIframeUrl] = createSignal(`${BASE_URL}${EMBED_MAP_HASH}`);

  createEffect(() => {
    const target = `${url() || BASE_URL}${EMBED_MAP_HASH}`;
    const timer = setTimeout(() => setIframeUrl(target), IFRAME_DEBOUNCE_MS);
    onCleanup(() => clearTimeout(timer));
  });

  const hasT1Selected = createMemo(() =>
    selection().some((item) => item.type === "tiered" && item.tier === "T1"),
  );

  return { url, iframeUrl, hasT1Selected };
}
