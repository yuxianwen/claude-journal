'use client';

import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(registration => {
        // Re-check for a new SW whenever the tab regains focus (e.g. after a deploy)
        const handleVisibility = () => {
          if (document.visibilityState === 'visible') registration.update();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
      })
      .catch(() => {});

    // When a new SW takes control (skipWaiting fired), reload to run the latest code.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) {
        reloading = true;
        window.location.reload();
      }
    });
  }, []);

  return null;
}
