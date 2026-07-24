'use client';

import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFolderContext } from '@/contexts/FolderContext';
import { useI18n } from '@/i18n';
import { LOCALES } from '@/i18n/locales';

export default function SettingsModal() {
  const { isSettingsOpen, closeSettings, translateTarget, setTranslateTarget } = useSettings();
  const { theme, setTheme } = useTheme();
  const { provider, setProvider } = useFolderContext();
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    if (isSettingsOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isSettingsOpen, closeSettings]);

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeSettings}>
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('settingsTitle')}</h2>
          <button 
            onClick={closeSettings}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Data Source Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('pickerDataSource') || 'Data Source'}</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as import('@/types').Provider)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
              <option value="gemini">Antigravity</option>
            </select>
          </div>

          {/* Theme Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settingsTheme')}</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="system">{t('settingsThemeSystem')}</option>
              <option value="light">{t('settingsThemeLight')}</option>
              <option value="dark">{t('settingsThemeDark')}</option>
            </select>
          </div>

          {/* UI Language Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settingsLanguage')}</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'zh-CN' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru')}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LOCALES.map(l => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Translate Target Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('settingsTranslateTarget')}</label>
            <select
              value={translateTarget}
              onChange={(e) => setTranslateTarget(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="zh-CN">简体中文 (Simplified Chinese)</option>
              <option value="zh-TW">繁体中文 (Traditional Chinese)</option>
              <option value="en">English (英语)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="fr">Français (French)</option>
              <option value="de">Deutsch (German)</option>
              <option value="es">Español (Spanish)</option>
              <option value="ru">Русский (Russian)</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('settingsTranslateTargetHint')}
            </p>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={closeSettings}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('settingsDone')}
          </button>
        </div>
      </div>
    </div>
  );
}
