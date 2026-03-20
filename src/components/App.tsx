import { Checkbox } from "@kobalte/core/checkbox";
import { Dialog } from "@kobalte/core/dialog";
import { Select } from "@kobalte/core/select";
import { Toast, toaster } from "@kobalte/core/toast";
import { ToggleButton } from "@kobalte/core/toggle-button";
import { Check, Github, UserCog } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { type TieredResource, type UniqueCategory, type UniqueItem } from "../data/resources";
import { I18nProvider, useI18n, SUPPORTED_LOCALES, type Locale } from "../i18n/context";
import type { ResourceTranslationKey, UniqueItemTranslationKey } from "../i18n/translations";
import PlayerSearch from "./PlayerSearch";
import { useSelection } from "./hooks/useSelection";
import { useMapUrl } from "./hooks/useMapUrl";
import ResourceTable from "./ResourceTable";
import "./App.css";

const UPPER_NAMES = new Set([
  "Flower", "Mushroom", "Berry", "Fiber_Plant", "Ore_Vein",
  "Tree", "Rock", "Research", "Sand", "Clay", "Animal",
]);
const LOWER_NAMES = new Set(["Sailing", "Bait_Fish", "Lake_Fish", "Ocean_Fish"]);
const PLAYER_STORAGE_KEY = "bitcraft.selectedPlayer";
const INCLUDE_PLAYER_ID_STORAGE_KEY = "bitcraft.includePlayerId";
const MAP_PANEL_OPEN_STORAGE_KEY = "bitcraft.mapPanelOpen";
const MAX_SELECTED_PLAYERS = 100;

type PersistedPlayer = {
  entityId: string;
  enabled?: boolean;
};

type AppProps = {
  tieredResources: TieredResource[];
  uniqueCategories: UniqueCategory[];
};

