import { parse } from "yaml";
import enYaml from "./locales/en.yaml?raw";
import jaYaml from "./locales/ja.yaml?raw";

export const SUPPORTED_LOCALES = ["en", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
};
export const LOCALE_SELF_LABELS: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
};
export const LOCALE_SOURCE_LABELS = {
  saved: {
    en: "saved preference",
    ja: "保存済み設定",
  },
  browser: {
    en: "browser setting",
    ja: "ブラウザ設定",
  },
  default: {
    en: "default setting",
    ja: "既定設定",
  },
  manual: {
    en: "manual switch",
    ja: "手動切替",
  },
} as const;
export type LocaleSource = keyof typeof LOCALE_SOURCE_LABELS;

const TRANSLATION_SCHEMA = {
  app: {
    title: "",
    lodWarning: "",
    lodLabel: "",
    urlPlaceholder: "",
    mapTitle: "",
  },
  actions: {
    copy: "",
    copied: "",
    open: "",
    clearSelection: "",
    close: "",
  },
  playerSearch: {
    label: "",
    placeholder: "",
    minChars: "",
    noResult: "",
    selectedCount: "",
    includeInUrl: "",
    removePlayer: "",
    limitReached: "",
    autoSaved: "",
  },
  labels: {
    selected: "",
    typeHeader: "",
    includePlayerId: "",
  },
  console: {
    applied: "",
    source: "",
  },
  sections: {
    resources: "",
    land: "",
    oceanAndRiver: "",
    uniqueAndMonsters: "",
    playerIdSettings: "",
  },
  resourceNames: {
    Flower: "",
    Mushroom: "",
    Berry: "",
    Fiber_Plant: "",
    Ore_Vein: "",
    Tree: "",
    Rock: "",
    Research: "",
    Sand: "",
    Clay: "",
    Sailing: "",
    Bait_Fish: "",
    Lake_Fish: "",
    Ocean_Fish: "",
    Animal: "",
    Resource: "",
    Monster: "",
  },
  uniqueItemNames: {
    Sticks: "",
    Flint_Pile: "",
    Wild_Grains: "",
    Wild_Starbulb_Plant: "",
    Salt_Deposit: "",
    Ancient: "",
    Den: "",
    Jakyl: "",
    Alpha_Jakyl: "",
    King_Jakyl: "",
    Skitch: "",
    Desert_Crab: "",
    Frost_Crab: "",
    Terratoad: "",
    Swamp_Terratoad: "",
    Umbura: "",
    Alpha_Umbura: "",
    King_Umbura: "",
    Drone: "",
    Soldier: "",
    Queen: "",
  },
} as const;

type SchemaNode = {
  [key: string]: "" | SchemaNode;
};

type TranslationSchema = typeof TRANSLATION_SCHEMA;

type DeepStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]>;
};

export type Translations = DeepStrings<TranslationSchema>;
export type ResourceTranslationKey = keyof Translations["resourceNames"];
export type UniqueItemTranslationKey = keyof Translations["uniqueItemNames"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTranslations(
  locale: Locale,
  schema: SchemaNode,
  candidate: Record<string, unknown>,
  path = "",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(schema)) {
    const schemaValue = schema[key];
    const candidateValue = candidate[key];
    const nextPath = path ? `${path}.${key}` : key;

    if (typeof schemaValue === "string") {
      if (typeof candidateValue !== "string") {
        throw new Error(`Missing or invalid translation key '${nextPath}' for locale: ${locale}`);
      }
      result[key] = candidateValue;
      continue;
    }

    if (!isRecord(candidateValue)) {
      throw new Error(`Missing or invalid translation group '${nextPath}' for locale: ${locale}`);
    }

    result[key] = validateTranslations(locale, schemaValue, candidateValue, nextPath);
  }

  const extraKeys = Object.keys(candidate).filter((key) => !(key in schema));
  if (extraKeys.length > 0) {
    const prefix = path ? `${path}.` : "";
    throw new Error(
      `Unknown translation keys for locale ${locale}: ${extraKeys.map((key) => `${prefix}${key}`).join(", ")}`,
    );
  }

  return result;
}

function parseTranslations(locale: Locale, source: string): Translations {
  const parsed = parse(source);

  if (!isRecord(parsed)) {
    throw new Error(`Invalid translation YAML for locale: ${locale}`);
  }

  return validateTranslations(locale, TRANSLATION_SCHEMA, parsed) as Translations;
}

export const translations: Record<Locale, Translations> = {
  en: parseTranslations("en", enYaml),
  ja: parseTranslations("ja", jaYaml),
};

export function detectLocale(): { locale: Locale; source: LocaleSource } {
  if (typeof window === "undefined") {
    return { locale: DEFAULT_LOCALE, source: "default" };
  }

  const stored = localStorage.getItem("locale");
  if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
    return { locale: stored as Locale, source: "saved" };
  }

  const candidates = navigator.languages ?? [navigator.language];
  for (const tag of candidates) {
    const lang = tag.slice(0, 2).toLowerCase() as Locale;
    if (SUPPORTED_LOCALES.includes(lang)) {
      return { locale: lang, source: "browser" };
    }
  }

  return { locale: DEFAULT_LOCALE, source: "default" };
}
