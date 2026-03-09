import { createSignal, createMemo, createEffect, onCleanup, For, Show } from "solid-js";
import {
  TIERS,
  BASE_URL,
  type TieredResource,
  type UniqueCategory,
  type UniqueItem,
} from "../data/resources";
import { I18nProvider, useI18n, SUPPORTED_LOCALES, type Locale } from "../i18n/context";
import type { ResourceTranslationKey, UniqueItemTranslationKey } from "../i18n/translations";
import "./App.css";

type QueryParam = "resourceId" | "enemyId";

const EMBED_MAP_HASH =
  '#{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"popupText":[""],"iconName":"Hex_Logo","turnLayerOff":["ruinedLayer","treesLayer","templesLayer"]},"geometry":{"type":"Point","coordinates":[-5000,-5000]}}]}';
const UPPER_NAMES = new Set([
  "Flower", "Mushroom", "Berry", "Fiber_Plant", "Ore_Vein",
  "Tree", "Rock", "Research", "Sand", "Clay", "Animal",
]);
const LOWER_NAMES = new Set(["Sailing", "Bait_Fish", "Lake_Fish", "Ocean_Fish"]);
const IFRAME_DEBOUNCE_MS = 400;
type Selection =
  | { type: "tiered"; resourceName: string; tier: string; ids: number[]; param: QueryParam }
  | { type: "unique"; categoryName: string; itemName: string; ids: number[]; param: QueryParam };

type AppProps = {
  tieredResources: TieredResource[];
  uniqueCategories: UniqueCategory[];
};

