'use client';

import { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Locale, T, LOCALES, translations, detectLocale, RTL_LOCALES } from './locales';

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof T, vars?: { n?: number }) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);
const LOCALE_CHANGE_EVENT = 'ai-journal-locale-change';

function subscribeLocale(onStoreChange: () => void) {
  const onChange = () => onStoreChange();
  window.addEventListener('storage', onChange);
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
  };
}

function getServerLocale(): Locale {
  return 'en';
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, detectLocale, getServerLocale);

  // Sync <html lang> and dir attributes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    if (!LOCALES.includes(l)) return;
    localStorage.setItem('claude-journal-locale', l);
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  const t = useCallback((key: keyof T, vars?: { n?: number }): string => {
    const str = translations[locale][key] ?? translations['en'][key] ?? String(key);
    if (vars?.n !== undefined) return str.replace('{n}', String(vars.n));
    return str;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
