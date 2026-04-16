import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const API_URL = "https://bitjita.com/api/resources";
const DEFAULT_USER_AGENT = "Map_Link_Generator (discord: hu_ja_ja_)";

const TIERS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"];
const RESOURCE_SECTION_ORDER = [
  "Bait_Fish",
  "Berry",
  "Clay",
  "Fiber_Plant",
  "Flower",
  "Lake_Fish",
  "Mushroom",
  "Ocean_Fish",
  "Ore_Vein",
  "Research",
  "Rock",
  "Sailing",
  "Sand",
  "Tree",
];
const UNIQUE_GROUP_ORDER = ["Ancient", "Resource", "Den"];
const EXACT_TAG_SECTIONS = new Set(RESOURCE_SECTION_ORDER);

const TAG_SECTION_MAP = {
  Baitfish: "Bait_Fish",
  "Fiber Plant": "Fiber_Plant",
  "Lake Fish School": "Lake_Fish",
  "Ocean Fish School": "Ocean_Fish",
  "Chummed Ocean Fish School": "Ocean_Fish",
  "Ore Vein": "Ore_Vein",
  Rock: "Rock",
  "Rock Outcrop": "Rock",
  "Rock Boulder": "Rock",
  "Sailing Cargo": "Sailing",
  Sapling: "Tree",
};

