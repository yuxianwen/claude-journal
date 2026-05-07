'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Locale, T, LOCALES, translations, detectLocale, RTL_LOCALES } from './locales';

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof T, vars?: { n?: number }) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  // Sync <html lang> and dir attributes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    if (!LOCALES.includes(l)) return;
    localStorage.setItem('claude-journal-locale', l);
    setLocaleState(l);
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
