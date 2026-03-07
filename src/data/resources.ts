import { parse } from "yaml";
import resourceYaml from "../resource/resource.yaml?raw";

export const BASE_URL = "https://map.bitjita.com/";

export const TIERS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"] as const;

type QueryParam = "resourceId" | "enemyId";
type TierKey = (typeof TIERS)[number];

export type TieredResource = {
  name: string;
  displayName: string;
  param: QueryParam;
  tiers: Record<string, number[]>;
};

export type UniqueItem = {
  ids: number[];
  name: string;
};

export type UniqueCategory = {
  name: string;
  displayName: string;
  param: QueryParam;
  items: UniqueItem[];
};

export type ResourceAppData = {
  tieredResources: TieredResource[];
  uniqueCategories: UniqueCategory[];
};

type RawItem = {
  id: number;
  name?: string;
  spawn?: boolean;
};

type RawTierMap = Partial<Record<TierKey, RawItem[]>>;

type RawResourceDocument = Record<string, unknown> & {
  Monster?: RawItem[];
  Animal?: RawTierMap;
  Unique?: Record<string, RawItem[]>;
};

const TIERED_ORDER = [
  "Flower",
  "Mushroom",
  "Berry",
  "Fiber_Plant",
  "Ore_Vein",
  "Tree",
  "Rock",
  "Research",
  "Sand",
  "Clay",
  "Sailing",
  "Bait_Fish",
  "Lake_Fish",
  "Ocean_Fish",
  "Animal",
] as const;

const UNIQUE_ORDER = ["Resource", "Monster"] as const;

const DISPLAY_NAME_MAP: Record<string, string> = {
  Fiber_Plant: "Fiber Plant",
  Ore_Vein: "Ore Vein",
  Research: "Glyph",
  Bait_Fish: "Bait Fish",
  Lake_Fish: "Lake Fish",
  Ocean_Fish: "Ocean Fish",
};

const resourceDocument = parse(resourceYaml) as RawResourceDocument;

function toDisplayName(name: string): string {
  return DISPLAY_NAME_MAP[name] ?? name;
}

function isRawItem(value: unknown): value is RawItem {
  return typeof value === "object" && value !== null && "id" in value;
}

function getEnabledItems(items: unknown): RawItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(isRawItem).filter((item) => item.spawn !== false && Number.isInteger(item.id));
}

function getTierMap(sectionName: string): RawTierMap {
  const section = resourceDocument[sectionName];
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    return {};
  }

  return section as RawTierMap;
}

function buildTieredResource(name: string): TieredResource {
  const tierMap = getTierMap(name);

  return {
    name,
    displayName: toDisplayName(name),
    param: name === "Animal" ? "enemyId" : "resourceId",
    tiers: Object.fromEntries(
      TIERS.map((tier) => [
        tier,
        getEnabledItems(tierMap[tier]).map((item) => item.id),
      ]),
    ),
  };
}

function buildUniqueCategory(name: string): UniqueCategory {
  const uniqueGroups = resourceDocument.Unique ?? {};
  const items =
    name === "Monster"
      ? getEnabledItems(resourceDocument.Monster).map((item) => ({
          ids: [item.id],
          name: item.name ?? String(item.id),
        }))
      : [
          ...getEnabledItems(uniqueGroups.Resource).map((item) => ({
            ids: [item.id],
            name: item.name ?? String(item.id),
          })),
          {
            ids: getEnabledItems(uniqueGroups.Ancient).map((item) => item.id),
            name: "Ancient",
          },
          {
            ids: getEnabledItems(uniqueGroups.Den).map((item) => item.id),
            name: "Den",
          },
        ].filter((item) => item.ids.length > 0);

  return {
    name,
    displayName: toDisplayName(name),
    param: name === "Monster" ? "enemyId" : "resourceId",
    items,
  };
}

export const resourceAppData: ResourceAppData = {
  tieredResources: TIERED_ORDER.map((name) => buildTieredResource(name)),
  uniqueCategories: UNIQUE_ORDER.map((name) => buildUniqueCategory(name)),
};
