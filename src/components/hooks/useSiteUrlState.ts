import { createMemo } from "solid-js";
import type { TieredResource, UniqueCategory } from "../../data/resources";
import type { Selection } from "./useSelection";

type ParseSiteUrlStateOptions = {
  search: string;
  tieredResources: TieredResource[];
  uniqueCategories: UniqueCategory[];
};

type ParsedSiteUrlState = {
  selection: Selection[];
  playerIds: string[];
  hasSelectionParam: boolean;
  hasPlayerIdParam: boolean;
};

type SiteUrlStateOptions = {
  selection: () => Selection[];
  includePlayerId: () => boolean;
  playerIds: () => string[];
};

function parseNumericIdSet(raw: string | null): Set<number> {
  if (!raw) return new Set<number>();

  const parsedIds = raw
    .split(",")
    .map((token) => Number.parseInt(token.trim(), 10))
    .filter((value) => Number.isInteger(value));

  return new Set(parsedIds);
}

function parsePlayerIds(raw: string | null): string[] {
  if (!raw) return [];

  const normalized = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => {
      try {
        return decodeURIComponent(token).trim();
      } catch {
        return token;
      }
    })
    .filter((playerId) => playerId.length > 0);

  return Array.from(new Set(normalized));
}

function hasAllIds(targetIds: number[], selectedIds: Set<number>): boolean {
  return targetIds.length > 0 && targetIds.every((id) => selectedIds.has(id));
}

function rebuildSelectionFromIdSets(
  resourceIds: Set<number>,
  enemyIds: Set<number>,
  tieredResources: TieredResource[],
  uniqueCategories: UniqueCategory[],
): Selection[] {
  const rebuilt: Selection[] = [];

  for (const resource of tieredResources) {
    const targetIds = resource.param === "resourceId" ? resourceIds : enemyIds;
    for (const [tier, ids] of Object.entries(resource.tiers)) {
      if (!hasAllIds(ids, targetIds)) continue;
      rebuilt.push({
        type: "tiered",
        resourceName: resource.name,
        tier,
        ids,
        param: resource.param,
      });
    }
  }

  for (const category of uniqueCategories) {
    const targetIds = category.param === "resourceId" ? resourceIds : enemyIds;
    for (const item of category.items) {
      if (!hasAllIds(item.ids, targetIds)) continue;
      rebuilt.push({
        type: "unique",
        categoryName: category.name,
        itemName: item.name,
        ids: item.ids,
        param: category.param,
      });
    }
  }

  return rebuilt;
}

export function parseSiteUrlState(options: ParseSiteUrlStateOptions): ParsedSiteUrlState {
  const params = new URLSearchParams(options.search);
  const hasSelectionParam = params.has("resourceId") || params.has("enemyId");
  const hasPlayerIdParam = params.has("playerId");

  const resourceIds = parseNumericIdSet(params.get("resourceId"));
  const enemyIds = parseNumericIdSet(params.get("enemyId"));
  const playerIds = parsePlayerIds(params.get("playerId"));

  const selection = rebuildSelectionFromIdSets(
    resourceIds,
    enemyIds,
    options.tieredResources,
    options.uniqueCategories,
  );

  return { selection, playerIds, hasSelectionParam, hasPlayerIdParam };
}

export function useSiteUrlState(options: SiteUrlStateOptions) {
  const queryString = createMemo(() => {
    const selectedItems = options.selection();
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

    if (options.includePlayerId()) {
      const normalizedPlayerIds = options.playerIds()
        .map((rawId) => rawId.trim())
        .filter((playerId) => playerId.length > 0);
      if (normalizedPlayerIds.length > 0) {
        params.push(`playerId=${normalizedPlayerIds.map(encodeURIComponent).join(",")}`);
      }
    }

    return params.join("&");
  });

  return { queryString };
}