function AppInner(props: AppProps) {
  const { t, locale, setLocale } = useI18n();

  const resName = (name: string) => {
    return t().resourceNames[name as ResourceTranslationKey] ?? name;
  };

  const uniqueItemName = (item: UniqueItem) => {
    return t().uniqueItemNames[item.translationKey as UniqueItemTranslationKey] ?? item.name;
  };

  const renderLodWarning = () => {
    const [beforeLabel, afterLabel = ""] = t().app.lodWarning.split("{label}");
    return (
      <>
        {beforeLabel}
        <strong>{t().app.lodLabel}</strong>
        {afterLabel}
      </>
    );
  };

  const [selection, setSelection] = createSignal<Selection[]>([]);

  const upperResources = createMemo(() =>
    props.tieredResources.filter((r) => UPPER_NAMES.has(r.name)),
  );

  const lowerResources = createMemo(() =>
    props.tieredResources.filter((r) => LOWER_NAMES.has(r.name)),
  );

  const url = createMemo(() => {
    const selectedItems = selection();
    if (selectedItems.length === 0) return "";

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

    if (params.length === 0) return "";
    return `${BASE_URL}?${params.join("&")}`;
  });

  function selectTiered(resource: TieredResource, tier: string) {
    const ids = resource.tiers[tier];
    if (!ids?.length) return;
    setSelection((current) => {
      const exists = current.some(
        (item) => item.type === "tiered" && item.resourceName === resource.name && item.tier === tier,
      );

      if (exists) {
        return current.filter(
          (item) => !(item.type === "tiered" && item.resourceName === resource.name && item.tier === tier),
        );
      }

      return [
        ...current,
        {
          type: "tiered",
          resourceName: resource.name,
          tier,
          ids,
          param: resource.param,
        },
      ];
    });
  }

  function selectUnique(category: UniqueCategory, item: UniqueItem) {
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
            !(selected.type === "unique" && selected.categoryName === category.name && selected.itemName === item.name),
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

  function isTieredSelected(name: string, tier: string): boolean {
    return selectionKeys().has(`t:${name}:${tier}`);
  }

  function isUniqueSelected(categoryName: string, itemName: string): boolean {
    return selectionKeys().has(`u:${categoryName}:${itemName}`);
  }

  function clearSelection() {
    setSelection([]);
  }

  function renderResourceTable(resources: TieredResource[]) {
    return (
      <div class="table-scroll">
        <table class="resource-table">
          <thead>
            <tr>
              <th class="name-col" scope="col">{t().labels.typeHeader}</th>
              <For each={TIERS}>{(tier) => <th>{tier}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={resources}>
              {(resource) => (
                <tr>
                  <td class="name-col">{resName(resource.name)}</td>
                  <For each={TIERS}>
                    {(tier) => {
                      const ids = resource.tiers[tier] ?? [];
                      const has = ids.length > 0;
                      return (
                        <td
                          classList={{
                            cell: true,
                            "has-data": has,
                            empty: !has,
                            selected: isTieredSelected(resource.name, tier),
                          }}
                          onClick={() => has && selectTiered(resource, tier)}
                        >
                          <Show when={has}>
                            <span class="cell-marker" aria-hidden="true"></span>
                          </Show>
                        </td>
                      );
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    );
  }

  async function copyUrl() {
    const u = url();
    if (!u) return;
    await navigator.clipboard.writeText(u);
  }

  const hasT1Selected = createMemo(() =>
    selection().some((item) => item.type === "tiered" && item.tier === "T1"),
  );

  const [debouncedIframeUrl, setDebouncedIframeUrl] = createSignal(
    `${BASE_URL}${EMBED_MAP_HASH}`,
  );

  createEffect(() => {
    const target = `${url() || BASE_URL}${EMBED_MAP_HASH}`;
    const timer = setTimeout(() => setDebouncedIframeUrl(target), IFRAME_DEBOUNCE_MS);
    onCleanup(() => clearTimeout(timer));
  });

  return (
    <div class="app">
      <div class="panel-left">
        <div class="title-bar">
          <h1 class="title">{t().app.title}</h1>
          <select
            class="lang-select"
            value={locale()}
            onChange={(e) => setLocale(e.currentTarget.value as Locale)}
          >
            <For each={[...SUPPORTED_LOCALES]}>
              {(l) => <option value={l}>{l.toUpperCase()}</option>}
            </For>
          </select>
        </div>

        <Show when={hasT1Selected()}>
          <div class="lod-warning">{renderLodWarning()}</div>
        </Show>

        <div class="url-bar">
          <input
            class="url-input"
            type="text"
            readonly
            value={url()}
            placeholder={t().app.urlPlaceholder}
          />
          <button class="url-copy" onClick={copyUrl} disabled={!url()}>
            {t().actions.copy}
          </button>
          <Show when={url()}>
            <a class="url-open" href={url()} target="_blank" rel="noopener noreferrer">
              {t().actions.open}
            </a>
          </Show>
        </div>

        <div class="toolbar-meta">
          <p class="selection-note">{t().labels.selected}: {selection().length}</p>
          <button class="url-clear" onClick={clearSelection} disabled={selection().length === 0}>
            {t().actions.clearSelection}
          </button>
        </div>

        <section>
          <h2>{t().sections.resources}</h2>
          <div class="resource-groups">
            <div class="resource-group">
              <h3>{t().sections.land}</h3>
              {renderResourceTable(upperResources())}
            </div>
            <div class="resource-group">
              <h3>{t().sections.oceanAndRiver}</h3>
              {renderResourceTable(lowerResources())}
            </div>
          </div>
        </section>

        <section>
          <h2>{t().sections.uniqueAndMonsters}</h2>
          <div class="table-scroll">
            <table class="unique-table">
              <tbody>
                <For each={props.uniqueCategories}>
                  {(cat) => (
                    <tr>
                      <td class="name-col">{resName(cat.name)}</td>
                      <td class="items-col">
                        <For each={cat.items}>
                          {(item) => (
                            <button
                              classList={{
                                "item-btn": true,
                                selected: isUniqueSelected(cat.name, item.name),
                              }}
                              onClick={() => selectUnique(cat, item)}
                            >
                              {uniqueItemName(item)}
                            </button>
                          )}
                        </For>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="panel-right">
        <iframe
          class="map-iframe"
          src={debouncedIframeUrl()}
          title={t().app.mapTitle}
          sandbox="allow-scripts allow-same-origin"
          referrerpolicy="no-referrer"
        />
      </div>
    </div>
  );
}

export default function App(props: AppProps) {
  return (
    <I18nProvider>
      <AppInner {...props} />
    </I18nProvider>
  );
}
