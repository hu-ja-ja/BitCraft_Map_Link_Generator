import { Search } from "@kobalte/core/search";
import { Search as SearchIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
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
};

const PLAYER_STORAGE_KEY = "bitcraft.selectedPlayer";
const MIN_QUERY_LENGTH = 2;
const RATE_LIMIT_REQUESTS = 250;
const RATE_LIMIT_WINDOW_MS = 60_000;
const PLAYER_SEARCH_ENDPOINT =
  import.meta.env.PUBLIC_PLAYER_SEARCH_ENDPOINT ??
  "https://bitcraft-map-link-generator.vercel.app/api/players";

export default function PlayerSearch() {
  const { t } = useI18n();

  const [options, setOptions] = createSignal<PlayerRecord[]>([]);
  const [selectedPlayer, setSelectedPlayer] = createSignal<PersistedPlayer | null>(null);
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
      const parsed = JSON.parse(raw) as PersistedPlayer;
      if (typeof parsed.entityId === "string" && typeof parsed.username === "string") {
        setSelectedPlayer({ entityId: parsed.entityId, username: parsed.username });
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

    const player = selectedPlayer();
    if (!player) {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("player-settings-changed"));
      return;
    }

    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
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

    setSelectedPlayer({ entityId: player.entityId, username: player.username });
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

        <Search.Portal>
          <Search.Content
            class="player-search-content"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <Search.Listbox class="player-search-listbox" />
            <Show when={!isLoading() && trimmedInput().length >= MIN_QUERY_LENGTH}>
              <Search.NoResult class="player-search-noresult">
                {t().playerSearch.noResult}
              </Search.NoResult>
            </Show>
          </Search.Content>
        </Search.Portal>
      </Search>

      <p class="player-search-help">
        {t().playerSearch.minChars.replace("{count}", String(MIN_QUERY_LENGTH))}
      </p>

      <Show when={selectedPlayer()}>
        {(player) => (
          <div class="selected-player-card" role="status" aria-live="polite">
            <div class="selected-player-name">{player().username}</div>
            <div class="selected-player-id">{player().entityId}</div>
          </div>
        )}
      </Show>

      <div class="player-id-field">
        <label class="player-id-label" for="selected-entity-id">{t().playerSearch.idLabel}</label>
        <input
          id="selected-entity-id"
          class="player-id-input"
          type="text"
          value={selectedPlayer()?.entityId ?? ""}
          readonly
          placeholder={t().playerSearch.idPlaceholder}
        />
        <p class="player-id-note">{t().playerSearch.autoSaved}</p>
      </div>
    </div>
  );
}
