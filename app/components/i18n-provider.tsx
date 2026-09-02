'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { createTranslate, type Messages, type Translate } from '@/lib/i18n/t';
import { en } from '@/lib/i18n/messages/en';

const I18nContext = createContext<Translate>(
  createTranslate(DEFAULT_LOCALE, en, en),
);

/** Only the active locale's dictionary is sent to the browser. */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const translate = useMemo(
    () => createTranslate(locale, messages, en),
    [locale, messages],
  );
  return (
    <I18nContext.Provider value={translate}>{children}</I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
