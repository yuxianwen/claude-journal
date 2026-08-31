'use client';

import { useEffect, useState } from 'react';

export default function SwRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(registration => {
        // Check if there's already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // A new service worker is available and waiting
                setWaitingWorker(installingWorker);
              }
            });
          }
        });

        // Re-check for a new SW whenever the tab regains focus
        const handleVisibility = () => {
          if (document.visibilityState === 'visible') registration.update();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
      })
      .catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in">
      <span className="text-sm font-medium">新版本已就绪，是否刷新？</span>
      <button 
        onClick={() => {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }}
        className="bg-white text-blue-600 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-50 transition-colors"
      >
        刷新
      </button>
      <button 
        onClick={() => setWaitingWorker(null)}
        className="text-white/80 hover:text-white p-1"
        aria-label="关闭"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
