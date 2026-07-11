'use client';

import { useEffect, useState } from 'react';
import type { Provider } from '@/types';
import { useI18n } from '@/i18n';
import {
  deleteSessionAnnotation,
  getSessionAnnotation,
  makeSessionKey,
  normalizeTags,
  saveSessionAnnotation,
} from '@/lib/annotations';

interface SessionAnnotationsProps {
  sourceId: string;
  provider: Provider;
  projectId: string;
  sessionId: string;
}

export default function SessionAnnotations({ sourceId, provider, projectId, sessionId }: SessionAnnotationsProps) {
  const { t } = useI18n();
  const sessionKey = makeSessionKey(sourceId, provider, projectId, sessionId);
  const [open, setOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [note, setNote] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSessionAnnotation(sessionKey).then(annotation => {
      if (cancelled || !annotation) return;
      setFavorite(annotation.favorite);
      setNote(annotation.note);
      setTagsText(annotation.tags.join(', '));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [sessionKey]);

  const toggleFavorite = async () => {
    const next = !favorite;
    setFavorite(next);
    try {
      await saveSessionAnnotation(sessionKey, { favorite: next });
    } catch {
      setFavorite(!next);
    }
  };

  const save = async () => {
    const tags = normalizeTags(tagsText.split(','));
    try {
      if (!favorite && !note.trim() && tags.length === 0) {
        await deleteSessionAnnotation(sessionKey);
      } else {
        await saveSessionAnnotation(sessionKey, { favorite, note: note.trim(), tags });
      }
      setTagsText(tags.join(', '));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaved(false);
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={toggleFavorite}
        className={`p-1.5 rounded transition-colors ${favorite ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-gray-300'}`}
        title={favorite ? t('annotationFavoriteRemove') : t('annotationFavoriteAdd')}
        aria-pressed={favorite}
      >
        <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="p-1.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
        title={t('annotationTitle')}
        aria-expanded={open}
      >
        <span aria-hidden="true">✎</span>
      </button>

      {open && (
        <div className="absolute z-40 top-full right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-2xl">
          <p className="text-xs font-medium text-gray-300 mb-2">{t('annotationTitle')}</p>
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder={t('annotationNotePlaceholder')}
            rows={4}
            className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-300 placeholder:text-gray-600 outline-none focus:border-blue-600"
          />
          <input
            value={tagsText}
            onChange={event => setTagsText(event.target.value)}
            placeholder={t('annotationTagsPlaceholder')}
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-300 placeholder:text-gray-600 outline-none focus:border-blue-600"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
            >
              {saved ? t('annotationSaved') : t('annotationSave')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
