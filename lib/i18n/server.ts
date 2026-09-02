import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, pickLocale, type Locale } from './config';
import { createTranslate, type Messages, type Translate } from './t';
import { en } from './messages/en';
import { zh } from './messages/zh';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { de } from './messages/de';

const DICTIONARIES: Record<Locale, Messages> = { en, zh, es, fr, de };

export function messagesFor(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/** Per-request memo: the layout and the page both ask for it. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return pickLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerList.get('accept-language'),
  );
});

export async function getTranslate(): Promise<Translate> {
  const locale = await getLocale();
  return createTranslate(locale, messagesFor(locale), en);
}
