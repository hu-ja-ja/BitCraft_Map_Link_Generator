import { Checkbox } from "@kobalte/core/checkbox";
import { Search } from "@kobalte/core/search";
import { Check, Search as SearchIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useI18n } from "../i18n/context";

type PlayerRecord = {
  entityId: string;
  username: string;
};

type PlayerApiResponse = {
  players?: PlayerRecord[];
  total?: number;
};

type PersistedPlayer = {
  entityId: string;
  username: string;
  enabled: boolean;
};

const PLAYER_STORAGE_KEY = "bitcraft.selectedPlayer";
const MAX_SELECTED_PLAYERS = 100;
const MIN_QUERY_LENGTH = 2;
const RATE_LIMIT_REQUESTS = 250;
const RATE_LIMIT_WINDOW_MS = 60_000;
const PLAYER_SEARCH_ENDPOINT =
  import.meta.env.PUBLIC_PLAYER_SEARCH_ENDPOINT ??
  "https://bitcraft-map-link-generator.vercel.app/api/players";

export default function PlayerSearch() {
  const { t } = useI18n();

  const [options, setOptions] = createSignal<PlayerRecord[]>([]);
  const [selectedPlayers, setSelectedPlayers] = createSignal<PersistedPlayer[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isComposing, setIsComposing] = createSignal(false);
  const [lastInputValue, setLastInputValue] = createSignal("");
  const [isStorageReady, setIsStorageReady] = createSignal(false);

  let activeController: AbortController | undefined;
  let requestSeq = 0;
  let requestTimestamps: number[] = [];

  const trimmedInput = createMemo(() => lastInputValue().trim());

  onMount(() => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) {
      setIsStorageReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;

      if (Array.isArray(parsed)) {
        const players = parsed
          .map((item) => {
            const player = item as PersistedPlayer;
            if (typeof player.entityId !== "string" || typeof player.username !== "string") {
              return null;
            }
            const entityId = player.entityId.trim();
            const username = player.username.trim();
            if (!entityId || !username) return null;
            return {
              entityId,
              username,
              enabled: player.enabled !== false,
            };
          })
          .filter((player): player is PersistedPlayer => player !== null);

        const deduped = Array.from(
          new Map(players.map((player) => [player.entityId, player])).values(),
        ).slice(0, MAX_SELECTED_PLAYERS);
        setSelectedPlayers(deduped);
      } else {
        const player = parsed as PersistedPlayer;
        if (typeof player.entityId === "string" && typeof player.username === "string") {
          const entityId = player.entityId.trim();
          const username = player.username.trim();
          if (entityId && username) {
            setSelectedPlayers([{ entityId, username, enabled: true }]);
          }
        }
      }
    } catch {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
    } finally {
      setIsStorageReady(true);
    }
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStorageReady()) return;

    const players = selectedPlayers();
    if (players.length === 0) {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("player-settings-changed"));
      return;
    }

    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(players));
    window.dispatchEvent(new CustomEvent("player-settings-changed"));
  });

  onCleanup(() => {
    activeController?.abort();
  });

  function canRequestPlayers() {
    const now = Date.now();
    requestTimestamps = requestTimestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

    if (requestTimestamps.length >= RATE_LIMIT_REQUESTS) {
      return false;
    }

    requestTimestamps.push(now);
    return true;
  }

  async function queryPlayers(input: string) {
    setLastInputValue(input);

    if (isComposing()) return;

    const query = input.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      activeController?.abort();
      setOptions([]);
      setIsLoading(false);
      return;
    }

    const seq = ++requestSeq;
    if (!canRequestPlayers()) {
      setIsLoading(false);
      return;
    }

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    setIsLoading(true);

    try {
      // Custom headers are injected by the server-side API proxy.
      const response = await fetch(`${PLAYER_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Player search failed: ${response.status}`);
      }

      const payload = (await response.json()) as PlayerApiResponse;
      if (seq !== requestSeq) return;

      setOptions(Array.isArray(payload.players) ? payload.players : []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (seq !== requestSeq) return;
      setOptions([]);
      console.error("Failed to fetch players", error);
    } finally {
      if (seq === requestSeq) {
        setIsLoading(false);
      }
    }
  }

  function handleSelect(value: unknown) {
    if (!value || Array.isArray(value)) return;

    const player = value as PlayerRecord;
    if (typeof player.entityId !== "string" || typeof player.username !== "string") return;

    const entityId = player.entityId.trim();
    const username = player.username.trim();
    if (!entityId || !username) return;

    setSelectedPlayers((current) => {
      if (current.some((item) => item.entityId === entityId)) {
        return current;
      }
      if (current.length >= MAX_SELECTED_PLAYERS) {
        return current;
      }
      return [...current, { entityId, username, enabled: true }];
    });
  }

  function removePlayer(entityId: string) {
    setSelectedPlayers((current) => current.filter((player) => player.entityId !== entityId));
  }

  function togglePlayerEnabled(entityId: string, enabled: boolean) {
    setSelectedPlayers((current) =>
      current.map((player) => (player.entityId === entityId ? { ...player, enabled } : player)),
    );
  }

  function handleCompositionEnd(value: string) {
    setIsComposing(false);
    void queryPlayers(value);
  }

  return (
    <div class="player-settings-section">
      <Search<PlayerRecord>
        triggerMode="focus"
        options={options()}
        optionValue="entityId"
        optionLabel="username"
        optionTextValue="username"
        placeholder={t().playerSearch.placeholder}
        debounceOptionsMillisecond={300}
        onInputChange={(value) => {
          void queryPlayers(value);
        }}
        onChange={handleSelect}
        itemComponent={(props) => (
          <Search.Item item={props.item} class="player-search-item">
            <Search.ItemLabel class="player-search-item-name">
              {props.item.rawValue.username}
            </Search.ItemLabel>
            <Search.ItemDescription class="player-search-item-id">
              {props.item.rawValue.entityId}
            </Search.ItemDescription>
          </Search.Item>
        )}
      >
        <Search.Control class="player-search-control" aria-label={t().playerSearch.label}>
          <Search.Indicator class="player-search-indicator">
            <Search.Icon class="player-search-icon">
              <SearchIcon size={16} aria-hidden="true" />
            </Search.Icon>
          </Search.Indicator>
          <Search.Input
            class="player-search-input"
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(event) => handleCompositionEnd(event.currentTarget.value)}
          />
        </Search.Control>

        <Show when={trimmedInput().length >= MIN_QUERY_LENGTH}>
          <Search.Portal>
            <Search.Content
              class="player-search-content"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <Search.Listbox class="player-search-listbox" />
              <Show when={!isLoading()}>
                <Search.NoResult class="player-search-noresult">
                  {t().playerSearch.noResult}
                </Search.NoResult>
              </Show>
            </Search.Content>
          </Search.Portal>
        </Show>
      </Search>

      <p class="player-search-help">
        {t().playerSearch.minChars.replace("{count}", String(MIN_QUERY_LENGTH))}
      </p>

      <Show when={selectedPlayers().length > 0}>
        <p class="selected-player-count">
          {t().playerSearch.selectedCount.replace("{count}", String(selectedPlayers().length))}
        </p>
        <div class="selected-player-list" role="status" aria-live="polite">
          <For each={selectedPlayers()}>
            {(player) => (
              <div class="selected-player-card">
                <Checkbox
                  class="selected-player-toggle"
                  checked={player.enabled}
                  onChange={(checked) => togglePlayerEnabled(player.entityId, checked)}
                  aria-label={t().playerSearch.includeInUrl}
                >
                  <Checkbox.Input class="selected-player-toggle-input" />
                  <Checkbox.Control class="selected-player-toggle-control">
                    <Checkbox.Indicator class="selected-player-toggle-indicator">
                      <Check size={14} aria-hidden="true" />
                    </Checkbox.Indicator>
                  </Checkbox.Control>
                </Checkbox>
                <div class="selected-player-main">
                  <div class="selected-player-name">{player.username}</div>
                  <div class="selected-player-id">{player.entityId}</div>
                </div>
                <button
                  type="button"
                  class="selected-player-remove"
                  aria-label={t().playerSearch.removePlayer.replace("{name}", player.username)}
                  onClick={() => removePlayer(player.entityId)}
                >
                  ×
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <p class="player-id-note">{t().playerSearch.autoSaved}</p>
      <Show when={selectedPlayers().length >= MAX_SELECTED_PLAYERS}>
        <p class="player-search-limit">
          {t().playerSearch.limitReached.replace("{count}", String(MAX_SELECTED_PLAYERS))}
        </p>
      </Show>
    </div>
  );
}
