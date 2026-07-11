'use client';

/* Conversation images have unknown dimensions and may be data URLs, so a raw
 * img is intentional here; next/image cannot optimize them in a static export. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';

function externalHost(src: string): string | null {
  try {
    const url = new URL(src);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.host : null;
  } catch {
    return null;
  }
}

interface PrivacyImageProps {
  src: string;
  className: string;
  alt?: string;
}

export default function PrivacyImage({ src, className, alt = '' }: PrivacyImageProps) {
  const { t } = useI18n();
  const host = externalHost(src);
  const [externalAllowed, setExternalAllowed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (host && !externalAllowed) {
    return (
      <button
        type="button"
        onClick={() => setExternalAllowed(true)}
        className="w-full max-w-md rounded-lg border border-gray-700/60 bg-gray-900/70 px-4 py-3 text-left hover:border-gray-600 hover:bg-gray-900 transition-colors"
      >
        <span className="block text-xs font-medium text-gray-300">🌐 {t('imageExternal')}</span>
        <span className="block mt-1 text-xs text-gray-500 break-all">{host}</span>
        <span className="block mt-1 text-xs text-blue-400">{t('imageLoad')}</span>
      </button>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setLightbox(true)}
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            aria-label={t('imageClose')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={event => event.stopPropagation()}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </>
  );
}
