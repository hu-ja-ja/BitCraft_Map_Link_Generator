import { createSignal, createMemo, For, Show } from "solid-js";
import {
  TIERS,
  BASE_URL,
  type TieredResource,
  type UniqueCategory,
  type UniqueItem,
} from "../data/resources";
import "./App.css";

type QueryParam = "resourceId" | "enemyId";

const EMBED_MAP_HASH =
  '#{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"popupText":[""],"iconName":"Hex_Logo","turnLayerOff":["ruinedLayer","treesLayer","templesLayer"]},"geometry":{"type":"Point","coordinates":[-5000,-5000]}}]}';

type Selection =
  | { type: "tiered"; resourceName: string; tier: string; ids: number[]; param: QueryParam }
  | { type: "unique"; categoryName: string; itemName: string; ids: number[]; param: QueryParam };

type AppProps = {
  tieredResources: TieredResource[];
  uniqueCategories: UniqueCategory[];
};

export default function App(props: AppProps) {
  const [selection, setSelection] = createSignal<Selection[]>([]);

  const upperResources = createMemo(() =>
    props.tieredResources.filter((resource) =>
      [
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
        "Animal",
      ].includes(resource.name),
    ),
  );

  const lowerResources = createMemo(() =>
    props.tieredResources.filter((resource) =>
      ["Sailing", "Bait_Fish", "Lake_Fish", "Ocean_Fish"].includes(resource.name),
    ),
  );

  const url = createMemo(() => {
    const selectedItems = selection();
    if (selectedItems.length === 0) return "";

    const resourceIds = new Set<number>();
    const enemyIds = new Set<number>();

    for (const item of selectedItems) {
      if (item.type === "tiered") {
        const target = item.param === "resourceId" ? resourceIds : enemyIds;
        for (const id of item.ids) {
          target.add(id);
        }
      } else {
        const target = item.param === "resourceId" ? resourceIds : enemyIds;
        for (const id of item.ids) {
          target.add(id);
        }
      }
    }

    const params: string[] = [];
    if (resourceIds.size > 0) {
      params.push(`resourceId=${Array.from(resourceIds).join(",")}`);
    }
    if (enemyIds.size > 0) {
      params.push(`enemyId=${Array.from(enemyIds).join(",")}`);
    }

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

  function isTieredSelected(name: string, tier: string): boolean {
    return selection().some(
      (item) => item.type === "tiered" && item.resourceName === name && item.tier === tier,
    );
  }

  function isUniqueSelected(categoryName: string, itemName: string): boolean {
    return selection().some(
      (item) => item.type === "unique" && item.categoryName === categoryName && item.itemName === itemName,
    );
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
              <th class="name-col" scope="col">Type</th>
              <For each={TIERS}>{(tier) => <th>{tier}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={resources}>
              {(resource) => (
                <tr>
                  <td class="name-col">{resource.displayName}</td>
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
    try {
      await navigator.clipboard.writeText(u);
    } catch {
      const input = document.querySelector<HTMLInputElement>(".url-input");
      if (input) {
        input.select();
        document.execCommand("copy");
      }
    }
  }

  const hasT1Selected = createMemo(() =>
    selection().some((item) => item.type === "tiered" && item.tier === "T1"),
  );

  const iframeUrl = createMemo(() => `${url() || BASE_URL}${EMBED_MAP_HASH}`);

  return (
    <div class="app">
      <div class="panel-left">
        <h1 class="title">BitCraft Map Link Generator</h1>

        <Show when={hasT1Selected()}>
          <div class="lod-warning">
            ⚠ T1 resources selected — enable <strong>LoD</strong> in the Map settings to help reduce PC load.
          </div>
        </Show>

        <div class="url-bar">
          <input
            class="url-input"
            type="text"
            readonly
            value={url()}
            placeholder="Select one or more entries to generate URL"
          />
          <button class="url-copy" onClick={copyUrl} disabled={!url()}>
            Copy
          </button>
          <Show when={url()}>
            <a class="url-open" href={url()} target="_blank" rel="noopener noreferrer">
              Open
            </a>
          </Show>
        </div>

        <div class="toolbar-meta">
          <p class="selection-note">Selected: {selection().length}</p>
          <button class="url-clear" onClick={clearSelection} disabled={selection().length === 0}>
            Clear Selection
          </button>
        </div>

        <section>
          <h2>Resources</h2>
          <div class="resource-groups">
            <div class="resource-group">
              <h3>Land</h3>
              {renderResourceTable(upperResources())}
            </div>
            <div class="resource-group">
              <h3>Ocean and Liver</h3>
              {renderResourceTable(lowerResources())}
            </div>
          </div>
        </section>

        <section>
          <h2>Unique & Monsters</h2>
          <div class="table-scroll">
            <table class="unique-table">
              <tbody>
                <For each={props.uniqueCategories}>
                  {(cat) => (
                    <tr>
                      <td class="name-col">{cat.displayName}</td>
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
                              {item.name}
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
          src={iframeUrl()}
          title="BitCraft Map"
          referrerpolicy="no-referrer"
        />
      </div>
    </div>
  );
}