function AppInner(props: AppProps) {
  const { t, locale, setLocale } = useI18n();
  const [showMap, setShowMap] = createSignal(true);
  const [includePlayerId, setIncludePlayerId] = createSignal(false);
  const [isIncludePlayerIdStorageReady, setIsIncludePlayerIdStorageReady] = createSignal(false);
  const [isMapPanelStorageReady, setIsMapPanelStorageReady] = createSignal(false);
  const [savedPlayerIds, setSavedPlayerIds] = createSignal<string[]>([]);

  const resName = (name: string) =>
    t().resourceNames[name as ResourceTranslationKey] ?? name;

  const uniqueItemLabel = (item: UniqueItem) =>
    t().uniqueItemNames[item.translationKey as UniqueItemTranslationKey] ?? item.name;

  const { selection, toggleTiered, toggleUnique, isTieredSelected, isUniqueSelected, clear } =
    useSelection();
  const { url, iframeUrl, hasT1Selected } = useMapUrl(selection, {
    includePlayerId,
    playerIds: savedPlayerIds,
  });

  const upperResources = createMemo(() =>
    props.tieredResources.filter((r) => UPPER_NAMES.has(r.name)),
  );

  const lowerResources = createMemo(() =>
    props.tieredResources.filter((r) => LOWER_NAMES.has(r.name)),
  );

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

  async function copyUrl() {
    const u = url();
    if (!u) return;
    await navigator.clipboard.writeText(u);
    toaster.show((toastProps) => (
      <Toast toastId={toastProps.toastId} duration={1200} class="toast">
        <Toast.Title class="toast-title">{t().actions.copied}</Toast.Title>
      </Toast>
    ));
  }

  function loadSavedPlayerIds() {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) {
      setSavedPlayerIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;

      if (Array.isArray(parsed)) {
        const ids = parsed
          .map((item) => {
            const player = item as PersistedPlayer;
            if (player.enabled === false) return "";
            return typeof player.entityId === "string" ? player.entityId.trim() : "";
          })
          .filter((id): id is string => id.length > 0);

        setSavedPlayerIds(Array.from(new Set(ids)).slice(0, MAX_SELECTED_PLAYERS));
        return;
      }

      const legacyEntityId =
        typeof (parsed as { entityId?: unknown }).entityId === "string"
          ? (parsed as { entityId: string }).entityId.trim()
          : "";
      setSavedPlayerIds(legacyEntityId ? [legacyEntityId] : []);
    } catch {
      setSavedPlayerIds([]);
    }
  }

  function loadIncludePlayerIdSetting() {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem(INCLUDE_PLAYER_ID_STORAGE_KEY);
    setIncludePlayerId(raw === "true");
    setIsIncludePlayerIdStorageReady(true);
  }

  function syncMapVisibility(mobileMedia: MediaQueryList) {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem(MAP_PANEL_OPEN_STORAGE_KEY);
    if (raw === "true" || raw === "false") {
      setShowMap(raw === "true");
    } else {
      setShowMap(!mobileMedia.matches);
    }

    setIsMapPanelStorageReady(true);
  }

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIncludePlayerIdStorageReady()) return;

    localStorage.setItem(INCLUDE_PLAYER_ID_STORAGE_KEY, includePlayerId() ? "true" : "false");
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMapPanelStorageReady()) return;

    localStorage.setItem(MAP_PANEL_OPEN_STORAGE_KEY, showMap() ? "true" : "false");
  });

  onMount(() => {
    const mobileMedia = window.matchMedia("(max-width: 768px) and (hover: none) and (pointer: coarse)");
    const onViewportChanged = () => syncMapVisibility(mobileMedia);
    onViewportChanged();

    loadIncludePlayerIdSetting();
    loadSavedPlayerIds();

    const onPlayerSettingsChanged = () => {
      loadSavedPlayerIds();
      loadIncludePlayerIdSetting();
    };
    window.addEventListener("player-settings-changed", onPlayerSettingsChanged);
    window.addEventListener("storage", onPlayerSettingsChanged);
    mobileMedia.addEventListener("change", onViewportChanged);

    onCleanup(() => {
      window.removeEventListener("player-settings-changed", onPlayerSettingsChanged);
      window.removeEventListener("storage", onPlayerSettingsChanged);
      mobileMedia.removeEventListener("change", onViewportChanged);
    });
  });

  return (
    <div class="app" classList={{ "app-sidebar-expanded": !showMap() }}>
      <div class="panel-left">
        <div class="panel-left-content">
          <div class="title-bar">
            <h1 class="title">{t().app.title}</h1>
            <div class="title-actions">
              <button
                class="map-panel-toggle"
                type="button"
                onClick={() => setShowMap((prev) => !prev)}
                aria-label={showMap() ? t().actions.expandSidebar : t().actions.showMap}
              >
                {showMap() ? t().actions.expandSidebar : t().actions.showMap}
              </button>
              <Select<Locale>
                value={locale()}
                onChange={(v) => v && setLocale(v)}
                options={[...SUPPORTED_LOCALES]}
                itemComponent={(itemProps) => (
                  <Select.Item item={itemProps.item} class="lang-select-item">
                    <Select.ItemLabel>{itemProps.item.rawValue.toUpperCase()}</Select.ItemLabel>
                  </Select.Item>
                )}
              >
                <Select.Trigger class="lang-select">
                  <Select.Value<Locale>>
                    {(state) => state.selectedOption().toUpperCase()}
                  </Select.Value>
                  <Select.Icon class="lang-select-icon">▾</Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content class="lang-select-content">
                    <Select.Listbox class="lang-select-listbox" />
                  </Select.Content>
                </Select.Portal>
              </Select>
            </div>
          </div>

          <div class="id-settings-nav-wrap">
            <Dialog>
              <Dialog.Trigger class="id-settings-nav" aria-label={t().sections.playerIdSettings}>
                <UserCog size={14} aria-hidden="true" />
                {t().sections.playerIdSettings}
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay class="settings-dialog-overlay" />
                <div class="settings-dialog-layer">
                  <Dialog.Content class="settings-dialog-content">
                    <div class="settings-dialog-header">
                      <Dialog.Title class="settings-dialog-title">
                        {t().sections.playerIdSettings}
                      </Dialog.Title>
                      <Dialog.CloseButton class="settings-dialog-close">
                        {t().actions.close}
                      </Dialog.CloseButton>
                    </div>
                    <PlayerSearch />
                  </Dialog.Content>
                </div>
              </Dialog.Portal>
            </Dialog>

            <Checkbox
              class="player-id-checkbox"
              checked={includePlayerId()}
              onChange={setIncludePlayerId}
            >
              <Checkbox.Input class="player-id-checkbox-input" />
              <Checkbox.Control class="player-id-checkbox-control">
                <Checkbox.Indicator class="player-id-checkbox-indicator">
                  <Check size={14} aria-hidden="true" />
                </Checkbox.Indicator>
              </Checkbox.Control>
              <Checkbox.Label class="player-id-checkbox-label">
                {t().labels.includePlayerId}
              </Checkbox.Label>
            </Checkbox>
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
            <button class="url-clear" onClick={clear} disabled={selection().length === 0}>
              {t().actions.clearSelection}
            </button>
          </div>

          <section>
            <h2>{t().sections.resources}</h2>
            <div class="resource-groups">
              <div class="resource-group">
                <h3>{t().sections.land}</h3>
                <ResourceTable
                  resources={upperResources()}
                  isTieredSelected={isTieredSelected}
                  onSelect={toggleTiered}
                />
              </div>
              <div class="resource-group">
                <h3>{t().sections.oceanAndRiver}</h3>
                <ResourceTable
                  resources={lowerResources()}
                  isTieredSelected={isTieredSelected}
                  onSelect={toggleTiered}
                />
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
                              <ToggleButton
                                class="item-btn"
                                pressed={isUniqueSelected(cat.name, item.name)}
                                onChange={() => toggleUnique(cat, item)}
                              >
                                {uniqueItemLabel(item)}
                              </ToggleButton>
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

        <div class="panel-footer">
          <a
            class="repo-link"
            href="https://github.com/hu-ja-ja/BitCraft_Map_Link_Generator"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github class="repo-link-icon" size={16} aria-hidden="true" />
            <span>GitHub</span>
          </a>
        </div>
      </div>

      <Show when={showMap()}>
        <div class="panel-right">
          <iframe
            class="map-iframe"
            src={iframeUrl()}
            title={t().app.mapTitle}
            sandbox="allow-scripts allow-same-origin"
            referrerpolicy="no-referrer"
          />
        </div>
      </Show>

      <div class="panel-footer panel-footer-below-map">
        <a
          class="repo-link"
          href="https://github.com/hu-ja-ja/BitCraft_Map_Link_Generator"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github class="repo-link-icon" size={16} aria-hidden="true" />
          <span>GitHub</span>
        </a>
      </div>

      <Toast.Region class="toast-region">
        <Toast.List class="toast-list" />
      </Toast.Region>
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
