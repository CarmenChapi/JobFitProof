"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { defaultLanguage, translations, type Language, type LanguageCopy } from "@/lib/i18n";

const STORAGE_KEY = "jobfitproof-language";
const LANGUAGE_CHANGE_EVENT = "jobfitproof-language-change";

let fallbackLanguage: Language = defaultLanguage;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: LanguageCopy;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(value: string | null): value is Language {
  return value === "es" || value === "en";
}

function getLanguageSnapshot() {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }

  try {
    const storedLanguage = window.localStorage.getItem(STORAGE_KEY);

    if (isLanguage(storedLanguage)) {
      fallbackLanguage = storedLanguage;
      return storedLanguage;
    }
  } catch {
    // localStorage can be unavailable in restricted browser modes.
  }

  return fallbackLanguage;
}

function subscribeToLanguage(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    () => defaultLanguage,
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    fallbackLanguage = nextLanguage;

    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // Non-critical persistence failure.
    }

    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "es" ? "en" : "es");
  }, [language, setLanguage]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t: translations[language],
    }),
    [language, setLanguage, toggleLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
