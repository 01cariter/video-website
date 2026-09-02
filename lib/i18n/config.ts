export const LOCALES = ['en', 'zh', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'snackd-locale';

/** Each language named in itself — the only label a reader can always read. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/**
 * The reader's own choice wins; otherwise the best match from the browser's
 * Accept-Language, by quality, matching on the base tag so `de-AT` finds `de`.
 */
export function pickLocale(
  cookie: string | undefined | null,
  acceptLanguage: string | undefined | null,
): Locale {
  if (isLocale(cookie)) return cookie;
  const ranked = String(acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...rest] = part.trim().split(';');
      const quality = rest
        .map((token) => token.trim())
        .find((token) => token.startsWith('q='));
      return {
        base: tag.trim().toLowerCase().split('-')[0],
        quality: quality ? Number(quality.slice(2)) || 0 : 1,
      };
    })
    .filter((entry) => entry.base)
    .sort((first, second) => second.quality - first.quality);

  for (const entry of ranked) {
    if (isLocale(entry.base)) return entry.base;
  }
  return DEFAULT_LOCALE;
}
