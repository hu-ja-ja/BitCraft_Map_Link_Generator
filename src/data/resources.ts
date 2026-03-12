import { parse } from "yaml";
import type { UniqueItemTranslationKey } from "../i18n/translations";
import resourceYaml from "../resource/resource.generated.yaml?raw";

export const BASE_URL = "https://map.bitjita.com/";

export const TIERS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"] as const;

export type QueryParam = "resourceId" | "enemyId";
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
  translationKey: UniqueItemTranslationKey;
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

const UNIQUE_ITEM_TRANSLATION_KEYS: Record<string, UniqueItemTranslationKey> = {
  Sticks: "Sticks",
  "Flint Pile": "Flint_Pile",
  "Wild Grains": "Wild_Grains",
  "Wild Starbulb Plant": "Wild_Starbulb_Plant",
  "Salt Deposit": "Salt_Deposit",
  Ancient: "Ancient",
  Den: "Den",
  Jakyl: "Jakyl",
  "Alpha Jakyl": "Alpha_Jakyl",
  "King Jakyl": "King_Jakyl",
  Skitch: "Skitch",
  "Desert Crab": "Desert_Crab",
  "Frost Crab": "Frost_Crab",
  Terratoad: "Terratoad",
  "Swamp Terratoad": "Swamp_Terratoad",
  Umbura: "Umbura",
  "Alpha Umbura": "Alpha_Umbura",
  "King Umbura": "King_Umbura",
  Drone: "Drone",
  Soldier: "Soldier",
  Queen: "Queen",
};

function toUniqueItemTranslationKey(name: string): UniqueItemTranslationKey {
  const key = UNIQUE_ITEM_TRANSLATION_KEYS[name];
  if (!key) {
    throw new Error(`Missing unique item translation key for: ${name}`);
  }
  return key;
}

function buildUniqueItem(item: RawItem): UniqueItem {
  const name = item.name ?? String(item.id);
  return {
    ids: [item.id],
    name,
    translationKey: toUniqueItemTranslationKey(name),
  };
}

function buildSyntheticUniqueItem(name: string, ids: number[]): UniqueItem {
  return {
    ids,
    name,
    translationKey: toUniqueItemTranslationKey(name),
  };
}

function buildUniqueCategory(name: string): UniqueCategory {
  const uniqueGroups = resourceDocument.Unique ?? {};
  const items =
    name === "Monster"
      ? getEnabledItems(resourceDocument.Monster).map(buildUniqueItem)
      : [
          ...getEnabledItems(uniqueGroups.Resource).map(buildUniqueItem),
          buildSyntheticUniqueItem(
            "Ancient",
            getEnabledItems(uniqueGroups.Ancient).map((item) => item.id),
          ),
          buildSyntheticUniqueItem(
            "Den",
            getEnabledItems(uniqueGroups.Den).map((item) => item.id),
          ),
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
