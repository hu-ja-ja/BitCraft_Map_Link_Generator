import { createSignal, createContext, createEffect, useContext, type JSX } from "solid-js";
import {
  translations,
  detectLocale,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_SELF_LABELS,
  LOCALE_SOURCE_LABELS,
  SUPPORTED_LOCALES,
  type Locale,
  type LocaleSource,
  type Translations,
} from "./translations";

type I18nContextValue = {
  t: () => Translations;
  locale: () => Locale;
  setLocale: (l: Locale) => void;
};

const I18nContext = createContext<I18nContextValue>();
const CONSOLE_BADGE = "Map Link Generator";

function formatConsoleMessage(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  );
}

function getLocaleLabel(messageLocale: Locale, targetLocale: Locale): string {
  return messageLocale === targetLocale
    ? LOCALE_SELF_LABELS[targetLocale]
    : LOCALE_LABELS[targetLocale];
}

export function I18nProvider(props: { children: JSX.Element }) {
  const detected = detectLocale();
  const [locale, setLocaleSignal] = createSignal<Locale>(detected.locale);
  const [localeSource, setLocaleSource] = createSignal<LocaleSource>(detected.source);

  const t = () => translations[locale()];

  function setLocale(l: Locale) {
    setLocaleSignal(l);
    setLocaleSource("manual");
    localStorage.setItem("locale", l);
  }

  createEffect(() => {
    if (typeof window === "undefined") return;

    const currentLocale = locale();
    const messageLocale = currentLocale ?? DEFAULT_LOCALE;
    const messageSet = translations[messageLocale];
    const appliedMessage = formatConsoleMessage(messageSet.console.applied, {
      language: getLocaleLabel(messageLocale, currentLocale),
      code: currentLocale.toUpperCase(),
    });
    const sourceMessage = formatConsoleMessage(messageSet.console.source, {
      source: LOCALE_SOURCE_LABELS[localeSource()][messageLocale],
    });

    console.info(
      "%c" + CONSOLE_BADGE + "%c " + appliedMessage + " | " + sourceMessage,
      "background:#1f6feb;color:#ffffff;padding:2px 8px;border-radius:999px;font-weight:700;line-height:1.6;",
      "color:#c9d1d9;line-height:1.6;",
    );
  });

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { SUPPORTED_LOCALES };
export type { Locale };