const UNIQUE_RESOURCE_NAMES = new Set([
  "Sticks",
  "Flint Pile",
  "Wild Grains",
  "Wild Starbulb Plant",
  "Salt Deposit",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const resourceDir = path.join(projectRoot, "src", "resource");
const generatedYamlPath = path.join(resourceDir, "resource.generated.yaml");

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isItem(value) {
  return isPlainObject(value) && Number.isInteger(value.id);
}

function normalizeItem(item) {
  return {
    id: item.id,
    ...(Number.isInteger(item.sub_id) ? { sub_id: item.sub_id } : {}),
    ...(typeof item.name === "string" && item.name.length > 0 ? { name: item.name } : {}),
    ...(item.spawn === false ? { spawn: false } : {}),
  };
}

function getTemplateArray(value) {
  return Array.isArray(value) ? value.filter(isItem).map(normalizeItem) : [];
}

function getTemplateTierMap(section) {
  if (!isPlainObject(section)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(section)
      .filter(([key]) => TIERS.includes(key))
      .map(([key, value]) => [key, getTemplateArray(value)]),
  );
}

function getTemplateUniqueMap(section) {
  if (!isPlainObject(section)) {
    return {};
  }

  return Object.fromEntries(
    UNIQUE_GROUP_ORDER.map((group) => [group, getTemplateArray(section[group])]),
  );
}

function buildTemplateIndex(document) {
  const tieredItemsById = new Map();
  const uniqueItemsById = new Map();
  const tieredSections = Object.fromEntries(
    RESOURCE_SECTION_ORDER.map((sectionName) => [sectionName, getTemplateTierMap(document[sectionName])]),
  );

  for (const sectionName of RESOURCE_SECTION_ORDER) {
    const tierMap = tieredSections[sectionName];
    for (const [tierKey, items] of Object.entries(tierMap)) {
      for (const item of items) {
        tieredItemsById.set(item.id, { sectionName, tierKey, item });
      }
    }
  }

  const uniqueMap = getTemplateUniqueMap(document.Unique);
  for (const [groupName, items] of Object.entries(uniqueMap)) {
    for (const item of items) {
      uniqueItemsById.set(item.id, { groupName, item });
    }
  }

  return {
    fixedSections: {
      Monster: getTemplateArray(document.Monster),
      Animal: getTemplateTierMap(document.Animal),
      Unique: uniqueMap,
    },
    tieredSections,
    tieredItemsById,
    uniqueItemsById,
  };
}

function createEmptyTierMap() {
  return Object.fromEntries(TIERS.map((tier) => [tier, []]));
}

function createEmptyUniqueMap() {
  return Object.fromEntries(UNIQUE_GROUP_ORDER.map((group) => [group, []]));
}

function createOutputDocument(templateIndex) {
  const document = {
    Monster: templateIndex.fixedSections.Monster,
    Animal: {},
    Unique: createEmptyUniqueMap(),
  };

  for (const tier of TIERS) {
    document.Animal[tier] = templateIndex.fixedSections.Animal[tier] ?? [];
  }

  for (const sectionName of RESOURCE_SECTION_ORDER) {
    document[sectionName] = createEmptyTierMap();
  }

  return document;
}

function inferTierKey(resource, templateMatch) {
  if (templateMatch?.tierKey) {
    return templateMatch.tierKey;
  }

  if (Number.isInteger(resource.tier) && resource.tier >= 1 && resource.tier <= 10) {
    return `T${resource.tier}`;
  }

  const fields = [resource.icon_asset_name, resource.model_asset_name, resource.name];
  for (const field of fields) {
    if (typeof field !== "string") {
      continue;
    }

    const match = field.match(/T(10|[1-9])/);
    if (match) {
      return `T${match[1]}`;
    }
  }

  return null;
}

function resolveSectionName(tag) {
  if (EXACT_TAG_SECTIONS.has(tag)) {
    return tag;
  }

  return TAG_SECTION_MAP[tag] ?? null;
}

function classifyResource(resource, templateIndex) {
  const uniqueTemplateMatch = templateIndex.uniqueItemsById.get(resource.id);
  const tieredTemplateMatch = templateIndex.tieredItemsById.get(resource.id);

  if (uniqueTemplateMatch) {
    return { type: "unique", groupName: uniqueTemplateMatch.groupName };
  }

  if (UNIQUE_RESOURCE_NAMES.has(resource.name)) {
    return { type: "unique", groupName: "Resource" };
  }

  if (resource.tag === "Ancient Loot") {
    return { type: "unique", groupName: "Ancient" };
  }

  if (resource.tag === "Monster Den") {
    return { type: "unique", groupName: "Den" };
  }

  const sectionName = resolveSectionName(resource.tag);
  if (!sectionName) {
    return null;
  }

  const tierKey = inferTierKey(resource, tieredTemplateMatch);
  if (!tierKey || !TIERS.includes(tierKey)) {
    return null;
  }

  return { type: "tiered", sectionName, tierKey };
}

function preferTemplateName(resource, templateItem) {
  if (typeof templateItem?.name === "string" && templateItem.name.length > 0) {
    return templateItem.name;
  }

  return typeof resource.name === "string" && resource.name.length > 0 ? resource.name : undefined;
}

function toOutputItem(resource, templateItem, includeName) {
  const item = { id: resource.id };
  const name = preferTemplateName(resource, templateItem);

  if (Number.isInteger(templateItem?.sub_id)) {
    item.sub_id = templateItem.sub_id;
  }

  if (includeName && name) {
    item.name = name;
  }

  if (templateItem?.spawn === false) {
    item.spawn = false;
  }

  return item;
}

function sortByTemplateThenId(resources, templateItems) {
  const templateOrder = new Map(templateItems.map((item, index) => [item.id, index]));

  return [...resources].toSorted((left, right) => {
    const leftIndex = templateOrder.get(left.id);
    const rightIndex = templateOrder.get(right.id);

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }

    if (leftIndex !== undefined) {
      return -1;
    }

    if (rightIndex !== undefined) {
      return 1;
    }

    return left.id - right.id;
  });
}

function mergeWithTemplateItems(resources, templateItems, templateLookup, includeName) {
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  const mergedItems = [];
  const consumedIds = new Set();

  for (const templateItem of templateItems) {
    const resource = resourcesById.get(templateItem.id);

    if (resource) {
      mergedItems.push(toOutputItem(resource, templateItem, includeName));
      consumedIds.add(resource.id);
      continue;
    }

    mergedItems.push(normalizeItem(templateItem));
  }

  for (const resource of resources) {
    if (consumedIds.has(resource.id)) {
      continue;
    }

    const templateItem = templateLookup.get(resource.id)?.item;
    mergedItems.push(toOutputItem(resource, templateItem, includeName));
  }

  return mergedItems.toSorted((left, right) => left.id - right.id);
}

function buildOutputDocument(payload, templateIndex) {
  const document = createOutputDocument(templateIndex);
  const groupedTiered = new Map();
  const groupedUnique = new Map();
  const skippedResources = [];

  for (const resource of payload.resources) {
    const classification = classifyResource(resource, templateIndex);

    if (!classification) {
      skippedResources.push(resource);
      continue;
    }

    if (classification.type === "tiered") {
      const key = `${classification.sectionName}:${classification.tierKey}`;
      const bucket = groupedTiered.get(key) ?? [];
      bucket.push(resource);
      groupedTiered.set(key, bucket);
      continue;
    }

    const bucket = groupedUnique.get(classification.groupName) ?? [];
    bucket.push(resource);
    groupedUnique.set(classification.groupName, bucket);
  }

  for (const sectionName of RESOURCE_SECTION_ORDER) {
    for (const tierKey of TIERS) {
      const templateItems = getTemplateArray(templateIndex.tieredSections[sectionName]?.[tierKey]);
      const resources = sortByTemplateThenId(groupedTiered.get(`${sectionName}:${tierKey}`) ?? [], templateItems);

      document[sectionName][tierKey] = mergeWithTemplateItems(
        resources,
        templateItems,
        templateIndex.tieredItemsById,
        false,
      );
    }
  }

  for (const groupName of UNIQUE_GROUP_ORDER) {
    const templateItems = templateIndex.fixedSections.Unique[groupName] ?? [];
    const resources = sortByTemplateThenId(groupedUnique.get(groupName) ?? [], templateItems);

    document.Unique[groupName] = mergeWithTemplateItems(
      resources,
      templateItems,
      templateIndex.uniqueItemsById,
      groupName === "Resource",
    );
  }

  return { document, skippedResources };
}

async function readTemplateDocument() {
  try {
    return {
      sourcePath: generatedYamlPath,
      content: await readFile(generatedYamlPath, "utf8"),
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing merge template: ${generatedYamlPath}`, { cause: error });
    }

    throw error;
  }
}

function formatItem(item, baseIndent, includeName) {
  const lines = [`${baseIndent}- id: ${item.id}`];

  if (Number.isInteger(item.sub_id)) {
    lines.push(`${baseIndent}  sub_id: ${item.sub_id}`);
  }

  if (includeName && typeof item.name === "string" && item.name.length > 0) {
    lines.push(`${baseIndent}  name: ${item.name}`);
  }

  if (item.spawn === false) {
    lines.push(`${baseIndent}  spawn: false`);
  }

  return lines;
}

function formatTierMap(sectionName, tierMap) {
  const lines = [`${sectionName}:`];

  for (const tierKey of TIERS) {
    const items = Array.isArray(tierMap[tierKey]) ? tierMap[tierKey] : [];
    if (items.length === 0) {
      lines.push(`  ${tierKey}: []`);
      continue;
    }

    lines.push(`  ${tierKey}:`);
    for (const item of items) {
      lines.push(...formatItem(item, "    ", false));
    }
  }

  return lines;
}

function formatUniqueSection(uniqueMap) {
  const lines = ["Unique:"];

  for (const groupName of UNIQUE_GROUP_ORDER) {
    const items = Array.isArray(uniqueMap[groupName]) ? uniqueMap[groupName] : [];
    if (items.length === 0) {
      lines.push(`  ${groupName}: []`);
      continue;
    }

    lines.push(`  ${groupName}:`);
    for (const item of items) {
      lines.push(...formatItem(item, "    ", groupName === "Resource"));
    }
  }

  return lines;
}

function formatMonsterSection(items) {
  const lines = ["Monster:"];
  for (const item of items) {
    lines.push(...formatItem(item, "  ", true));
  }
  return lines;
}

function formatDocument(document) {
  const sections = [formatMonsterSection(document.Monster), formatTierMap("Animal", document.Animal), formatUniqueSection(document.Unique)];

  for (const sectionName of RESOURCE_SECTION_ORDER) {
    sections.push(formatTierMap(sectionName, document[sectionName]));
  }

  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}

async function fetchResources() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": process.env.BITJITA_USER_AGENT ?? DEFAULT_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch resources: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.resources)) {
    throw new Error("Unexpected API response: expected an object with a resources array");
  }

  return payload;
}

async function main() {
  const payload = await fetchResources();
  const yamlOutputPath = generatedYamlPath;
  const { sourcePath, content } = await readTemplateDocument();
  const templateDocument = parse(content);
  const templateIndex = buildTemplateIndex(templateDocument);
  const { document, skippedResources } = buildOutputDocument(payload, templateIndex);
  const yamlOutput = formatDocument(document);

  await mkdir(resourceDir, { recursive: true });
  await writeFile(yamlOutputPath, yamlOutput, "utf8");

  if (skippedResources.length > 0) {
    console.warn(`Skipped ${skippedResources.length} resources that could not be classified into resource.yaml buckets.`);
  }

  console.log(`Wrote YAML output to ${yamlOutputPath}`);
  console.log(`Used ${sourcePath} as merge template.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});