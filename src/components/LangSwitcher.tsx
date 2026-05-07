'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { LOCALES, LOCALE_NAMES, Locale } from '@/i18n/locales';

export default function LangSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Language"
        className="text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
          {LOCALES.map(l => (
            <button
              key={l}
              onClick={() => { setLocale(l as Locale); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                l === locale
                  ? 'text-blue-400 bg-blue-950/40'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {LOCALE_NAMES[l as Locale]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
