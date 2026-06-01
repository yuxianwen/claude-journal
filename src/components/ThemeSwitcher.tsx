'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { useI18n } from '@/i18n';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: t('themeLight'), icon: '☀️' },
    { value: 'dark',  label: t('themeDark'),  icon: '🌙' },
    { value: 'system',label: t('themeSystem'),icon: '💻' },
  ];

  const current = options.find(o => o.value === theme) ?? options[2];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title={current.label}
        className="text-gray-600 hover:text-gray-400 transition-colors flex items-center"
      >
        <span className="text-sm leading-none">{current.icon}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px]">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { setTheme(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                o.value === theme
                  ? 'text-blue-400 bg-blue-950/40'
                  : 'text-gray-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <span>{o.icon}</span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
