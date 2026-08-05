'use client';

import { useEffect } from 'react';
import { useLanguage } from '../lib/i18n';

/**
 * Keeps the <html lang> attribute matching the chosen language.
 *
 * The layout is a server component so it renders lang="pt" statically; this
 * corrects it on the client once the cookie has been read. It matters for
 * screen-reader pronunciation and stops the browser offering to translate a
 * page that is already in the reader's language.
 */
export function HtmlLangSync() {
  const { language } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
