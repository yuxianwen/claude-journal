'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import SettingsModal from '@/components/SettingsModal';

interface SettingsContextType {
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  translateTarget: string;
  setTranslateTarget: (lang: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [translateTarget, setTranslateTargetState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('claude-journal-translate-target') || 'zh-CN';
    }
    return 'zh-CN';
  });

  useEffect(() => {
    // Global keyboard shortcut (Cmd+, or Ctrl+,)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toLowerCase().includes('mac');
      const isModifierPressed = isMac ? e.metaKey : e.ctrlKey;
      
      if (isModifierPressed && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const setTranslateTarget = useCallback((lang: string) => {
    localStorage.setItem('claude-journal-translate-target', lang);
    setTranslateTargetState(lang);
  }, []);

  return (
    <SettingsContext.Provider value={{ isSettingsOpen, openSettings, closeSettings, translateTarget, setTranslateTarget }}>
      {children}
      <SettingsModal />
    </SettingsContext.Provider>
  );
}
