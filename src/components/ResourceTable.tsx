import { For, Show } from "solid-js";
import { ToggleButton } from "@kobalte/core/toggle-button";
import { TIERS, type TieredResource } from "../data/resources";
import { useI18n } from "../i18n/context";
import type { ResourceTranslationKey } from "../i18n/translations";

type ResourceTableProps = {
  resources: TieredResource[];
  isTieredSelected: (name: string, tier: string) => boolean;
  onSelect: (resource: TieredResource, tier: string) => void;
};

export default function ResourceTable(props: ResourceTableProps) {
  const { t } = useI18n();

  const resName = (name: string) =>
    t().resourceNames[name as ResourceTranslationKey] ?? name;

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
          <For each={props.resources}>
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
                          selected: has && props.isTieredSelected(resource.name, tier),
                        }}
                      >
                        <Show when={has}>
                          <ToggleButton
                            class="cell-btn"
                            pressed={props.isTieredSelected(resource.name, tier)}
                            onChange={() => props.onSelect(resource, tier)}
                            aria-label={`${resName(resource.name)} ${tier}`}
                          >
                            <span class="cell-marker" aria-hidden="true" />
                          </ToggleButton>
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
